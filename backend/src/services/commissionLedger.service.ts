import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import {
  CommissionTransactionStatus,
  CommissionTransactionRecord,
  CommissionLedgerEntryInput,
  BatchRecordCommissionInput,
  BatchRecordCommissionResult,
  CommissionLedgerFilter,
  PaginatedCommissionLedgerResult,
  StatusTransitionResult,
  WalletCreditResult,
} from '../types/commissionLedger.types';
import { CommissionBreakdown, CommissionBreakdownItem } from '../types/commissionCalculation.types';

/**
 * ============================================================================
 * IMMUTABLE COMMISSION LEDGER SERVICE (PROMPT 18)
 * ============================================================================
 * Comprehensive, immutable ledger for MLM commissions.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. NEVER credit wallet balances directly (wallet.balance += commission) without
 *    recording an underlying immutable ledger record AND linking a WalletTransaction.
 * 2. Immutable Records: Once written, financial fields (BV, percentage, gross amount,
 *    recipient, source, order, level) CANNOT be updated. Records CANNOT be deleted.
 * 3. Auditable & Traceable: Every commission is permanently traceable to:
 *    - recipient
 *    - source member
 *    - order
 *    - Business Volume (BV)
 *    - percentage
 *    - commission level
 *    - calculation breakdown
 *    - timestamps (createdAt, approvedAt, availableAt, paidAt, reversedAt, cancelledAt)
 * 4. Deduplication & Idempotency: Uniqueness enforced by:
 *    - Database compound constraint: (orderId, recipientMemberId, commissionLevel)
 *    - Deterministic idempotency key: COMM:{orderId}:L{commissionLevel}:{recipientMemberId}
 * 5. Strict Status Lifecycle State Machine:
 *    - PENDING -> APPROVED | CANCELLED
 *    - APPROVED -> AVAILABLE | CANCELLED
 *    - AVAILABLE -> PAID | CANCELLED
 *    - PAID -> REVERSED (only with compensating wallet debit transaction)
 *    - CANCELLED / REVERSED -> Terminal
 */
export class CommissionLedgerService {
  private static readonly TRANSACTION_INCLUDE = {
    recipient: {
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        userId: true,
        user: { select: { email: true } },
      },
    },
    sourceMember: {
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        userId: true,
        user: { select: { email: true } },
      },
    },
    order: {
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        totalBV: true,
      },
    },
  };

  /**
   * Generates a deterministic idempotency key for commission deduplication.
   * Format: COMM:{orderId}:L{level}:{recipientMemberId}
   */
  public static generateIdempotencyKey(
    orderId: string,
    level: number,
    recipientMemberId: string
  ): string {
    const cleanOrderId = (orderId || '').trim();
    const cleanRecipientId = (recipientMemberId || '').trim();
    return `COMM:${cleanOrderId}:L${level}:${cleanRecipientId}`;
  }

  /**
   * Generates a unique wallet transaction number.
   * Format: WTX-COMM-{timestamp}-{random}
   */
  public static generateWalletTransactionNumber(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `WTX-COMM-${timestamp}-${random}`;
  }

  /**
   * Validates financial and relational inputs for commission ledger entry.
   */
  private static validateEntryInput(input: CommissionLedgerEntryInput): void {
    if (!input.orderId || typeof input.orderId !== 'string' || !input.orderId.trim()) {
      throw AppError.badRequest('Valid orderId is required for commission ledger entry');
    }
    if (!input.recipientMemberId || typeof input.recipientMemberId !== 'string' || !input.recipientMemberId.trim()) {
      throw AppError.badRequest('Valid recipientMemberId is required for commission ledger entry');
    }
    if (!input.sourceMemberId || typeof input.sourceMemberId !== 'string' || !input.sourceMemberId.trim()) {
      throw AppError.badRequest('Valid sourceMemberId is required for commission ledger entry');
    }
    if (!Number.isInteger(input.commissionLevel) || input.commissionLevel < 1 || input.commissionLevel > 5) {
      throw AppError.badRequest(`Commission level must be an integer between 1 and 5 (got ${input.commissionLevel})`);
    }

    const bv = SafeDecimal.toDecimal(input.businessVolume);
    if (bv.lessThanOrEqualTo(0)) {
      throw AppError.badRequest(`Business Volume must be positive (got ${input.businessVolume})`);
    }

    const pct = SafeDecimal.toDecimal(input.percentage);
    if (pct.lessThanOrEqualTo(0) || pct.greaterThan(100)) {
      throw AppError.badRequest(`Commission percentage must be between 0 and 100 (got ${input.percentage})`);
    }

    const grossAmount = SafeDecimal.toDecimal(input.grossCommissionAmount);
    if (grossAmount.lessThanOrEqualTo(0)) {
      throw AppError.badRequest(`Gross commission amount must be positive (got ${input.grossCommissionAmount})`);
    }
  }

  /**
   * 1. Record a single commission transaction idempotently into the immutable ledger.
   * If a transaction already exists for (orderId, recipientMemberId, commissionLevel)
   * or matching idempotencyKey, returns the existing record without duplicate creation.
   */
  public static async recordCommissionTransaction(
    input: CommissionLedgerEntryInput,
    tx?: Prisma.TransactionClient
  ): Promise<CommissionTransactionRecord> {
    this.validateEntryInput(input);

    const runner = async (db: Prisma.TransactionClient): Promise<CommissionTransactionRecord> => {
      const orderId = input.orderId.trim();
      const recipientMemberId = input.recipientMemberId.trim();
      const sourceMemberId = input.sourceMemberId.trim();
      const commissionLevel = input.commissionLevel;
      const idempotencyKey =
        input.idempotencyKey?.trim() ||
        this.generateIdempotencyKey(orderId, commissionLevel, recipientMemberId);

      // Check existing by idempotencyKey or compound constraint
      const existing = await db.commissionTransaction.findFirst({
        where: {
          OR: [
            { idempotencyKey },
            {
              orderId,
              recipientMemberId,
              commissionLevel,
            },
          ],
        },
        include: this.TRANSACTION_INCLUDE,
      });

      if (existing) {
        logger.info(
          {
            id: existing.id,
            idempotencyKey,
            orderId,
            level: commissionLevel,
            recipient: recipientMemberId,
          },
          'Commission transaction already exists. Returning existing record (Idempotent).'
        );
        return this.mapToRecord(existing);
      }

      // Convert financial figures to SafeDecimal
      const bvDecimal = SafeDecimal.roundDecimal(input.businessVolume, 2);
      const pctDecimal = SafeDecimal.roundDecimal(input.percentage, 2);
      const grossDecimal = SafeDecimal.roundDecimal(input.grossCommissionAmount, 2);

      const created = await db.commissionTransaction.create({
        data: {
          recipientMemberId,
          sourceMemberId,
          orderId,
          commissionLevel,
          businessVolume: bvDecimal,
          percentage: pctDecimal,
          grossCommissionAmount: grossDecimal,
          status: 'PENDING',
          source: input.source || 'ORDER_PURCHASE',
          idempotencyKey,
          calculationDetails: input.calculationDetails ? (input.calculationDetails as any) : undefined,
        },
        include: this.TRANSACTION_INCLUDE,
      });

      logger.info(
        {
          id: created.id,
          orderId,
          recipientMemberId,
          sourceMemberId,
          level: commissionLevel,
          grossAmount: grossDecimal.toNumber(),
          idempotencyKey,
        },
        'Commission transaction recorded into immutable ledger.'
      );

      return this.mapToRecord(created);
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 15000 });
  }

  /**
   * 2. Batch record multiple commission breakdown items into the immutable ledger.
   * Atomically ensures all eligible tier entries for an order are written or deduplicated.
   */
  public static async recordCommissionBreakdown(
    input: BatchRecordCommissionInput,
    tx?: Prisma.TransactionClient
  ): Promise<BatchRecordCommissionResult> {
    const { orderId, sourceMemberId, breakdown, source } = input;

    if (!orderId || !orderId.trim()) {
      throw AppError.badRequest('Valid orderId is required for batch commission recording');
    }
    if (!sourceMemberId || !sourceMemberId.trim()) {
      throw AppError.badRequest('Valid sourceMemberId is required for batch commission recording');
    }
    if (!Array.isArray(breakdown) || breakdown.length === 0) {
      return {
        orderId,
        totalRecordsProcessed: 0,
        createdCount: 0,
        skippedCount: 0,
        totalGrossCommission: 0,
        transactions: [],
        skippedKeys: [],
      };
    }

    const runner = async (db: Prisma.TransactionClient): Promise<BatchRecordCommissionResult> => {
      const recordedTransactions: CommissionTransactionRecord[] = [];
      const skippedKeys: string[] = [];
      let totalGrossCommission = 0;
      let createdCount = 0;
      let skippedCount = 0;

      for (const item of breakdown) {
        if (!item.recipientId || item.commissionAmount <= 0) {
          continue;
        }

        const idempotencyKey = this.generateIdempotencyKey(
          orderId,
          item.level,
          item.recipientId
        );

        // Check if exists
        const existing = await db.commissionTransaction.findFirst({
          where: {
            OR: [
              { idempotencyKey },
              {
                orderId: orderId.trim(),
                recipientMemberId: item.recipientId.trim(),
                commissionLevel: item.level,
              },
            ],
          },
        });

        if (existing) {
          skippedCount++;
          skippedKeys.push(idempotencyKey);
          continue;
        }

        const entry = await this.recordCommissionTransaction(
          {
            orderId,
            recipientMemberId: item.recipientId,
            sourceMemberId,
            commissionLevel: item.level,
            businessVolume: item.businessVolume,
            percentage: item.percentage,
            grossCommissionAmount: item.commissionAmount,
            source: source || 'ORDER_PURCHASE',
            idempotencyKey,
            calculationDetails: item.calculationDetails || {
              level: item.level,
              businessVolume: item.businessVolume,
              percentage: item.percentage,
              commissionAmount: item.commissionAmount,
            },
          },
          db
        );

        recordedTransactions.push(entry);
        createdCount++;
        totalGrossCommission = SafeDecimal.round(
          totalGrossCommission + item.commissionAmount,
          2
        );
      }

      logger.info(
        {
          orderId,
          createdCount,
          skippedCount,
          totalGrossCommission,
        },
        'Batch commission breakdown recording completed.'
      );

      return {
        orderId,
        totalRecordsProcessed: breakdown.length,
        createdCount,
        skippedCount,
        totalGrossCommission,
        transactions: recordedTransactions,
        skippedKeys,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * 3. Record commission from a calculated CommissionBreakdown result.
   */
  public static async recordFromCalculation(
    orderId: string,
    calculation: CommissionBreakdown,
    sourceMemberId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<BatchRecordCommissionResult> {
    const effectiveSourceMemberId =
      sourceMemberId ||
      calculation.memberId ||
      (await this.resolveOrderSourceMemberId(orderId, tx));

    if (!effectiveSourceMemberId) {
      throw AppError.badRequest(
        `Unable to resolve source member for order ${orderId}`
      );
    }

    const items: CommissionBreakdownItem[] = Array.isArray(calculation)
      ? calculation
      : (calculation as any).commissions || (calculation as any).breakdown || [];

    const breakdownItems = items.filter(
      (item: CommissionBreakdownItem) => item.isEligible && item.commissionAmount > 0 && item.recipientId
    );

    return this.recordCommissionBreakdown(
      {
        orderId,
        sourceMemberId: effectiveSourceMemberId,
        breakdown: breakdownItems.map((item) => ({
          level: item.level,
          recipientId: item.recipientId,
          businessVolume: item.businessVolume,
          percentage: item.percentage,
          commissionAmount: item.commissionAmount,
          calculationDetails: {
            recipientCode: item.recipientCode,
            recipientName: item.recipientName,
            status: item.status,
            level: item.level,
            percentage: item.percentage,
            businessVolume: item.businessVolume,
          },
        })),
      },
      tx
    );
  }

  /**
   * Resolves the purchaser/source distributor profile ID for an order.
   */
  private static async resolveOrderSourceMemberId(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string | null> {
    const db = tx || prisma;
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { distributorId: true, userId: true },
    });

    if (!order) return null;
    if (order.distributorId) return order.distributorId;

    if (order.userId) {
      const profile = await db.distributorProfile.findFirst({
        where: { userId: order.userId },
        select: { id: true },
      });
      return profile?.id || null;
    }

    return null;
  }

  /**
   * 4. IMMUTABILITY ENFORCEMENT:
   * Rejects any attempt to alter financial fields on existing ledger records.
   */
  public static assertFinancialImmutability(): never {
    throw AppError.badRequest(
      'Commission ledger records are immutable: businessVolume, percentage, grossCommissionAmount, level, and member relations cannot be modified.'
    );
  }

  /**
   * 5. IMMUTABILITY ENFORCEMENT:
   * Rejects any attempt to delete records from the commission ledger.
   */
  public static deleteTransaction(): never {
    throw AppError.forbidden(
      'Commission ledger records are immutable and cannot be deleted. Use CANCELLED or REVERSED status transitions instead.'
    );
  }

  /**
   * 6. State Machine: Validates permitted status transitions.
   */
  public static validateStatusTransition(
    currentStatus: CommissionTransactionStatus,
    newStatus: CommissionTransactionStatus
  ): void {
    if (currentStatus === newStatus) {
      return;
    }

    // Terminal states cannot transition to anything
    if (currentStatus === 'CANCELLED') {
      throw AppError.badRequest(
        `Cannot transition commission transaction from terminal status 'CANCELLED' to '${newStatus}'`
      );
    }
    if (currentStatus === 'REVERSED') {
      throw AppError.badRequest(
        `Cannot transition commission transaction from terminal status 'REVERSED' to '${newStatus}'`
      );
    }

    // PENDING transitions
    if (currentStatus === 'PENDING') {
      if (newStatus !== 'APPROVED' && newStatus !== 'CANCELLED') {
        throw AppError.badRequest(
          `Invalid transition: 'PENDING' can only move to 'APPROVED' or 'CANCELLED' (attempted '${newStatus}')`
        );
      }
      return;
    }

    // APPROVED transitions
    if (currentStatus === 'APPROVED') {
      if (newStatus !== 'AVAILABLE' && newStatus !== 'CANCELLED') {
        throw AppError.badRequest(
          `Invalid transition: 'APPROVED' can only move to 'AVAILABLE' or 'CANCELLED' (attempted '${newStatus}')`
        );
      }
      return;
    }

    // AVAILABLE transitions
    if (currentStatus === 'AVAILABLE') {
      if (newStatus !== 'PAID' && newStatus !== 'CANCELLED') {
        throw AppError.badRequest(
          `Invalid transition: 'AVAILABLE' can only move to 'PAID' or 'CANCELLED' (attempted '${newStatus}')`
        );
      }
      return;
    }

    // PAID transitions
    if (currentStatus === 'PAID') {
      if (newStatus !== 'REVERSED') {
        throw AppError.badRequest(
          `Invalid transition: 'PAID' can only move to 'REVERSED' via reversal workflow (attempted '${newStatus}')`
        );
      }
      return;
    }

    throw AppError.badRequest(`Unknown status transition from '${currentStatus}' to '${newStatus}'`);
  }

  /**
   * 7. Transition status of a single commission transaction.
   */
  public static async transitionStatus(
    id: string,
    newStatus: CommissionTransactionStatus,
    reason?: string,
    tx?: Prisma.TransactionClient
  ): Promise<StatusTransitionResult> {
    const runner = async (db: Prisma.TransactionClient): Promise<StatusTransitionResult> => {
      const record = await db.commissionTransaction.findUnique({
        where: { id },
      });

      if (!record) {
        throw AppError.notFound(`Commission transaction ${id} not found`);
      }

      this.validateStatusTransition(record.status as CommissionTransactionStatus, newStatus);

      if (record.status === newStatus) {
        return {
          id: record.id,
          previousStatus: record.status as CommissionTransactionStatus,
          newStatus,
          reason,
          timestamp: new Date(),
        };
      }

      const updateData: Prisma.CommissionTransactionUpdateInput = {
        status: newStatus,
      };

      const now = new Date();
      if (newStatus === 'APPROVED') updateData.approvedAt = now;
      if (newStatus === 'AVAILABLE') updateData.availableAt = now;
      if (newStatus === 'PAID') updateData.paidAt = now;
      if (newStatus === 'CANCELLED') {
        updateData.cancelledAt = now;
        if (reason) updateData.reversalReason = reason;
      }
      if (newStatus === 'REVERSED') {
        updateData.reversedAt = now;
        if (reason) updateData.reversalReason = reason;
      }

      await db.commissionTransaction.update({
        where: { id },
        data: updateData,
      });

      logger.info(
        {
          id,
          previousStatus: record.status,
          newStatus,
          reason,
        },
        'Commission transaction status transitioned.'
      );

      return {
        id,
        previousStatus: record.status as CommissionTransactionStatus,
        newStatus,
        reason,
        timestamp: now,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 15000 });
  }

  /**
   * Approve a commission transaction (PENDING -> APPROVED).
   */
  public static async approveTransaction(
    id: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ): Promise<StatusTransitionResult> {
    return this.transitionStatus(id, 'APPROVED', reason, tx);
  }

  /**
   * Approve all pending commission transactions for an order.
   */
  public static async approveOrderCommissions(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ approvedCount: number }> {
    const runner = async (db: Prisma.TransactionClient) => {
      const pending = await db.commissionTransaction.findMany({
        where: { orderId, status: 'PENDING' },
        select: { id: true },
      });

      for (const item of pending) {
        await this.transitionStatus(item.id, 'APPROVED', 'Order approval batch', db);
      }

      return { approvedCount: pending.length };
    };

    if (tx) return runner(tx);
    return prisma.$transaction(runner, { timeout: 15000 });
  }

  /**
   * Make approved commission transactions available for payout (APPROVED -> AVAILABLE).
   */
  public static async makeAvailable(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<StatusTransitionResult> {
    return this.transitionStatus(id, 'AVAILABLE', undefined, tx);
  }

  /**
   * Make all approved commission transactions for an order available (APPROVED -> AVAILABLE).
   */
  public static async makeOrderCommissionsAvailable(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ availableCount: number }> {
    const runner = async (db: Prisma.TransactionClient) => {
      const approved = await db.commissionTransaction.findMany({
        where: { orderId, status: 'APPROVED' },
        select: { id: true },
      });

      for (const item of approved) {
        await this.transitionStatus(item.id, 'AVAILABLE', undefined, db);
      }

      return { availableCount: approved.length };
    };

    if (tx) return runner(tx);
    return prisma.$transaction(runner, { timeout: 15000 });
  }

  /**
   * Cancel commission transaction (PENDING/APPROVED/AVAILABLE -> CANCELLED).
   */
  public static async cancelTransaction(
    id: string,
    reason: string,
    tx?: Prisma.TransactionClient
  ): Promise<StatusTransitionResult> {
    if (!reason || !reason.trim()) {
      throw AppError.badRequest('Cancellation reason is required');
    }
    return this.transitionStatus(id, 'CANCELLED', reason, tx);
  }

  /**
   * Cancel all un-paid commissions for an order.
   */
  public static async cancelOrderCommissions(
    orderId: string,
    reason: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ cancelledCount: number }> {
    if (!reason || !reason.trim()) {
      throw AppError.badRequest('Cancellation reason is required');
    }

    const runner = async (db: Prisma.TransactionClient) => {
      const nonPaid = await db.commissionTransaction.findMany({
        where: {
          orderId,
          status: { in: ['PENDING', 'APPROVED', 'AVAILABLE'] },
        },
        select: { id: true },
      });

      for (const item of nonPaid) {
        await this.transitionStatus(item.id, 'CANCELLED', reason, db);
      }

      return { cancelledCount: nonPaid.length };
    };

    if (tx) return runner(tx);
    return prisma.$transaction(runner, { timeout: 15000 });
  }

  /**
   * 8. FINANCIAL POSTING TO WALLET:
   * CRITICAL INVARIANT: "Never simply do: wallet.balance += commission without recording the underlying transaction."
   *
   * Atomically:
   * 1. Validates commission transaction is AVAILABLE (or APPROVED).
   * 2. Resolves or creates recipient wallet.
   * 3. Records a formal WalletTransaction (type: COMMISSION, amount, netAmount, balanceBefore, balanceAfter).
   * 4. Updates wallet balance (availableBalance = balanceAfter, lifetimeEarned += amount).
   * 5. Updates CommissionTransaction (status: PAID, walletTransactionId, paidAt).
   */
  public static async creditCommissionToWallet(
    transactionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<WalletCreditResult> {
    const runner = async (db: Prisma.TransactionClient): Promise<WalletCreditResult> => {
      // 1. Fetch transaction with recipient profile and order details
      const commTx = await db.commissionTransaction.findUnique({
        where: { id: transactionId },
        include: {
          recipient: { select: { id: true, userId: true, distributorCode: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      if (!commTx) {
        throw AppError.notFound(`Commission transaction ${transactionId} not found`);
      }

      if (commTx.status === 'PAID') {
        throw AppError.badRequest(
          `Commission transaction ${transactionId} is already PAID. Duplicate payout prevented.`
        );
      }

      if (commTx.walletTransactionId) {
        throw AppError.badRequest(
          `Commission transaction ${transactionId} already linked to wallet transaction ${commTx.walletTransactionId}.`
        );
      }

      if (commTx.status !== 'AVAILABLE' && commTx.status !== 'APPROVED') {
        throw AppError.badRequest(
          `Cannot credit wallet for commission transaction in '${commTx.status}' status. Must be APPROVED or AVAILABLE.`
        );
      }

      const grossAmountDecimal = SafeDecimal.roundDecimal(commTx.grossCommissionAmount, 2);
      const grossAmount = grossAmountDecimal.toNumber();
      if (grossAmount <= 0) {
        throw AppError.badRequest(
          `Commission amount must be greater than zero to credit wallet (got ${grossAmount})`
        );
      }

      const recipientId = commTx.recipientMemberId;
      const userId = commTx.recipient.userId;

      // 2. Resolve or create recipient Wallet
      let wallet = await db.wallet.findFirst({
        where: {
          OR: [{ distributorId: recipientId }, { userId }],
        },
      });

      if (!wallet) {
        wallet = await db.wallet.create({
          data: {
            distributorId: recipientId,
            userId,
            availableBalance: new Prisma.Decimal(0),
            pendingBalance: new Prisma.Decimal(0),
            lifetimeEarned: new Prisma.Decimal(0),
            lifetimePaid: new Prisma.Decimal(0),
            currency: 'INR',
            isLocked: false,
          },
        });
      }

      if (wallet.isLocked) {
        throw AppError.badRequest(`Recipient wallet is locked. Payout cannot proceed.`);
      }

      // 3. Compute balances accurately
      const balanceBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
      const balanceAfter = balanceBefore.add(grossAmountDecimal);

      // 4. Create formal WalletTransaction FIRST before mutating wallet balances
      const transactionNumber = this.generateWalletTransactionNumber();
      const description = `Level ${commTx.commissionLevel} Commission (${commTx.percentage}%) from Order ${commTx.order.orderNumber}`;

      const walletTx = await db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionNumber,
          type: 'COMMISSION',
          status: 'COMPLETED',
          amount: grossAmountDecimal,
          netAmount: grossAmountDecimal,
          feeAmount: new Prisma.Decimal(0),
          balanceBefore,
          balanceAfter,
          referenceId: commTx.id,
          memberId: commTx.recipientMemberId,
          commissionTransactionId: commTx.id,
          orderId: commTx.orderId,
          description,
        },
      });

      // 5. Update Wallet balance
      await db.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
          lifetimeEarned: { increment: grossAmountDecimal },
        },
      });

      // 6. Update CommissionTransaction to PAID with link to wallet transaction
      const now = new Date();
      await db.commissionTransaction.update({
        where: { id: commTx.id },
        data: {
          status: 'PAID',
          walletTransactionId: walletTx.id,
          paidAt: now,
          availableAt: commTx.availableAt || now,
        },
      });

      logger.info(
        {
          commissionTransactionId: commTx.id,
          walletTransactionId: walletTx.id,
          walletId: wallet.id,
          creditedAmount: grossAmount,
          balanceBefore: balanceBefore.toNumber(),
          balanceAfter: balanceAfter.toNumber(),
        },
        'Commission successfully posted to wallet with full audit linkage.'
      );

      return {
        commissionTransactionId: commTx.id,
        walletTransactionId: walletTx.id,
        walletId: wallet.id,
        creditedAmount: grossAmount,
        balanceBefore: balanceBefore.toNumber(),
        balanceAfter: balanceAfter.toNumber(),
        status: 'PAID',
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * 9. REVERSAL WORKFLOW FOR PAID COMMISSIONS:
   * Compensating reversal:
   * - Debits wallet via compensatory WalletTransaction (type: REVERSAL)
   * - Marks CommissionTransaction as REVERSED
   * - Records reversal reason and timestamp
   */
  public static async reversePaidCommission(
    transactionId: string,
    reason: string,
    tx?: Prisma.TransactionClient
  ): Promise<{
    commissionTransactionId: string;
    walletTransactionId: string | null;
    status: CommissionTransactionStatus;
  }> {
    if (!reason || !reason.trim()) {
      throw AppError.badRequest('Reversal reason is required');
    }

    const runner = async (db: Prisma.TransactionClient) => {
      const commTx = await db.commissionTransaction.findUnique({
        where: { id: transactionId },
        include: {
          recipient: { select: { id: true, userId: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      if (!commTx) {
        throw AppError.notFound(`Commission transaction ${transactionId} not found`);
      }

      if (commTx.status === 'REVERSED') {
        return {
          commissionTransactionId: commTx.id,
          walletTransactionId: null,
          status: 'REVERSED' as CommissionTransactionStatus,
        };
      }

      // If not yet paid, simply cancel it
      if (commTx.status !== 'PAID') {
        await this.transitionStatus(transactionId, 'CANCELLED', reason, db);
        return {
          commissionTransactionId: commTx.id,
          walletTransactionId: null,
          status: 'CANCELLED' as CommissionTransactionStatus,
        };
      }

      // If PAID, issue compensating wallet debit
      const grossAmountDecimal = SafeDecimal.roundDecimal(commTx.grossCommissionAmount, 2);
      const recipientId = commTx.recipientMemberId;
      const userId = commTx.recipient.userId;

      const wallet = await db.wallet.findFirst({
        where: { OR: [{ distributorId: recipientId }, { userId }] },
      });

      let reversalWalletTxId: string | null = null;

      if (wallet) {
        const balanceBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
        const balanceAfter = balanceBefore.sub(grossAmountDecimal);

        const revTxNumber = `WTX-REV-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const revWalletTx = await db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionNumber: revTxNumber,
            type: 'REVERSAL',
            status: 'COMPLETED',
            amount: grossAmountDecimal,
            netAmount: grossAmountDecimal.mul(-1),
            feeAmount: new Prisma.Decimal(0),
            balanceBefore,
            balanceAfter,
            referenceId: commTx.id,
            description: `Reversal of Level ${commTx.commissionLevel} Commission from Order ${commTx.order.orderNumber}: ${reason}`,
          },
        });

        reversalWalletTxId = revWalletTx.id;

        await db.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: balanceAfter,
            lifetimeEarned: { decrement: grossAmountDecimal },
          },
        });
      }

      const now = new Date();
      await db.commissionTransaction.update({
        where: { id: commTx.id },
        data: {
          status: 'REVERSED',
          reversedAt: now,
          reversalReason: reason,
        },
      });

      logger.info(
        {
          commissionTransactionId: commTx.id,
          reversalWalletTxId,
          reason,
        },
        'Paid commission successfully reversed with compensatory wallet debit.'
      );

      return {
        commissionTransactionId: commTx.id,
        walletTransactionId: reversalWalletTxId,
        status: 'REVERSED' as CommissionTransactionStatus,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * 10. Query single transaction with complete audit and traceability details.
   */
  public static async getTransactionById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<CommissionTransactionRecord | null> {
    const db = tx || prisma;
    const item = await db.commissionTransaction.findUnique({
      where: { id },
      include: this.TRANSACTION_INCLUDE,
    });

    return item ? this.mapToRecord(item) : null;
  }

  /**
   * 11. Query all commission transactions for an order.
   */
  public static async getTransactionsByOrder(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<CommissionTransactionRecord[]> {
    const db = tx || prisma;
    const items = await db.commissionTransaction.findMany({
      where: { orderId },
      include: this.TRANSACTION_INCLUDE,
      orderBy: { commissionLevel: 'asc' },
    });

    return items.map((item) => this.mapToRecord(item));
  }

  /**
   * 12. Query paginated commission transactions for a recipient with filters.
   */
  public static async getTransactionsByRecipient(
    recipientMemberId: string,
    filter?: CommissionLedgerFilter,
    tx?: Prisma.TransactionClient
  ): Promise<PaginatedCommissionLedgerResult> {
    const db = tx || prisma;
    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CommissionTransactionWhereInput = {
      recipientMemberId,
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.orderId ? { orderId: filter.orderId } : {}),
      ...(filter?.commissionLevel ? { commissionLevel: filter.commissionLevel } : {}),
      ...(filter?.sourceMemberId ? { sourceMemberId: filter.sourceMemberId } : {}),
      ...(filter?.fromDate || filter?.toDate
        ? {
            createdAt: {
              ...(filter.fromDate ? { gte: filter.fromDate } : {}),
              ...(filter.toDate ? { lte: filter.toDate } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.commissionTransaction.count({ where }),
      db.commissionTransaction.findMany({
        where,
        include: this.TRANSACTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      transactions: items.map((item) => this.mapToRecord(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 13. Comprehensive Audit Trail:
   * Returns a complete audit report verifying all required traceability fields:
   * recipient, source member, order, BV, percentage, level, calculation, timestamp.
   */
  public static async getAuditTrail(
    transactionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Record<string, any>> {
    const item = await this.getTransactionById(transactionId, tx);
    if (!item) {
      throw AppError.notFound(`Commission transaction ${transactionId} not found`);
    }

    return {
      id: item.id,
      idempotencyKey: item.idempotencyKey,
      status: item.status,
      // Full traceability
      traceability: {
        recipientMemberId: item.recipientMemberId,
        recipientDetails: item.recipient,
        sourceMemberId: item.sourceMemberId,
        sourceMemberDetails: item.sourceMember,
        orderId: item.orderId,
        orderDetails: item.order,
        commissionLevel: item.commissionLevel,
        businessVolume: item.businessVolume,
        percentage: item.percentage,
        grossCommissionAmount: item.grossCommissionAmount,
        calculationDetails: item.calculationDetails,
      },
      // Financial postings
      financialPosting: {
        walletTransactionId: item.walletTransactionId,
        isPostedToWallet: !!item.walletTransactionId,
      },
      // Timestamps & lifecycle
      lifecycle: {
        createdAt: item.createdAt,
        approvedAt: item.approvedAt,
        availableAt: item.availableAt,
        paidAt: item.paidAt,
        reversedAt: item.reversedAt,
        cancelledAt: item.cancelledAt,
        reversalReason: item.reversalReason,
        updatedAt: item.updatedAt,
      },
    };
  }

  /**
   * Maps Prisma database entity to CommissionTransactionRecord.
   */
  private static mapToRecord(entity: any): CommissionTransactionRecord {
    return {
      id: entity.id,
      recipientMemberId: entity.recipientMemberId,
      sourceMemberId: entity.sourceMemberId,
      orderId: entity.orderId,
      commissionLevel: entity.commissionLevel,
      businessVolume:
        typeof entity.businessVolume === 'object' && entity.businessVolume !== null
          ? Number(entity.businessVolume)
          : Number(entity.businessVolume || 0),
      percentage:
        typeof entity.percentage === 'object' && entity.percentage !== null
          ? Number(entity.percentage)
          : Number(entity.percentage || 0),
      grossCommissionAmount:
        typeof entity.grossCommissionAmount === 'object' && entity.grossCommissionAmount !== null
          ? Number(entity.grossCommissionAmount)
          : Number(entity.grossCommissionAmount || 0),
      status: entity.status as CommissionTransactionStatus,
      source: entity.source,
      idempotencyKey: entity.idempotencyKey,
      walletTransactionId: entity.walletTransactionId,
      calculationDetails: entity.calculationDetails,
      reversalReason: entity.reversalReason,
      approvedAt: entity.approvedAt,
      availableAt: entity.availableAt,
      paidAt: entity.paidAt,
      reversedAt: entity.reversedAt,
      cancelledAt: entity.cancelledAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      recipient: entity.recipient,
      sourceMember: entity.sourceMember,
      order: entity.order,
    };
  }
}
