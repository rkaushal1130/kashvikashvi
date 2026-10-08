import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { FundingProviderFactory } from '../providers/funding';
import { PlatformTreasuryService } from './platformTreasury.service';
import { FundingService } from './funding.service';
import {
  FundingAccountDTO,
  FundingTransactionDTO,
  InitiateFundingInput,
} from '../types/funding.types';

export interface FundingWorkflowResult {
  transaction: FundingTransactionDTO;
  paymentLinkUrl?: string;
  virtualAccountDetails?: any;
}

export interface VerifyAndSettleResult {
  transaction: FundingTransactionDTO;
  isCredited: boolean;
  treasuryBalance?: number;
  message: string;
}

/**
 * ============================================================================
 * ADMIN FUNDING WORKFLOW SERVICE (PROMPT 33)
 * ============================================================================
 *
 * Implements the complete end-to-end admin funding workflow:
 *
 * ADMIN LOGIN
 *    ↓
 * ADMIN OPENS FUNDING PORTAL
 *    ↓
 * VIEW CONNECTED FUNDING ACCOUNT
 *    ↓
 * ENTER FUNDING AMOUNT (INTENDED AMOUNT)
 *    ↓
 * BACKEND VALIDATES AMOUNT
 *    ↓
 * CREATE FUNDING TRANSACTION (STATUS: PENDING)
 *    ↓
 * CREATE PROVIDER FUNDING REQUEST (VIRTUAL ACCOUNT / SMART COLLECT)
 *    ↓
 * ADMIN COMPLETES BANK/PAYMENT AUTHORIZATION THROUGH PROVIDER
 *    ↓
 * PROVIDER PROCESSES PAYMENT
 *    ↓
 * PROVIDER WEBHOOK / STATUS VERIFICATION
 *    ↓
 * VERIFY EXTERNAL TRANSACTION
 *    ↓
 * MARK FUNDING SUCCEEDED
 *    ↓
 * CREDIT PLATFORM TREASURY (ATOMIC TRANSACTION)
 *    ↓
 * CREATE TREASURY LEDGER TRANSACTION
 *    ↓
 * AUDIT LOG
 *
 * ABSOLUTE FINANCIAL INVARIANTS:
 * 1. Admin-entered amount is only an INTENDED amount; NOT proof of money received.
 * 2. Platform Treasury must ONLY be credited after external transaction is verified.
 * 3. FAILED -> Do NOT credit treasury.
 * 4. PENDING -> Do NOT credit treasury.
 * 5. SUCCEEDED -> Verify provider transaction, then credit treasury atomically.
 * 6. REVERSED -> Debit platform treasury with FUNDING_REVERSAL ledger entry.
 * 7. Entire process is strictly idempotent.
 */
export class FundingWorkflowService {
  /**
   * 1. INITIATE FUNDING WORKFLOW
   * Validates intended funding amount, registers provider request, and creates pending transaction.
   */
  public static async initiateFunding(
    adminId: string,
    input: InitiateFundingInput
  ): Promise<FundingWorkflowResult> {
    const amountDecimal = SafeDecimal.roundDecimal(input.amount, 2);
    if (amountDecimal.lessThanOrEqualTo(0)) {
      throw AppError.badRequest('Intended funding amount must be greater than zero', 'INVALID_AMOUNT');
    }

    if (amountDecimal.lessThan(100)) {
      throw AppError.badRequest('Minimum corporate funding amount is 100.00 INR', 'MINIMUM_AMOUNT_NOT_MET');
    }

    // 1. Resolve and verify funding account
    let account = null;
    const accountId = input.fundingAccountId?.trim();

    if (accountId) {
      account = await prisma.fundingAccount.findUnique({
        where: { id: accountId },
      });
    } else {
      account =
        (await prisma.fundingAccount.findFirst({
          where: { status: 'ACTIVE', isPrimary: true },
        })) ||
        (await prisma.fundingAccount.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        }));
    }

    if (!account) {
      throw AppError.notFound(
        accountId
          ? `Funding account '${accountId}' not found`
          : 'No active corporate funding account found. Please connect a bank/payment account first.',
        'ACCOUNT_NOT_FOUND'
      );
    }

    if (account.status !== 'ACTIVE') {
      throw AppError.badRequest(
        `Funding account is not in ACTIVE status (current: ${account.status})`,
        'ACCOUNT_NOT_ACTIVE'
      );
    }

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `FDR_${account.id.slice(-6)}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Check if idempotencyKey already exists
    const existingTx = await prisma.fundingTransaction.findUnique({
      where: { idempotencyKey },
      include: {
        fundingAccount: true,
        initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (existingTx) {
      logger.info({ idempotencyKey }, 'Idempotent request: returning existing funding transaction');
      return {
        transaction: FundingService.formatTransaction(existingTx),
      };
    }

    // 2. Resolve active provider via factory
    const provider = FundingProviderFactory.getProvider(account.provider);

    // 3. Create external provider funding request / virtual account session
    const providerReq = await provider.createFundingRequest({
      providerAccountId: account.providerAccountId,
      amount: amountDecimal.toNumber(),
      currency: input.currency || account.currency || 'INR',
      idempotencyKey,
      description: input.description || 'Corporate operational float top-up',
      metadata: input.metadata,
    });

    // 4. Create FundingTransaction in database with status PENDING
    const createdTx = await prisma.fundingTransaction.create({
      data: {
        fundingAccountId: account.id,
        initiatedByAdminId: adminId.trim(),
        amount: amountDecimal,
        currency: input.currency || account.currency || 'INR',
        status: 'PENDING',
        provider: account.provider,
        providerTransactionId: providerReq.providerTransactionId,
        idempotencyKey,
        metadata: {
          intendedDescription: input.description,
          virtualAccount: providerReq.virtualAccountDetails,
          paymentLinkUrl: providerReq.paymentLinkUrl,
          ...input.metadata,
        },
        initiatedAt: new Date(),
      },
      include: {
        fundingAccount: true,
        initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });

    // 5. Emit AuditLog
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'FUNDING_TRANSACTION_INITIATED',
        entityType: 'FundingTransaction',
        entityId: createdTx.id,
        newData: {
          amount: amountDecimal.toNumber(),
          currency: createdTx.currency,
          provider: createdTx.provider,
          providerTransactionId: createdTx.providerTransactionId,
          idempotencyKey,
        },
      },
    });

    logger.info(
      { transactionId: createdTx.id, amount: amountDecimal.toFixed(2), provider: createdTx.provider },
      'Initiated funding transaction awaiting provider payment'
    );

    return {
      transaction: FundingService.formatTransaction(createdTx),
      paymentLinkUrl: providerReq.paymentLinkUrl,
      virtualAccountDetails: providerReq.virtualAccountDetails,
    };
  }

  /**
   * 2. VERIFY AND PROCESS FUNDING
   * Verifies external payment settlement through provider and credits Platform Treasury ONLY upon success.
   */
  public static async verifyAndProcessFunding(
    adminId: string,
    transactionId: string,
    options?: { utrNumber?: string }
  ): Promise<VerifyAndSettleResult> {
    const txRecord = await prisma.fundingTransaction.findUnique({
      where: { id: transactionId.trim() },
      include: {
        fundingAccount: true,
        initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!txRecord) {
      throw AppError.notFound(`Funding transaction '${transactionId}' not found`, 'TRANSACTION_NOT_FOUND');
    }

    // 1. Strict Idempotency Check: If already SUCCEEDED, do NOT credit treasury again
    if (txRecord.status === 'SUCCEEDED') {
      const treasuryBalance = await PlatformTreasuryService.getTreasuryBalance();
      return {
        transaction: FundingService.formatTransaction(txRecord),
        isCredited: false,
        treasuryBalance: treasuryBalance.availableBalance,
        message: 'Transaction has already been verified and credited to platform treasury.',
      };
    }

    if (txRecord.status === 'CANCELLED' || txRecord.status === 'REVERSED') {
      throw AppError.badRequest(
        `Cannot verify funding transaction in '${txRecord.status}' status.`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    if (!txRecord.providerTransactionId) {
      throw AppError.badRequest(
        'Transaction missing providerTransactionId; cannot verify external settlement',
        'MISSING_PROVIDER_TX_ID'
      );
    }

    // 2. Query external provider for authoritative verification
    const provider = FundingProviderFactory.getProvider(txRecord.provider);
    const verification = await provider.verifyTransaction({
      providerTransactionId: txRecord.providerTransactionId,
      expectedAmount: SafeDecimal.round(txRecord.amount, 2),
      currency: txRecord.currency,
      utrNumber: options?.utrNumber,
    });

    // 3. Handle PENDING / PROCESSING provider status: DO NOT credit treasury
    if (verification.status === 'PENDING' || verification.status === 'PROCESSING') {
      const updatedPending = await prisma.fundingTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: verification.status,
        },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      });

      return {
        transaction: FundingService.formatTransaction(updatedPending),
        isCredited: false,
        message: 'External payment is still processing at provider. Treasury will be credited once settled.',
      };
    }

    // 4. Handle FAILED provider status: DO NOT credit treasury
    if (verification.status === 'FAILED' || !verification.verified) {
      const updatedFailed = await prisma.fundingTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: 'FAILED',
          failureReason: verification.discrepancyReason || 'Provider reported payment failure / unverified',
          completedAt: new Date(),
        },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'FUNDING_TRANSACTION_FAILED',
          entityType: 'FundingTransaction',
          entityId: txRecord.id,
          newData: {
            reason: updatedFailed.failureReason,
            providerTransactionId: txRecord.providerTransactionId,
          },
        },
      });

      logger.warn(
        { transactionId: txRecord.id, reason: updatedFailed.failureReason },
        'Funding verification failed. Platform treasury was NOT credited.'
      );

      return {
        transaction: FundingService.formatTransaction(updatedFailed),
        isCredited: false,
        message: `External transaction verification failed: ${updatedFailed.failureReason}. Treasury was not credited.`,
      };
    }

    // 5. Handle SUCCEEDED provider status: Atomically credit Platform Treasury
    return prisma.$transaction(async (db) => {
      // Step A: Credit Platform Treasury with strict immutable ledger entry
      const creditResult = await PlatformTreasuryService.creditTreasury(
        {
          amount: txRecord.amount,
          type: 'FUNDING',
          referenceType: 'FUNDING_TRANSACTION',
          referenceId: txRecord.id,
          externalTransactionId: verification.utrNumber || txRecord.providerTransactionId || undefined,
          providerTransactionId: txRecord.providerTransactionId || undefined,
          idempotencyKey: `TREASURY_CREDIT:${txRecord.id}`,
          description: `Corporate funding from ${txRecord.fundingAccount.accountName} (${txRecord.provider})`,
          performedById: adminId,
          metadata: {
            fundingTransactionId: txRecord.id,
            providerTransactionId: txRecord.providerTransactionId,
            utrNumber: verification.utrNumber,
          },
        },
        db
      );

      // Step B: Mark FundingTransaction SUCCEEDED with link to PlatformWalletTransaction
      const settledTx = await db.fundingTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: 'SUCCEEDED',
          platformWalletTransactionId: creditResult.transaction.id,
          completedAt: verification.settledAt || new Date(),
        },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      });

      // Step C: AuditLog
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: 'FUNDING_TRANSACTION_SUCCEEDED',
          entityType: 'FundingTransaction',
          entityId: txRecord.id,
          newData: {
            amount: SafeDecimal.round(txRecord.amount, 2),
            platformWalletTransactionId: creditResult.transaction.id,
            newTreasuryBalance: creditResult.wallet.availableBalance,
            utrNumber: verification.utrNumber,
          },
        },
      });

      logger.info(
        {
          transactionId: txRecord.id,
          amount: SafeDecimal.round(txRecord.amount, 2),
          newTreasuryBalance: creditResult.wallet.availableBalance,
        },
        'Funding transaction verified and settled! Platform Treasury successfully credited.'
      );

      return {
        transaction: FundingService.formatTransaction(settledTx),
        isCredited: true,
        treasuryBalance: creditResult.wallet.availableBalance,
        message: 'External payment verified successfully. Platform treasury has been credited.',
      };
    });
  }

  /**
   * 3. HANDLE PROVIDER WEBHOOK (PROMPT 36)
   * Authenticates HMAC-SHA256 signature, enforces WebhookEvent idempotency,
   * cross-verifies amounts, and settles or flags transaction for reconciliation.
   */
  public static async handleProviderWebhook(
    rawPayload: string | Buffer,
    signature: string,
    providerName: string = 'RAZORPAYX',
    headers?: Record<string, any>
  ): Promise<{
    acknowledged: boolean;
    status?: string;
    message: string;
    transactionId?: string;
    externalEventId?: string;
    isCredited?: boolean;
    isDuplicate?: boolean;
    treasuryBalance?: number;
    discrepancy?: { expectedAmount: number; confirmedAmount: number };
  }> {
    const { FundingWebhookService } = await import('./fundingWebhook.service');
    return FundingWebhookService.processWebhook({
      rawPayload,
      signature,
      providerName,
      headers,
    });
  }

  /**
   * 4. PROCESS FUNDING REVERSAL
   * When an external payment is reversed/chargebacked, creates a FUNDING_REVERSAL debit in the Platform Treasury.
   */
  public static async processFundingReversal(
    adminId: string,
    transactionId: string,
    reason: string
  ): Promise<{ transaction: FundingTransactionDTO; treasuryBalance: number }> {
    const txRecord = await prisma.fundingTransaction.findUnique({
      where: { id: transactionId.trim() },
      include: {
        fundingAccount: true,
        initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!txRecord) {
      throw AppError.notFound(`Funding transaction '${transactionId}' not found`, 'TRANSACTION_NOT_FOUND');
    }

    if (txRecord.status !== 'SUCCEEDED') {
      throw AppError.badRequest(
        `Only SUCCEEDED funding transactions can be reversed (current: ${txRecord.status})`,
        'INVALID_REVERSAL_STATUS'
      );
    }

    return prisma.$transaction(async (db) => {
      // Step A: Debit Platform Treasury with FUNDING_REVERSAL ledger entry
      const debitResult = await PlatformTreasuryService.debitTreasury(
        {
          amount: txRecord.amount,
          type: 'FUNDING_REVERSAL',
          referenceType: 'FUNDING_TRANSACTION_REVERSAL',
          referenceId: txRecord.id,
          idempotencyKey: `TREASURY_REVERSAL:${txRecord.id}`,
          description: `Reversal of corporate funding transaction ${txRecord.id}: ${reason}`,
          performedById: adminId,
          allowOverdraft: true, // Emergency reversal allowed even if temporary deficit occurs
        },
        db
      );

      // Step B: Update FundingTransaction to REVERSED
      const reversedTx = await db.fundingTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: 'REVERSED',
          failureReason: reason,
        },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      });

      // Step C: AuditLog
      await db.auditLog.create({
        data: {
          userId: adminId,
          action: 'FUNDING_TRANSACTION_REVERSED',
          entityType: 'FundingTransaction',
          entityId: txRecord.id,
          newData: {
            reason,
            reversedAmount: SafeDecimal.round(txRecord.amount, 2),
            newTreasuryBalance: debitResult.wallet.availableBalance,
          },
        },
      });

      logger.warn(
        {
          transactionId: txRecord.id,
          reversedAmount: SafeDecimal.round(txRecord.amount, 2),
          newTreasuryBalance: debitResult.wallet.availableBalance,
        },
        'Funding transaction reversed and Platform Treasury debited.'
      );

      return {
        transaction: FundingService.formatTransaction(reversedTx),
        treasuryBalance: debitResult.wallet.availableBalance,
      };
    });
  }

  /**
   * 5. RECONCILE FUNDING TRANSACTION (PROMPT 34)
   * Authoritatively queries external provider to reconcile single transaction.
   * If external provider confirms settlement and transaction is pending, credits treasury.
   */
  public static async reconcileFundingTransaction(
    adminId: string,
    transactionId: string,
    options?: { expectedAmount?: number; utrNumber?: string; notes?: string }
  ): Promise<{
    transaction: FundingTransactionDTO;
    reconciliation: any;
    isCredited: boolean;
    treasuryBalance?: number;
    message: string;
  }> {
    const txRecord = await prisma.fundingTransaction.findUnique({
      where: { id: transactionId.trim() },
      include: {
        fundingAccount: true,
        initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!txRecord) {
      throw AppError.notFound(`Funding transaction '${transactionId}' not found`, 'TRANSACTION_NOT_FOUND');
    }

    if (!txRecord.providerTransactionId) {
      throw AppError.badRequest(
        'Transaction missing providerTransactionId; cannot reconcile with provider',
        'MISSING_PROVIDER_TX_ID'
      );
    }

    const provider = FundingProviderFactory.getProvider(txRecord.provider);
    const expectedAmount = options?.expectedAmount ?? SafeDecimal.round(txRecord.amount, 2);
    const reconResult = await provider.reconcileTransaction(
      txRecord.providerTransactionId,
      expectedAmount
    );

    // If transaction already SUCCEEDED
    if (txRecord.status === 'SUCCEEDED') {
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      return {
        transaction: FundingService.formatTransaction(txRecord),
        reconciliation: reconResult,
        isCredited: false,
        treasuryBalance: treasury.availableBalance,
        message: 'Transaction has already been reconciled and settled in platform ledger.',
      };
    }

    // Provider confirmed settlement and match
    if (reconResult.isMatched && reconResult.providerStatus === 'SUCCEEDED') {
      const settleResult = await this.verifyAndProcessFunding(adminId, txRecord.id, {
        utrNumber: reconResult.utrNumber || options?.utrNumber,
      });

      await prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'FUNDING_TRANSACTION_RECONCILED',
          entityType: 'FundingTransaction',
          entityId: txRecord.id,
          newData: {
            reconciliation: reconResult as any,
            settled: true,
            notes: options?.notes,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        transaction: settleResult.transaction,
        reconciliation: reconResult,
        isCredited: true,
        treasuryBalance: settleResult.treasuryBalance,
        message: 'Funding transaction successfully reconciled and settled. Treasury credited.',
      };
    }

    // Mismatch or discrepancy
    if (!reconResult.isMatched) {
      const updatedDiscrepancy = await prisma.fundingTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: 'RECONCILIATION_REQUIRED',
          failureReason: `Amount discrepancy: Expected ${expectedAmount}, Provider reported ${reconResult.actualAmount}`,
        },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: adminId,
          action: 'FUNDING_RECONCILIATION_DISCREPANCY',
          entityType: 'FundingTransaction',
          entityId: txRecord.id,
          newData: {
            reconciliation: reconResult as any,
            notes: options?.notes,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        transaction: FundingService.formatTransaction(updatedDiscrepancy),
        reconciliation: reconResult,
        isCredited: false,
        message: `Reconciliation discrepancy flagged: Expected ${expectedAmount}, actual ${reconResult.actualAmount}. Treasury was not credited.`,
      };
    }

    return {
      transaction: FundingService.formatTransaction(txRecord),
      reconciliation: reconResult,
      isCredited: false,
      message: `Provider status: ${reconResult.providerStatus}. Treasury was not credited.`,
    };
  }

  /**
   * 6. GET FUNDING DASHBOARD
   * Aggregates live treasury balance, connected corporate accounts, and transaction stats.
   */
  public static async getFundingDashboard(): Promise<{
    treasury: any;
    accounts: FundingAccountDTO[];
    recentTransactions: FundingTransactionDTO[];
    stats: {
      totalInitiated: number;
      totalSucceeded: number;
      totalFailed: number;
      pendingCount: number;
    };
  }> {
    const [treasury, accounts, transactions, counts] = await Promise.all([
      PlatformTreasuryService.getTreasuryBalance(),
      FundingService.listFundingAccounts(),
      prisma.fundingTransaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          fundingAccount: true,
          initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.fundingTransaction.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    let totalInitiated = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let pendingCount = 0;

    for (const c of counts) {
      const count = c._count.id;
      totalInitiated += count;
      if (c.status === 'SUCCEEDED') totalSucceeded += count;
      if (c.status === 'FAILED' || c.status === 'CANCELLED') totalFailed += count;
      if (c.status === 'PENDING' || c.status === 'PROCESSING' || c.status === 'CREATED') pendingCount += count;
    }

    return {
      treasury,
      accounts,
      recentTransactions: transactions.map((t) => FundingService.formatTransaction(t)),
      stats: {
        totalInitiated,
        totalSucceeded,
        totalFailed,
        pendingCount,
      },
    };
  }
}
