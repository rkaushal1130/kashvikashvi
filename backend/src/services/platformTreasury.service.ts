import { PlatformTransactionStatus, PlatformTransactionType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import {
  CreditTreasuryInput,
  DebitTreasuryInput,
  GetTreasuryTransactionsQuery,
  PlatformWalletDTO,
  PlatformWalletTransactionDTO,
  TreasuryDiscrepancy,
  TreasuryReconciliationReport,
} from '../types/platformTreasury.types';

/**
 * ============================================================================
 * PLATFORM TREASURY SERVICE (PROMPT 30)
 * ============================================================================
 *
 * Implements the authoritative company / platform treasury wallet and ledger.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. This wallet is strictly distinct from member, commission, or withdrawal wallets.
 * 2. It represents the company's available operational funds and platform float.
 * 3. Never modify a historical wallet transaction (append-only ledger).
 * 4. Never directly overwrite balance without creating a corresponding ledger transaction.
 * 5. All operations run inside atomic database transactions (`prisma.$transaction`).
 * 6. Precise decimal arithmetic via SafeDecimal / Prisma.Decimal (no floating point drift).
 * 7. Duplicate funding prevented via `providerTransactionId` and `idempotencyKey`.
 * 8. Full reconciliation engine verifying ledger integrity and balance consistency.
 * 9. Direct client or arbitrary admin balance mutation is strictly forbidden.
 */
export class PlatformTreasuryService {
  public static readonly DEFAULT_WALLET_CODE = 'PRIMARY_TREASURY';
  public static readonly DEFAULT_CURRENCY = 'INR';

  /**
   * Formats a raw PlatformWallet model into a standardized DTO.
   */
  public static formatWallet(wallet: any): PlatformWalletDTO {
    return {
      id: wallet.id,
      walletCode: wallet.walletCode,
      currency: wallet.currency ?? this.DEFAULT_CURRENCY,
      availableBalance: SafeDecimal.round(wallet.availableBalance, 2),
      pendingBalance: SafeDecimal.round(wallet.pendingBalance ?? 0, 2),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Formats a raw PlatformWalletTransaction model into a standardized DTO.
   */
  public static formatTransaction(tx: any): PlatformWalletTransactionDTO {
    return {
      id: tx.id,
      walletId: tx.walletId,
      transactionNumber: tx.transactionNumber,
      type: tx.type,
      amount: SafeDecimal.round(tx.amount, 2),
      balanceBefore: SafeDecimal.round(tx.balanceBefore, 2),
      balanceAfter: SafeDecimal.round(tx.balanceAfter, 2),
      referenceType: tx.referenceType,
      referenceId: tx.referenceId ?? null,
      externalTransactionId: tx.externalTransactionId ?? null,
      providerTransactionId: tx.providerTransactionId ?? null,
      idempotencyKey: tx.idempotencyKey ?? null,
      status: tx.status,
      description: tx.description,
      metadata: (tx.metadata as Record<string, any>) ?? null,
      performedById: tx.performedById ?? null,
      createdAt: tx.createdAt,
    };
  }

  /**
   * Generates a unique, sequential transaction number for platform ledger entries.
   * Format: PWX-YYYYMMDD-HHMMSS-RAND
   */
  public static generateTransactionNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PWX-${dateStr}-${timeStr}-${randomSuffix}`;
  }

  /**
   * Resolves or atomically initializes the platform treasury wallet.
   * Ensures the platform treasury wallet always exists as a single source of truth.
   */
  public static async getOrCreatePlatformWallet(
    walletCode: string = this.DEFAULT_WALLET_CODE,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    const db = tx || prisma;
    let wallet = await db.platformWallet.findUnique({
      where: { walletCode },
    });

    if (!wallet) {
      wallet = await db.platformWallet.create({
        data: {
          walletCode,
          currency: this.DEFAULT_CURRENCY,
          availableBalance: new Prisma.Decimal('0.00'),
          pendingBalance: new Prisma.Decimal('0.00'),
        },
      });
      logger.info({ walletId: wallet.id, walletCode }, 'Initialized Platform Treasury Wallet');
    }

    return wallet;
  }

  /**
   * 1. getTreasuryBalance()
   * Retrieves the current verified platform treasury balance and metadata.
   */
  public static async getTreasuryBalance(
    options?: { walletCode?: string },
    tx?: Prisma.TransactionClient
  ): Promise<PlatformWalletDTO> {
    const walletCode = options?.walletCode || this.DEFAULT_WALLET_CODE;
    const wallet = await this.getOrCreatePlatformWallet(walletCode, tx);
    return this.formatWallet(wallet);
  }

  /**
   * 2. creditTreasury()
   * Atomically credits the platform treasury wallet with strict ledger recording.
   *
   * BUSINESS INVARIANTS:
   * - Amount must be positive.
   * - Must prevent duplicate funding via providerTransactionId and idempotencyKey.
   * - Never updates balance without creating an immutable PlatformWalletTransaction.
   * - balanceBefore and balanceAfter are strictly tracked.
   */
  public static async creditTreasury(
    input: CreditTreasuryInput,
    existingTx?: Prisma.TransactionClient
  ): Promise<{
    wallet: PlatformWalletDTO;
    transaction: PlatformWalletTransactionDTO;
  }> {
    const amountDecimal = SafeDecimal.roundDecimal(input.amount, 2);
    if (amountDecimal.lessThanOrEqualTo(0)) {
      throw AppError.badRequest(
        `Credit amount must be greater than zero. Received: ${amountDecimal.toFixed(2)}`,
        'INVALID_CREDIT_AMOUNT'
      );
    }

    if (!input.referenceType || !input.referenceType.trim()) {
      throw AppError.badRequest('referenceType is required for treasury credit', 'REFERENCE_TYPE_REQUIRED');
    }

    if (!input.description || !input.description.trim()) {
      throw AppError.badRequest('description is required for treasury credit', 'DESCRIPTION_REQUIRED');
    }

    const walletCode = input.walletCode || this.DEFAULT_WALLET_CODE;
    const type: PlatformTransactionType = input.type || 'FUNDING';

    const runner = async (db: Prisma.TransactionClient) => {
      // 1. Prevent duplicate transactions using idempotencyKey
      if (input.idempotencyKey && input.idempotencyKey.trim()) {
        const cleanIdempotencyKey = input.idempotencyKey.trim();
        const existingByIdempotency = await db.platformWalletTransaction.findUnique({
          where: { idempotencyKey: cleanIdempotencyKey },
        });

        if (existingByIdempotency) {
          throw AppError.conflict(
            `Duplicate treasury transaction: idempotencyKey '${cleanIdempotencyKey}' has already been processed.`,
            'DUPLICATE_IDEMPOTENCY_KEY'
          );
        }
      }

      // 2. Prevent duplicate external/provider funding transactions
      const externalTxId = input.externalTransactionId?.trim() || input.providerTransactionId?.trim();
      const providerTxId = input.providerTransactionId?.trim() || input.externalTransactionId?.trim();

      if (externalTxId || providerTxId) {
        const existingByProvider = await db.platformWalletTransaction.findFirst({
          where: {
            type: { in: ['FUNDING', 'ADJUSTMENT', 'RECONCILIATION'] },
            OR: [
              ...(externalTxId ? [{ externalTransactionId: externalTxId }] : []),
              ...(providerTxId ? [{ providerTransactionId: providerTxId }] : []),
            ],
          },
        });

        if (existingByProvider) {
          throw AppError.conflict(
            `Duplicate funding transaction detected: provider transaction '${externalTxId || providerTxId}' has already been credited (Transaction: ${existingByProvider.transactionNumber}).`,
            'DUPLICATE_PROVIDER_TRANSACTION'
          );
        }
      }

      // 3. Resolve or initialize PlatformWallet
      const wallet = await this.getOrCreatePlatformWallet(walletCode, db);

      // 4. Derive balances with exact decimal precision
      const balanceBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
      const balanceAfter = balanceBefore.add(amountDecimal);

      // 5. Generate sequential business transaction number
      const transactionNumber = this.generateTransactionNumber();

      // 6. Create immutable PlatformWalletTransaction record
      const walletTx = await db.platformWalletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionNumber,
          type,
          amount: amountDecimal,
          balanceBefore,
          balanceAfter,
          referenceType: input.referenceType.trim(),
          referenceId: input.referenceId?.trim() || null,
          externalTransactionId: externalTxId || null,
          providerTransactionId: providerTxId || null,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          status: 'COMPLETED',
          description: input.description.trim(),
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          performedById: input.performedById?.trim() || null,
        },
      });

      // 7. Update PlatformWallet balance
      const updatedWallet = await db.platformWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
        },
      });

      // 8. Create formal AuditLog entry if admin user is present
      if (input.performedById) {
        await db.auditLog.create({
          data: {
            userId: input.performedById,
            action: `PLATFORM_TREASURY_CREDIT_${type}`,
            entityType: 'PlatformWallet',
            entityId: wallet.id,
            previousData: {
              availableBalance: balanceBefore.toNumber(),
            },
            newData: {
              availableBalance: balanceAfter.toNumber(),
              amount: amountDecimal.toNumber(),
              transactionNumber,
              type,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
              externalTransactionId: externalTxId,
              reason: (input.metadata as any)?.reason || null,
            },
            ipAddress: (input.metadata as any)?.ipAddress || null,
            userAgent: (input.metadata as any)?.userAgent || null,
          },
        });
      }

      logger.info(
        {
          walletCode,
          transactionNumber,
          type,
          amount: amountDecimal.toFixed(2),
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
        },
        'Platform Treasury credited successfully'
      );

      return {
        wallet: this.formatWallet(updatedWallet),
        transaction: this.formatTransaction(walletTx),
      };
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * 3. debitTreasury()
   * Atomically debits the platform treasury wallet with strict ledger recording.
   *
   * BUSINESS INVARIANTS:
   * - Amount must be positive.
   * - Prevents negative treasury balance unless allowOverdraft is explicitly granted.
   * - Never updates balance without creating an immutable PlatformWalletTransaction.
   * - balanceBefore and balanceAfter are strictly tracked.
   */
  public static async debitTreasury(
    input: DebitTreasuryInput,
    existingTx?: Prisma.TransactionClient
  ): Promise<{
    wallet: PlatformWalletDTO;
    transaction: PlatformWalletTransactionDTO;
  }> {
    const amountDecimal = SafeDecimal.roundDecimal(input.amount, 2);
    if (amountDecimal.lessThanOrEqualTo(0)) {
      throw AppError.badRequest(
        `Debit amount must be greater than zero. Received: ${amountDecimal.toFixed(2)}`,
        'INVALID_DEBIT_AMOUNT'
      );
    }

    if (!input.referenceType || !input.referenceType.trim()) {
      throw AppError.badRequest('referenceType is required for treasury debit', 'REFERENCE_TYPE_REQUIRED');
    }

    if (!input.description || !input.description.trim()) {
      throw AppError.badRequest('description is required for treasury debit', 'DESCRIPTION_REQUIRED');
    }

    const walletCode = input.walletCode || this.DEFAULT_WALLET_CODE;
    const type: PlatformTransactionType = input.type || 'PAYOUT';

    const runner = async (db: Prisma.TransactionClient) => {
      // 1. Prevent duplicate transactions using idempotencyKey
      if (input.idempotencyKey && input.idempotencyKey.trim()) {
        const cleanIdempotencyKey = input.idempotencyKey.trim();
        const existingByIdempotency = await db.platformWalletTransaction.findUnique({
          where: { idempotencyKey: cleanIdempotencyKey },
        });

        if (existingByIdempotency) {
          throw AppError.conflict(
            `Duplicate treasury transaction: idempotencyKey '${cleanIdempotencyKey}' has already been processed.`,
            'DUPLICATE_IDEMPOTENCY_KEY'
          );
        }
      }

      // 2. Resolve or initialize PlatformWallet
      const wallet = await this.getOrCreatePlatformWallet(walletCode, db);

      // 3. Derive balances with exact decimal precision
      const balanceBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
      const balanceAfter = balanceBefore.sub(amountDecimal);

      // 4. Overdraft protection check
      if (balanceAfter.lessThan(0) && !input.allowOverdraft) {
        throw AppError.badRequest(
          `Insufficient treasury liquidity. Available: ${balanceBefore.toFixed(2)} ${wallet.currency}, Requested debit: ${amountDecimal.toFixed(2)} ${wallet.currency}.`,
          'INSUFFICIENT_TREASURY_FUNDS'
        );
      }

      // 5. Generate sequential business transaction number
      const transactionNumber = this.generateTransactionNumber();
      const externalTxId = input.externalTransactionId?.trim() || input.providerTransactionId?.trim();
      const providerTxId = input.providerTransactionId?.trim() || input.externalTransactionId?.trim();

      // 6. Create immutable PlatformWalletTransaction record
      const walletTx = await db.platformWalletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionNumber,
          type,
          amount: amountDecimal,
          balanceBefore,
          balanceAfter,
          referenceType: input.referenceType.trim(),
          referenceId: input.referenceId?.trim() || null,
          externalTransactionId: externalTxId || null,
          providerTransactionId: providerTxId || null,
          idempotencyKey: input.idempotencyKey?.trim() || null,
          status: 'COMPLETED',
          description: input.description.trim(),
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          performedById: input.performedById?.trim() || null,
        },
      });

      // 7. Update PlatformWallet balance
      const updatedWallet = await db.platformWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
        },
      });

      // 8. Create formal AuditLog entry if admin user is present
      if (input.performedById) {
        await db.auditLog.create({
          data: {
            userId: input.performedById,
            action: `PLATFORM_TREASURY_DEBIT_${type}`,
            entityType: 'PlatformWallet',
            entityId: wallet.id,
            previousData: {
              availableBalance: balanceBefore.toNumber(),
            },
            newData: {
              availableBalance: balanceAfter.toNumber(),
              amount: amountDecimal.toNumber(),
              transactionNumber,
              type,
              referenceType: input.referenceType,
              referenceId: input.referenceId,
              externalTransactionId: externalTxId,
              reason: (input.metadata as any)?.reason || null,
            },
            ipAddress: (input.metadata as any)?.ipAddress || null,
            userAgent: (input.metadata as any)?.userAgent || null,
          },
        });
      }

      logger.info(
        {
          walletCode,
          transactionNumber,
          type,
          amount: amountDecimal.toFixed(2),
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
        },
        'Platform Treasury debited successfully'
      );

      return {
        wallet: this.formatWallet(updatedWallet),
        transaction: this.formatTransaction(walletTx),
      };
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * 4. adjustTreasury() (PROMPT 39)
   * Authorized administrative adjustment of platform treasury.
   * Creates an immutable PlatformWalletTransaction with type 'ADJUSTMENT',
   * updates the balance, and records an immutable AuditLog entry with before/after states,
   * reason, and IP metadata.
   */
  public static async adjustTreasury(
    input: {
      adminId: string;
      type: 'CREDIT' | 'DEBIT';
      amount: number | string | Prisma.Decimal;
      reason: string;
      referenceNumber?: string;
      walletCode?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<{
    wallet: PlatformWalletDTO;
    transaction: PlatformWalletTransactionDTO;
  }> {
    if (!input.reason || input.reason.trim().length < 5) {
      throw AppError.badRequest(
        'Adjustment reason is required (minimum 5 characters)',
        'ADJUSTMENT_REASON_REQUIRED'
      );
    }

    const description = `Administrative Adjustment (${input.type}): ${input.reason.trim()}`;
    const metadata = {
      reason: input.reason.trim(),
      referenceNumber: input.referenceNumber?.trim() || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
    };

    if (input.type === 'CREDIT') {
      return this.creditTreasury(
        {
          amount: input.amount,
          type: 'ADJUSTMENT',
          referenceType: 'ADMIN_ADJUSTMENT',
          referenceId: input.referenceNumber?.trim() || null,
          walletCode: input.walletCode,
          description,
          performedById: input.adminId,
          metadata,
        },
        tx
      );
    } else {
      return this.debitTreasury(
        {
          amount: input.amount,
          type: 'ADJUSTMENT',
          referenceType: 'ADMIN_ADJUSTMENT',
          referenceId: input.referenceNumber?.trim() || null,
          walletCode: input.walletCode,
          description,
          performedById: input.adminId,
          metadata,
        },
        tx
      );
    }
  }

  /**
   * 4. getTreasuryTransactions()
   * Retrieves paginated, filterable audit trail of platform wallet transactions.
   */
  public static async getTreasuryTransactions(
    query: GetTreasuryTransactionsQuery = {},
    tx?: Prisma.TransactionClient
  ): Promise<{
    transactions: PlatformWalletTransactionDTO[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const db = tx || prisma;
    const walletCode = query.walletCode || this.DEFAULT_WALLET_CODE;
    const wallet = await this.getOrCreatePlatformWallet(walletCode, db);

    const whereClause: Prisma.PlatformWalletTransactionWhereInput = {
      walletId: wallet.id,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.referenceType ? { referenceType: query.referenceType } : {}),
      ...(query.externalTransactionId ? { externalTransactionId: query.externalTransactionId } : {}),
      ...(query.providerTransactionId ? { providerTransactionId: query.providerTransactionId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, rawTransactions] = await Promise.all([
      db.platformWalletTransaction.count({ where: whereClause }),
      db.platformWalletTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      transactions: rawTransactions.map((t) => this.formatTransaction(t)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 5. reconcileTreasury()
   * Performs an authoritative reconciliation between the PlatformWallet current balance
   * and the mathematical sequence of all immutable PlatformWalletTransactions.
   *
   * Verifies:
   * 1. Total credits vs total debits.
   * 2. Sequential balance continuity (prev.balanceAfter === next.balanceBefore).
   * 3. Current availableBalance equals final ledger balance.
   */
  public static async reconcileTreasury(
    options?: { walletCode?: string },
    tx?: Prisma.TransactionClient
  ): Promise<TreasuryReconciliationReport> {
    const db = tx || prisma;
    const walletCode = options?.walletCode || this.DEFAULT_WALLET_CODE;
    const wallet = await this.getOrCreatePlatformWallet(walletCode, db);

    const currentBalance = SafeDecimal.round(wallet.availableBalance, 2);

    // Fetch all completed transactions sequentially by creation time
    const transactions = await db.platformWalletTransaction.findMany({
      where: {
        walletId: wallet.id,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
    });

    const discrepancies: TreasuryDiscrepancy[] = [];
    let calculatedLedgerBalance = new Prisma.Decimal('0.00');
    let totalCredits = new Prisma.Decimal('0.00');
    let totalDebits = new Prisma.Decimal('0.00');

    let previousBalanceAfter: Prisma.Decimal | null = null;

    // Define which types increment vs decrement treasury liquidity
    const CREDIT_TYPES: PlatformTransactionType[] = ['FUNDING', 'REFUND', 'RECONCILIATION'];
    const DEBIT_TYPES: PlatformTransactionType[] = [
      'FUNDING_REVERSAL',
      'COMMISSION_RESERVE',
      'PAYOUT',
    ];

    for (const t of transactions) {
      const amount = new Prisma.Decimal(t.amount);
      const balanceBefore = new Prisma.Decimal(t.balanceBefore);
      const balanceAfter = new Prisma.Decimal(t.balanceAfter);

      // Verify chain continuity
      if (previousBalanceAfter !== null && !balanceBefore.equals(previousBalanceAfter)) {
        discrepancies.push({
          type: 'BALANCE_MISMATCH',
          severity: 'CRITICAL',
          transactionId: t.id,
          transactionNumber: t.transactionNumber,
          expectedBalance: SafeDecimal.round(previousBalanceAfter, 2),
          actualBalance: SafeDecimal.round(balanceBefore, 2),
          discrepancyAmount: SafeDecimal.round(balanceBefore.sub(previousBalanceAfter), 2),
          details: `Ledger sequence break: Transaction ${t.transactionNumber} balanceBefore (${balanceBefore.toFixed(2)}) does not match preceding balanceAfter (${previousBalanceAfter.toFixed(2)}).`,
        });
      }

      // Track mathematical deltas
      if (balanceAfter.greaterThan(balanceBefore)) {
        const delta = balanceAfter.sub(balanceBefore);
        calculatedLedgerBalance = calculatedLedgerBalance.add(delta);
        totalCredits = totalCredits.add(delta);
      } else if (balanceAfter.lessThan(balanceBefore)) {
        const delta = balanceBefore.sub(balanceAfter);
        calculatedLedgerBalance = calculatedLedgerBalance.sub(delta);
        totalDebits = totalDebits.add(delta);
      }

      // Check negative balance
      if (balanceAfter.lessThan(0)) {
        discrepancies.push({
          type: 'NEGATIVE_BALANCE_VIOLATION',
          severity: 'HIGH',
          transactionId: t.id,
          transactionNumber: t.transactionNumber,
          actualBalance: SafeDecimal.round(balanceAfter, 2),
          details: `Negative treasury balance recorded on transaction ${t.transactionNumber} (${balanceAfter.toFixed(2)}).`,
        });
      }

      previousBalanceAfter = balanceAfter;
    }

    const calculatedBalanceNum = SafeDecimal.round(calculatedLedgerBalance, 2);
    const discrepancy = SafeDecimal.round(
      new Prisma.Decimal(currentBalance).sub(calculatedLedgerBalance),
      2
    );

    if (discrepancy !== 0) {
      discrepancies.push({
        type: 'BALANCE_MISMATCH',
        severity: 'CRITICAL',
        expectedBalance: calculatedBalanceNum,
        actualBalance: currentBalance,
        discrepancyAmount: discrepancy,
        details: `Platform wallet balance (${currentBalance}) does not match accumulated transaction ledger (${calculatedBalanceNum}). Discrepancy: ${discrepancy}.`,
      });
    }

    const isBalanced = discrepancies.length === 0 && discrepancy === 0;

    return {
      walletId: wallet.id,
      walletCode: wallet.walletCode,
      currency: wallet.currency,
      currentBalance,
      calculatedLedgerBalance: calculatedBalanceNum,
      discrepancy,
      isBalanced,
      totalCredits: SafeDecimal.round(totalCredits, 2),
      totalDebits: SafeDecimal.round(totalDebits, 2),
      transactionCount: transactions.length,
      discrepancies,
      reconciledAt: new Date(),
    };
  }
}
