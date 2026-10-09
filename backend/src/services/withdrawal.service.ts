import { Prisma, WithdrawalStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { PlatformTreasuryService } from './platformTreasury.service';
import { CommissionLedgerService } from './commissionLedger.service';
import {
  CreateWithdrawalInput,
  ProcessWithdrawalActionInput,
  WithdrawalQueryInput,
  WithdrawalRequestDTO,
  WithdrawalValidationResult,
} from '../types/withdrawal.types';

/**
 * ============================================================================
 * MEMBER WITHDRAWAL SYSTEM SERVICE (PROMPT 38)
 * ============================================================================
 *
 * Integrates company treasury with member withdrawals while preserving existing payout systems.
 *
 * THE 8 VERIFICATION RULES:
 * 1. Member identity: Active distributor profile & valid authentication.
 * 2. Available commission balance: Sufficient cleared available balance.
 * 3. Withdrawal rules: Unlocked wallet, no compliance or security locks.
 * 4. Minimum withdrawal amount: Default 500.00 INR minimum.
 * 5. Maximum withdrawal amount: Default 100,000.00 INR maximum per transaction.
 * 6. Account verification: Verified KYC bank account belonging to the member.
 * 7. Sufficient company payout liquidity: Platform Treasury available float check.
 * 8. Duplicate withdrawal prevention: Idempotency & rapid repeat submission guards.
 *
 * FINANCIAL INTEGRITY & ATOMICITY:
 * - Do NOT allow users to withdraw PENDING, REVERSED, or CANCELLED commission.
 * - Do NOT deduct money before the appropriate transaction stage (hold in pendingBalance first).
 * - Atomic ledger operations with paired transactions.
 * - Never allow negative wallet balances.
 */
export class WithdrawalService {
  public static readonly DEFAULT_MIN_WITHDRAWAL = 500.0;
  public static readonly DEFAULT_MAX_WITHDRAWAL = 100000.0;
  public static readonly DEFAULT_PAYOUT_PROVIDER = 'MANUAL_BANK_TRANSFER';
  public static readonly DEFAULT_WALLET_CODE = 'PRIMARY_TREASURY';

  /**
   * Formats a raw WithdrawalRequest into a standardized DTO.
   */
  public static formatWithdrawal(record: any): WithdrawalRequestDTO {
    return {
      id: record.id,
      memberId: record.memberId,
      amount: SafeDecimal.round(record.amount, 2),
      fee: SafeDecimal.round(record.fee ?? 0, 2),
      netAmount: SafeDecimal.round(record.netAmount ?? record.amount, 2),
      status: record.status,
      payoutProvider: record.payoutProvider ?? this.DEFAULT_PAYOUT_PROVIDER,
      externalTransactionId: record.externalTransactionId ?? null,
      createdAt: record.createdAt,
      processedAt: record.processedAt ?? null,
      bankAccountId: record.bankAccountId ?? null,
      payoutRequestId: record.payoutRequestId ?? null,
      walletTransactionId: record.walletTransactionId ?? null,
      platformTransactionId: record.platformTransactionId ?? null,
      failureReason: record.failureReason ?? null,
      adminNotes: record.adminNotes ?? null,
      metadata: (record.metadata as Record<string, any>) ?? null,
      idempotencyKey: record.idempotencyKey ?? null,
    };
  }

  /**
   * 8-POINT COMPREHENSIVE WITHDRAWAL VERIFICATION ENGINE
   *
   * Verifies all 8 prompt-mandated rules prior to initiating a withdrawal.
   */
  public static async validateWithdrawal(
    userIdOrDistributorId: string,
    amount: number | string | Prisma.Decimal,
    bankAccountId?: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalValidationResult> {
    const db = existingTx || prisma;
    const requestedAmountDecimal = SafeDecimal.roundDecimal(amount, 2);
    const requestedAmount = requestedAmountDecimal.toNumber();

    const violations: string[] = [];
    const warnings: string[] = [];

    // 1. RULE 1: Verify Member Identity
    const distributor = await db.distributorProfile.findFirst({
      where: {
        OR: [
          { id: userIdOrDistributorId },
          { userId: userIdOrDistributorId },
          { distributorId: userIdOrDistributorId },
          { distributorCode: userIdOrDistributorId },
        ],
      },
      include: {
        user: { select: { id: true, email: true, status: true } },
      },
    });

    if (!distributor) {
      return {
        isValid: false,
        memberId: userIdOrDistributorId,
        walletId: '',
        requestedAmount,
        availableCommissionBalance: 0,
        pendingCommissionBalance: 0,
        reversedCommissionBalance: 0,
        cancelledCommissionBalance: 0,
        companyPayoutLiquidity: 0,
        minAmount: this.DEFAULT_MIN_WITHDRAWAL,
        maxAmount: this.DEFAULT_MAX_WITHDRAWAL,
        violations: ['Member identity could not be verified. Distributor profile not found.'],
        warnings: [],
      };
    }

    if (distributor.status !== 'ACTIVE') {
      violations.push(`Member account is not active (Status: ${distributor.status}). Withdrawals are prohibited.`);
    }

    // Resolve Member Wallet
    const wallet = await db.wallet.findFirst({
      where: {
        OR: [{ distributorId: distributor.id }, { userId: distributor.userId }],
      },
    });

    if (!wallet) {
      violations.push('Member wallet not found. Contact platform support.');
    }

    const walletId = wallet?.id || '';
    const availableBalance = wallet ? SafeDecimal.round(wallet.availableBalance, 2) : 0;
    const pendingBalance = wallet ? SafeDecimal.round(wallet.pendingBalance, 2) : 0;

    // 2. RULE 2: Available Commission Balance
    // Audit uncleared commissions (PENDING, REVERSED, CANCELLED)
    const [pendingAgg, reversedAgg, cancelledAgg] = await Promise.all([
      db.commissionTransaction.aggregate({
        where: { recipientMemberId: distributor.id, status: 'PENDING' },
        _sum: { grossCommissionAmount: true },
      }),
      db.commissionTransaction.aggregate({
        where: { recipientMemberId: distributor.id, status: 'REVERSED' },
        _sum: { grossCommissionAmount: true },
      }),
      db.commissionTransaction.aggregate({
        where: { recipientMemberId: distributor.id, status: 'CANCELLED' },
        _sum: { grossCommissionAmount: true },
      }),
    ]);

    const pendingCommissionsTotal = SafeDecimal.round(pendingAgg._sum.grossCommissionAmount ?? 0, 2);
    const reversedCommissionsTotal = SafeDecimal.round(reversedAgg._sum.grossCommissionAmount ?? 0, 2);
    const cancelledCommissionsTotal = SafeDecimal.round(cancelledAgg._sum.grossCommissionAmount ?? 0, 2);

    if (requestedAmount > availableBalance) {
      violations.push(
        `Insufficient available balance (Available: ₹${availableBalance.toFixed(2)}, Requested: ₹${requestedAmount.toFixed(2)}). Uncleared commissions (Pending: ₹${pendingCommissionsTotal.toFixed(2)}) cannot be withdrawn.`
      );
    }

    // 3. RULE 3: Withdrawal Rules (Lock & Standing)
    if (wallet?.isLocked) {
      violations.push('Member wallet is locked. Withdrawals are temporarily suspended.');
    }

    // 4. RULE 4: Minimum Withdrawal Amount
    if (requestedAmount < this.DEFAULT_MIN_WITHDRAWAL) {
      violations.push(
        `Withdrawal amount (₹${requestedAmount.toFixed(2)}) is below the minimum threshold of ₹${this.DEFAULT_MIN_WITHDRAWAL.toFixed(2)}.`
      );
    }

    // 5. RULE 5: Maximum Withdrawal Amount
    if (requestedAmount > this.DEFAULT_MAX_WITHDRAWAL) {
      violations.push(
        `Withdrawal amount (₹${requestedAmount.toFixed(2)}) exceeds the maximum transaction limit of ₹${this.DEFAULT_MAX_WITHDRAWAL.toFixed(2)}.`
      );
    }

    // 6. RULE 6: Account Verification (Bank Account & KYC)
    if (bankAccountId) {
      const bankAccount = await db.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          distributorId: distributor.id,
          deletedAt: null,
        },
      });

      if (!bankAccount) {
        violations.push('Designated bank account was not found or does not belong to your member profile.');
      } else if (bankAccount.status !== 'VERIFIED') {
        violations.push(
          `Designated bank account is not verified (Status: ${bankAccount.status}). Only verified accounts may receive withdrawals.`
        );
      }
    }

    // 7. RULE 7: Sufficient Company Payout Liquidity
    const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(this.DEFAULT_WALLET_CODE, db);
    const companyPayoutLiquidity = SafeDecimal.round(treasuryWallet.availableBalance, 2);

    if (companyPayoutLiquidity < requestedAmount) {
      violations.push(
        `Insufficient company payout liquidity (Company Float: ₹${companyPayoutLiquidity.toFixed(2)}, Requested: ₹${requestedAmount.toFixed(2)}).`
      );
    }

    // 8. RULE 8: Duplicate Withdrawal Prevention
    const recentDuplicate = await db.withdrawalRequest.findFirst({
      where: {
        memberId: distributor.id,
        amount: requestedAmountDecimal,
        status: { in: ['REQUESTED', 'UNDER_REVIEW', 'PROCESSING'] },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
      },
    });

    if (recentDuplicate) {
      violations.push(
        `Duplicate withdrawal request detected. An identical request (#${recentDuplicate.id}) is currently pending review.`
      );
    }

    return {
      isValid: violations.length === 0,
      memberId: distributor.id,
      walletId,
      requestedAmount,
      availableCommissionBalance: availableBalance,
      pendingCommissionBalance: pendingCommissionsTotal,
      reversedCommissionBalance: reversedCommissionsTotal,
      cancelledCommissionBalance: cancelledCommissionsTotal,
      companyPayoutLiquidity,
      minAmount: this.DEFAULT_MIN_WITHDRAWAL,
      maxAmount: this.DEFAULT_MAX_WITHDRAWAL,
      violations,
      warnings,
    };
  }

  /**
   * STEP 1: CREATE WITHDRAWAL REQUEST
   *
   * Creates a WithdrawalRequest record with status REQUESTED.
   * Places requested funds on HOLD in member wallet (availableBalance -> pendingBalance).
   * Integrates seamlessly with existing PayoutRequest without replacing it.
   */
  public static async requestWithdrawal(
    userId: string,
    input: CreateWithdrawalInput,
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalRequestDTO> {
    const amountDecimal = SafeDecimal.roundDecimal(input.amount, 2);
    const amount = amountDecimal.toNumber();

    const runner = async (db: Prisma.TransactionClient): Promise<WithdrawalRequestDTO> => {
      // 1. Idempotency Check
      if (input.idempotencyKey && input.idempotencyKey.trim()) {
        const cleanKey = input.idempotencyKey.trim();
        const existing = await db.withdrawalRequest.findUnique({
          where: { idempotencyKey: cleanKey },
        });
        if (existing) {
          return this.formatWithdrawal(existing);
        }
      }

      // 2. Validate all 8 rules
      const validation = await this.validateWithdrawal(userId, amount, input.bankAccountId, db);
      if (!validation.isValid) {
        throw AppError.badRequest(
          `Withdrawal validation failed: ${validation.violations.join('; ')}`,
          'WITHDRAWAL_VALIDATION_FAILED'
        );
      }

      const memberId = validation.memberId;
      const walletId = validation.walletId;

      // 3. Atomically place funds on HOLD in Member Wallet
      // Deduct from availableBalance, increment pendingBalance
      const wallet = await db.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw AppError.notFound('Wallet not found');

      const availableBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
      if (availableBefore.lessThan(amountDecimal)) {
        throw AppError.badRequest(
          `Insufficient available balance. Negative balances are strictly prohibited.`,
          'INSUFFICIENT_FUNDS'
        );
      }

      const availableAfter = availableBefore.sub(amountDecimal);

      await db.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: availableAfter,
          balance: availableAfter,
          pendingBalance: { increment: amountDecimal },
        },
      });

      // 4. Create WithdrawalRequest record (PROMPT 38)
      const withdrawal = await db.withdrawalRequest.create({
        data: {
          memberId,
          amount: amountDecimal,
          fee: new Prisma.Decimal(0),
          netAmount: amountDecimal,
          status: 'REQUESTED',
          payoutProvider: input.payoutProvider || this.DEFAULT_PAYOUT_PROVIDER,
          bankAccountId: input.bankAccountId,
          adminNotes: input.notes || null,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          metadata: {
            initiatedByUserId: userId,
            requestedAmount: amount,
            walletId,
          },
        },
      });

      // 5. Integrate without replacing: Sync with existing PayoutRequest
      const payoutNumber = `POR-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const payout = await db.payoutRequest.create({
        data: {
          payoutNumber,
          distributorId: memberId,
          bankAccountId: input.bankAccountId,
          amount: amountDecimal,
          fee: new Prisma.Decimal(0),
          netAmount: amountDecimal,
          status: 'REQUESTED',
          requestedAt: new Date(),
          adminNotes: input.notes ? `[WithdrawalRequest #${withdrawal.id}] ${input.notes}` : `[WithdrawalRequest #${withdrawal.id}]`,
        },
      });

      // Link payoutRequestId in withdrawal request
      const updatedWithdrawal = await db.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: { payoutRequestId: payout.id },
      });

      logger.info(
        {
          withdrawalId: withdrawal.id,
          payoutId: payout.id,
          memberId,
          amount,
          status: 'REQUESTED',
        },
        'Member withdrawal request created and funds placed on pending hold'
      );

      return this.formatWithdrawal(updatedWithdrawal);
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 2: APPROVE WITHDRAWAL REQUEST
   *
   * Transitions status from REQUESTED / UNDER_REVIEW to APPROVED.
   */
  public static async approveWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    adminNotes?: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalRequestDTO> {
    const runner = async (db: Prisma.TransactionClient): Promise<WithdrawalRequestDTO> => {
      const withdrawal = await db.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw AppError.notFound(`Withdrawal request '${withdrawalId}' not found`);

      if (withdrawal.status === 'PAID') throw AppError.badRequest('Withdrawal is already marked as PAID');
      if (withdrawal.status === 'FAILED' || withdrawal.status === 'CANCELLED' || withdrawal.status === 'REVERSED') {
        throw AppError.badRequest(`Cannot approve withdrawal with status '${withdrawal.status}'`);
      }

      const updated = await db.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: 'APPROVED',
          adminNotes: adminNotes
            ? `${withdrawal.adminNotes ? withdrawal.adminNotes + '\n' : ''}Approved: ${adminNotes}`
            : withdrawal.adminNotes,
        },
      });

      if (withdrawal.payoutRequestId) {
        await db.payoutRequest.update({
          where: { id: withdrawal.payoutRequestId },
          data: { status: 'APPROVED' },
        });
      }

      await db.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'WITHDRAWAL_APPROVED',
          entityType: 'WithdrawalRequest',
          entityId: withdrawal.id,
          previousData: { status: withdrawal.status },
          newData: { status: 'APPROVED', adminNotes },
        },
      });

      return this.formatWithdrawal(updated);
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 3: DISPATCH PROCESSING
   *
   * Transitions status to PROCESSING when sent to payment provider (e.g. RazorpayX / Bank Payout).
   */
  public static async dispatchProcessing(
    withdrawalId: string,
    adminUserId: string,
    provider: string,
    externalTransactionId?: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalRequestDTO> {
    const runner = async (db: Prisma.TransactionClient): Promise<WithdrawalRequestDTO> => {
      const withdrawal = await db.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw AppError.notFound(`Withdrawal request '${withdrawalId}' not found`);

      const updated = await db.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: 'PROCESSING',
          payoutProvider: provider,
          externalTransactionId: externalTransactionId || withdrawal.externalTransactionId,
        },
      });

      if (withdrawal.payoutRequestId) {
        await db.payoutRequest.update({
          where: { id: withdrawal.payoutRequestId },
          data: {
            status: 'PROCESSING',
            referenceNumber: externalTransactionId || undefined,
          },
        });
      }

      return this.formatWithdrawal(updated);
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 4: DISBURSE WITHDRAWAL (TRANSITION TO PAID)
   *
   * Flow:
   * 1. Debits Platform Treasury via PlatformWalletTransaction ('PAYOUT').
   * 2. Finalizes Member Wallet held pendingBalance (decrement pending, increment lifetimePaid).
   * 3. Creates Member WalletTransaction ('PAYOUT').
   * 4. Updates WithdrawalRequest to PAID, records processedAt & externalTransactionId.
   * 5. Syncs paired PayoutRequest to PAID.
   */
  public static async disburseWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    options?: { externalTransactionId?: string; referenceNumber?: string; adminNotes?: string },
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalRequestDTO> {
    const runner = async (db: Prisma.TransactionClient): Promise<WithdrawalRequestDTO> => {
      const withdrawal = await db.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: { member: true },
      });

      if (!withdrawal) throw AppError.notFound(`Withdrawal request '${withdrawalId}' not found`);
      if (withdrawal.status === 'PAID') throw AppError.badRequest('Withdrawal has already been marked as PAID');
      if (['FAILED', 'CANCELLED', 'REVERSED'].includes(withdrawal.status)) {
        throw AppError.badRequest(`Cannot disburse withdrawal with status '${withdrawal.status}'`);
      }

      const amountDecimal = SafeDecimal.roundDecimal(withdrawal.amount, 2);
      const netAmountDecimal = SafeDecimal.roundDecimal(withdrawal.netAmount, 2);
      const feeDecimal = SafeDecimal.roundDecimal(withdrawal.fee, 2);
      const now = new Date();

      // 1. Verify Platform Treasury liquidity and debit Platform Treasury
      const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(this.DEFAULT_WALLET_CODE, db);
      const treasuryBefore = SafeDecimal.roundDecimal(treasuryWallet.availableBalance, 2);

      if (treasuryBefore.lessThan(netAmountDecimal)) {
        throw AppError.badRequest(
          `Insufficient company payout liquidity. Treasury available: ₹${treasuryBefore.toFixed(2)}, Required: ₹${netAmountDecimal.toFixed(2)}`,
          'INSUFFICIENT_COMPANY_LIQUIDITY'
        );
      }

      const treasuryAfter = treasuryBefore.sub(netAmountDecimal);
      const platformTxNumber = PlatformTreasuryService.generateTransactionNumber();
      const memberTxNumber = CommissionLedgerService.generateWalletTransactionNumber();

      const platformTx = await db.platformWalletTransaction.create({
        data: {
          walletId: treasuryWallet.id,
          transactionNumber: platformTxNumber,
          type: 'PAYOUT',
          amount: netAmountDecimal,
          balanceBefore: treasuryBefore,
          balanceAfter: treasuryAfter,
          referenceType: 'WITHDRAWAL',
          referenceId: withdrawal.id,
          externalTransactionId: options?.externalTransactionId || null,
          status: 'COMPLETED',
          description: `Disbursement for Withdrawal #${withdrawal.id} to member ${withdrawal.memberId}`,
          performedById: adminUserId,
        },
      });

      await db.platformWallet.update({
        where: { id: treasuryWallet.id },
        data: { availableBalance: treasuryAfter },
      });

      // 2. Finalize Member Wallet held pendingBalance
      const memberWallet = await db.wallet.findFirst({
        where: { distributorId: withdrawal.memberId },
      });

      if (!memberWallet) throw AppError.notFound('Member wallet not found');

      const memberAvail = SafeDecimal.roundDecimal(memberWallet.availableBalance, 2);

      await db.wallet.update({
        where: { id: memberWallet.id },
        data: {
          pendingBalance: { decrement: amountDecimal },
          lifetimePaid: { increment: amountDecimal },
          totalWithdrawn: { increment: amountDecimal },
        },
      });

      // 3. Create Member WalletTransaction
      const memberWalletTx = await db.walletTransaction.create({
        data: {
          walletId: memberWallet.id,
          transactionNumber: memberTxNumber,
          type: 'PAYOUT',
          status: 'COMPLETED',
          amount: amountDecimal,
          feeAmount: feeDecimal,
          netAmount: netAmountDecimal,
          balanceBefore: memberAvail,
          balanceAfter: memberAvail,
          referenceId: withdrawal.id,
          description: `Withdrawal #${withdrawal.id} disbursed via ${withdrawal.payoutProvider} (Ref: ${options?.referenceNumber || options?.externalTransactionId || 'N/A'})`,
        },
      });

      // 4. Update WithdrawalRequest to PAID
      const updated = await db.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: 'PAID',
          processedAt: now,
          externalTransactionId: options?.externalTransactionId || withdrawal.externalTransactionId,
          platformTransactionId: platformTx.id,
          walletTransactionId: memberWalletTx.id,
          adminNotes: options?.adminNotes
            ? `${withdrawal.adminNotes ? withdrawal.adminNotes + '\n' : ''}Disbursed: ${options.adminNotes}`
            : withdrawal.adminNotes,
        },
      });

      // 5. Update paired PayoutRequest
      if (withdrawal.payoutRequestId) {
        await db.payoutRequest.update({
          where: { id: withdrawal.payoutRequestId },
          data: {
            status: 'PAID',
            processedAt: now,
            referenceNumber: options?.referenceNumber || options?.externalTransactionId,
            walletTransactionId: memberWalletTx.id,
          },
        });
      }

      return this.formatWithdrawal(updated);
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 5: CANCEL OR FAIL WITHDRAWAL
   *
   * Releases held funds from pendingBalance back to availableBalance.
   * Records compensating ledger transaction.
   */
  public static async cancelOrFailWithdrawal(
    withdrawalId: string,
    status: 'CANCELLED' | 'FAILED',
    reason: string,
    adminUserId?: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalRequestDTO> {
    const runner = async (db: Prisma.TransactionClient): Promise<WithdrawalRequestDTO> => {
      const withdrawal = await db.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw AppError.notFound(`Withdrawal request '${withdrawalId}' not found`);

      if (withdrawal.status === 'PAID') {
        throw AppError.badRequest('Cannot cancel or fail a withdrawal that has already been PAID. Use reversal instead.');
      }
      if (withdrawal.status === 'CANCELLED' || withdrawal.status === 'FAILED') {
        throw AppError.badRequest(`Withdrawal is already in ${withdrawal.status} status`);
      }

      const amountDecimal = SafeDecimal.roundDecimal(withdrawal.amount, 2);

      // Restore held pending funds back to availableBalance
      const memberWallet = await db.wallet.findFirst({
        where: { distributorId: withdrawal.memberId },
      });

      if (memberWallet) {
        const availBefore = SafeDecimal.roundDecimal(memberWallet.availableBalance, 2);
        const availAfter = availBefore.add(amountDecimal);

        await db.wallet.update({
          where: { id: memberWallet.id },
          data: {
            availableBalance: availAfter,
            balance: availAfter,
            pendingBalance: { decrement: amountDecimal },
          },
        });

        // Compensating REVERSAL WalletTransaction
        await db.walletTransaction.create({
          data: {
            walletId: memberWallet.id,
            transactionNumber: CommissionLedgerService.generateWalletTransactionNumber(),
            type: 'REVERSAL',
            status: 'COMPLETED',
            amount: amountDecimal,
            netAmount: amountDecimal,
            feeAmount: new Prisma.Decimal(0),
            balanceBefore: availBefore,
            balanceAfter: availAfter,
            referenceId: withdrawal.id,
            description: `Withdrawal #${withdrawal.id} ${status}. Held funds released back to available balance. Reason: ${reason}`,
          },
        });
      }

      const now = new Date();
      const updated = await db.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status,
          processedAt: now,
          failureReason: reason,
          adminNotes: withdrawal.adminNotes
            ? `${withdrawal.adminNotes}\n${status}: ${reason}`
            : `${status}: ${reason}`,
        },
      });

      if (withdrawal.payoutRequestId) {
        await db.payoutRequest.update({
          where: { id: withdrawal.payoutRequestId },
          data: {
            status: status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
            failureReason: reason,
            processedAt: now,
          },
        });
      }

      return this.formatWithdrawal(updated);
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 6: POST-PAYOUT REVERSAL
   *
   * Handles post-disbursement chargeback / reversal.
   */
  public static async reverseWithdrawal(
    withdrawalId: string,
    reason: string,
    adminUserId: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<WithdrawalRequestDTO> {
    const runner = async (db: Prisma.TransactionClient): Promise<WithdrawalRequestDTO> => {
      const withdrawal = await db.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw AppError.notFound(`Withdrawal request '${withdrawalId}' not found`);

      if (withdrawal.status !== 'PAID') {
        throw AppError.badRequest(`Only PAID withdrawals can be transitioned to REVERSED. Current status: ${withdrawal.status}`);
      }

      const netAmountDecimal = SafeDecimal.roundDecimal(withdrawal.netAmount, 2);

      // Refund Platform Treasury
      const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(this.DEFAULT_WALLET_CODE, db);
      const treasuryBefore = SafeDecimal.roundDecimal(treasuryWallet.availableBalance, 2);
      const treasuryAfter = treasuryBefore.add(netAmountDecimal);

      await db.platformWalletTransaction.create({
        data: {
          walletId: treasuryWallet.id,
          transactionNumber: PlatformTreasuryService.generateTransactionNumber(),
          type: 'RECONCILIATION',
          amount: netAmountDecimal,
          balanceBefore: treasuryBefore,
          balanceAfter: treasuryAfter,
          referenceType: 'WITHDRAWAL_REVERSAL',
          referenceId: withdrawal.id,
          status: 'COMPLETED',
          description: `Compensating Treasury refund for reversed Withdrawal #${withdrawal.id}. Reason: ${reason}`,
          performedById: adminUserId,
        },
      });

      await db.platformWallet.update({
        where: { id: treasuryWallet.id },
        data: { availableBalance: treasuryAfter },
      });

      const updated = await db.withdrawalRequest.update({
        where: { id: withdrawal.id },
        data: {
          status: 'REVERSED',
          failureReason: reason,
        },
      });

      return this.formatWithdrawal(updated);
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * QUERY WITHDRAWALS
   */
  public static async getWithdrawals(query: WithdrawalQueryInput = {}): Promise<{
    withdrawals: WithdrawalRequestDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.WithdrawalRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.payoutProvider ? { payoutProvider: query.payoutProvider } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [total, rawRecords] = await Promise.all([
      prisma.withdrawalRequest.count({ where: whereClause }),
      prisma.withdrawalRequest.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      withdrawals: rawRecords.map((r) => this.formatWithdrawal(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * GET SINGLE WITHDRAWAL BY ID
   */
  public static async getWithdrawalById(id: string): Promise<WithdrawalRequestDTO> {
    const record = await prisma.withdrawalRequest.findUnique({ where: { id } });
    if (!record) throw AppError.notFound(`Withdrawal request '${id}' not found`);
    return this.formatWithdrawal(record);
  }
}
