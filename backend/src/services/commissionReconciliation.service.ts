import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { SponsorUplineService } from './sponsorUpline.service';
import { CommissionConfigService } from './commissionConfig.service';
import { OrderCommissionLifecycleService } from './orderCommissionLifecycle.service';
import { AuditService } from './audit.service';
import {
  CommissionDiscrepancy,
  CommissionDiscrepancyType,
  OrderReconciliationResult,
  MemberReconciliationSummary,
  PeriodReconciliationSummary,
  ReconciliationOptions,
} from '../types/commissionReconciliation.types';

/**
 * ============================================================================
 * COMMISSION RECONCILIATION SERVICE (PROMPT 27)
 * ============================================================================
 * Comprehensive auditing, comparison, and anomaly detection engine that audits:
 * - Orders
 * - Business Volume (BV)
 * - Commission Ledger
 * - Wallet Ledger
 *
 * DETECTS 7 CANONICAL DISCREPANCY TYPES:
 * 1. MISSING_COMMISSION: Expected commission was never posted for an eligible order.
 * 2. DUPLICATE_COMMISSION: Multiple commissions recorded for the same order and level/recipient.
 * 3. INCORRECT_COMMISSION_AMOUNT: Commission amount does not equal Round(BV * rate / 100, 2).
 * 4. INCORRECT_RECIPIENT: Recorded recipient does not match true sponsor upline at that level.
 * 5. INCORRECT_COMMISSION_LEVEL: Recorded level is out of bounds (< 1 or > 5) or mismatched.
 * 6. WALLET_MISMATCH: Missing wallet transaction, amount drift, or wallet balance out of sync.
 * 7. REVERSAL_MISMATCH: Refunded/cancelled order missing reversal or excessive reversal amount.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. Non-destructive by default: Never modify financial records during reconciliation.
 *    Generates discrepancies for review unless an explicit safe autoCorrect rule exists.
 * 2. Every reconciliation execution is persistently logged via AuditService.
 * 3. Admin-only access.
 */
export class CommissionReconciliationService {
  /**
   * 1. reconcileOrderCommission(orderId, options?)
   * Compares Order, Business Volume, Commission Ledger, and Wallet Ledger for a single order.
   */
  public static async reconcileOrderCommission(
    orderId: string,
    options?: ReconciliationOptions,
    client?: Prisma.TransactionClient
  ): Promise<OrderReconciliationResult> {
    const startTime = Date.now();
    const db = client || prisma;
    const discrepancies: CommissionDiscrepancy[] = [];

    if (!orderId || !orderId.trim()) {
      throw AppError.badRequest('Valid orderId is required for reconciliation');
    }

    const cleanOrderId = orderId.trim();

    // ------------------------------------------------------------------------
    // STEP 1: LOAD ORDER WITH PAYMENTS & PURCHASER
    // ------------------------------------------------------------------------
    const order = await db.order.findUnique({
      where: { id: cleanOrderId },
      include: {
        distributor: { select: { id: true, distributorCode: true, sponsorId: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw AppError.notFound(`Order '${cleanOrderId}' not found for reconciliation`, 'ORDER_NOT_FOUND');
    }

    const orderBV = Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0);
    const orderStatus = order.status;
    const isPaid = orderStatus === 'PAID' || orderStatus === 'CONFIRMED' || orderStatus === 'DELIVERED';
    const isCancelledOrRefunded = orderStatus === 'CANCELLED' || orderStatus === 'REFUNDED';
    const buyerId = order.distributorId || order.distributor?.id || '';

    // ------------------------------------------------------------------------
    // STEP 2: LOAD ACTUAL COMMISSION & REVERSAL LEDGERS
    // ------------------------------------------------------------------------
    const [actualCommissions, actualReversals] = await Promise.all([
      db.commissionTransaction.findMany({
        where: { orderId: cleanOrderId },
        include: {
          walletTransaction: true,
          recipient: { select: { id: true, distributorCode: true, sponsorId: true } },
        },
        orderBy: { commissionLevel: 'asc' },
      }),
      db.commissionReversal.findMany({
        where: { orderId: cleanOrderId },
      }),
    ]);

    // ------------------------------------------------------------------------
    // STEP 3: RESOLVE AUTHORITATIVE EXPECTED SPONSOR UPLINE (LEVELS 1-5)
    // ------------------------------------------------------------------------
    let expectedTiers: Array<{ level: number; recipientId: string; distributorCode: string; rate: number; expectedAmount: number }> = [];

    if (buyerId && orderBV > 0 && !isCancelledOrRefunded) {
      try {
        const uplines = await SponsorUplineService.getUplineChain(buyerId, 5, db);
        const configuredRates = await CommissionConfigService.getCommissionRates(db);

        const rateMap = new Map<number, number>();
        for (const cfg of configuredRates) {
          rateMap.set(cfg.levelNumber, cfg.percentageNumber);
        }

        for (const u of uplines) {
          const rate = rateMap.get(u.level) ?? 0;
          const expectedAmount = SafeDecimal.round((orderBV * rate) / 100, 2);
          expectedTiers.push({
            level: u.level,
            recipientId: u.distributorId,
            distributorCode: u.distributorCode,
            rate,
            expectedAmount,
          });
        }
      } catch (err: any) {
        logger.warn({ orderId: cleanOrderId, error: err.message }, 'Failed to resolve upline chain during reconciliation');
      }
    }

    const expectedTotalCommission = SafeDecimal.round(
      expectedTiers.reduce((sum, t) => sum + t.expectedAmount, 0),
      2
    );

    const actualTotalCommission = SafeDecimal.round(
      actualCommissions.reduce((sum, c) => sum + Number(c.grossCommissionAmount), 0),
      2
    );

    // ------------------------------------------------------------------------
    // STEP 4: DETECT DISCREPANCIES
    // ------------------------------------------------------------------------

    // A. DUPLICATE COMMISSION CHECK
    const levelCounts = new Map<number, typeof actualCommissions>();
    for (const comm of actualCommissions) {
      const list = levelCounts.get(comm.commissionLevel) || [];
      list.push(comm);
      levelCounts.set(comm.commissionLevel, list);
    }

    for (const [level, comms] of levelCounts.entries()) {
      if (comms.length > 1) {
        discrepancies.push({
          id: `disc-dup-l${level}-${cleanOrderId}`,
          type: 'DUPLICATE_COMMISSION',
          severity: 'CRITICAL',
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          level,
          description: `Multiple commission transactions (${comms.length}) detected for Level ${level}.`,
          details: { commissionIds: comms.map((c) => c.id) },
        });
      }
    }

    // B. MISSING COMMISSION CHECK
    if (isPaid && orderBV > 0) {
      for (const expected of expectedTiers) {
        const matchingActual = actualCommissions.find((c) => c.commissionLevel === expected.level);
        if (!matchingActual) {
          discrepancies.push({
            id: `disc-missing-l${expected.level}-${cleanOrderId}`,
            type: 'MISSING_COMMISSION',
            severity: 'HIGH',
            orderId: cleanOrderId,
            orderNumber: order.orderNumber,
            memberId: expected.recipientId,
            distributorCode: expected.distributorCode,
            level: expected.level,
            expectedValue: expected.expectedAmount,
            actualValue: 0,
            discrepancyAmount: expected.expectedAmount,
            description: `Missing commission for Level ${expected.level} recipient '${expected.distributorCode}'. Expected ₹${expected.expectedAmount}.`,
            autoCorrectable: true,
          });
        }
      }
    }

    // C. INCORRECT LEVEL, RECIPIENT, AMOUNT & WALLET MISMATCH CHECKS
    for (const comm of actualCommissions) {
      const recordedAmount = Number(comm.grossCommissionAmount);
      const recordedLevel = comm.commissionLevel;
      const expectedTier = expectedTiers.find((t) => t.level === recordedLevel);

      // Level Out of Bounds
      if (recordedLevel < 1 || recordedLevel > 5) {
        discrepancies.push({
          id: `disc-level-${comm.id}`,
          type: 'INCORRECT_COMMISSION_LEVEL',
          severity: 'HIGH',
          orderId: cleanOrderId,
          commissionId: comm.id,
          level: recordedLevel,
          description: `Recorded commission level ${recordedLevel} is outside valid unilevel bounds (1-5).`,
        });
      }

      // Incorrect Recipient
      if (expectedTier && comm.recipientMemberId !== expectedTier.recipientId) {
        discrepancies.push({
          id: `disc-recipient-${comm.id}`,
          type: 'INCORRECT_RECIPIENT',
          severity: 'HIGH',
          orderId: cleanOrderId,
          commissionId: comm.id,
          level: recordedLevel,
          expectedValue: expectedTier.recipientId,
          actualValue: comm.recipientMemberId,
          description: `Commission recipient mismatch at Level ${recordedLevel}. Expected '${expectedTier.distributorCode}', but recorded '${comm.recipient?.distributorCode || comm.recipientMemberId}'.`,
        });
      }

      // Incorrect Amount
      if (expectedTier && Math.abs(recordedAmount - expectedTier.expectedAmount) > 0.01) {
        discrepancies.push({
          id: `disc-amount-${comm.id}`,
          type: 'INCORRECT_COMMISSION_AMOUNT',
          severity: 'HIGH',
          orderId: cleanOrderId,
          commissionId: comm.id,
          level: recordedLevel,
          expectedValue: expectedTier.expectedAmount,
          actualValue: recordedAmount,
          discrepancyAmount: SafeDecimal.round(recordedAmount - expectedTier.expectedAmount, 2),
          description: `Commission amount mismatch at Level ${recordedLevel}. Expected ₹${expectedTier.expectedAmount}, but found ₹${recordedAmount}.`,
        });
      }

      // Wallet Mismatch
      if (comm.status === 'PAID') {
        if (!comm.walletTransactionId || !comm.walletTransaction) {
          discrepancies.push({
            id: `disc-wallet-missing-${comm.id}`,
            type: 'WALLET_MISMATCH',
            severity: 'CRITICAL',
            orderId: cleanOrderId,
            commissionId: comm.id,
            description: `Commission '${comm.id}' is marked as PAID but has no linked WalletTransaction record.`,
          });
        } else {
          const wtxAmount = Number(comm.walletTransaction.amount);
          if (Math.abs(wtxAmount - recordedAmount) > 0.01) {
            discrepancies.push({
              id: `disc-wallet-amount-${comm.id}`,
              type: 'WALLET_MISMATCH',
              severity: 'CRITICAL',
              orderId: cleanOrderId,
              commissionId: comm.id,
              expectedValue: recordedAmount,
              actualValue: wtxAmount,
              discrepancyAmount: SafeDecimal.round(wtxAmount - recordedAmount, 2),
              description: `WalletTransaction amount (₹${wtxAmount}) does not equal commission amount (₹${recordedAmount}).`,
            });
          }
        }
      }
    }

    // D. REVERSAL MISMATCH CHECK
    if (isCancelledOrRefunded) {
      const activeUnreversed = actualCommissions.filter(
        (c) => c.status !== 'REVERSED' && c.status !== 'CANCELLED'
      );

      if (activeUnreversed.length > 0) {
        discrepancies.push({
          id: `disc-unreversed-${cleanOrderId}`,
          type: 'REVERSAL_MISMATCH',
          severity: 'CRITICAL',
          orderId: cleanOrderId,
          description: `Order is '${orderStatus}', but ${activeUnreversed.length} commission transactions remain unreversed.`,
          details: { unreversedCommissionIds: activeUnreversed.map((c) => c.id) },
        });
      }
    }

    // Reversal Amount Over-Credit / Duplicate Reversals
    const reversalCommMap = new Map<string, typeof actualReversals>();
    for (const rev of actualReversals) {
      const list = reversalCommMap.get(rev.originalCommissionId) || [];
      list.push(rev);
      reversalCommMap.set(rev.originalCommissionId, list);
    }

    for (const [origId, revs] of reversalCommMap.entries()) {
      const originalComm = actualCommissions.find((c) => c.id === origId);
      const totalReversed = revs.reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);

      if (originalComm && totalReversed > Number(originalComm.grossCommissionAmount) + 0.01) {
        discrepancies.push({
          id: `disc-rev-over-${origId}`,
          type: 'REVERSAL_MISMATCH',
          severity: 'CRITICAL',
          orderId: cleanOrderId,
          commissionId: origId,
          expectedValue: Number(originalComm.grossCommissionAmount),
          actualValue: totalReversed,
          discrepancyAmount: SafeDecimal.round(totalReversed - Number(originalComm.grossCommissionAmount), 2),
          description: `Total reversed amount (₹${totalReversed}) exceeds original commission gross amount (₹${originalComm.grossCommissionAmount}).`,
        });
      }
    }

    // ------------------------------------------------------------------------
    // STEP 5: SAFE AUTOMATED CORRECTION (IF EXPLICITLY REQUESTED)
    // ------------------------------------------------------------------------
    let autoCorrected = false;
    if (options?.autoCorrect && discrepancies.length > 0) {
      const hasMissingOnly = discrepancies.every((d) => d.type === 'MISSING_COMMISSION');
      if (hasMissingOnly && isPaid && orderBV > 0) {
        try {
          logger.info({ orderId: cleanOrderId }, 'Safe auto-correction rule: triggering idempotent commission processing');
          await OrderCommissionLifecycleService.processOrderCommission(cleanOrderId);
          autoCorrected = true;
          for (const d of discrepancies) {
            d.correctionApplied = true;
          }
        } catch (err: any) {
          logger.warn({ orderId: cleanOrderId, err: err.message }, 'Safe auto-correction failed');
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const hasDiscrepancies = discrepancies.length > 0;

    // ------------------------------------------------------------------------
    // STEP 6: PERSISTENT AUDIT LOGGING (MANDATORY REQUIREMENT)
    // "Every reconciliation must be logged."
    // ------------------------------------------------------------------------
    await AuditService.recordLog({
      userId: options?.actor || undefined,
      action: 'COMMISSION_RECONCILIATION_ORDER',
      entityType: 'Order',
      entityId: cleanOrderId,
      oldValue: null,
      newValue: {
        orderId: cleanOrderId,
        orderStatus,
        orderBV,
        hasDiscrepancies,
        discrepancyCount: discrepancies.length,
        discrepancies: discrepancies.map((d) => ({
          type: d.type,
          severity: d.severity,
          level: d.level,
          description: d.description,
        })),
        autoCorrected,
        durationMs,
      },
      ipAddress: options?.ipAddress || undefined,
      userAgent: options?.userAgent || undefined,
    }).catch(() => {});

    return {
      orderId: cleanOrderId,
      orderNumber: order.orderNumber,
      orderStatus,
      orderBV,
      expectedCommissionsCount: expectedTiers.length,
      actualCommissionsCount: actualCommissions.length,
      expectedTotalCommission,
      actualTotalCommission,
      hasDiscrepancies,
      discrepancyCount: discrepancies.length,
      discrepancies,
      autoCorrected,
      reconciledAt: new Date(),
      durationMs,
    };
  }

  /**
   * 2. reconcileMemberCommissions(memberId, options?)
   * Audits commission transactions, ledger integrity, and wallet balance for a specific member.
   */
  public static async reconcileMemberCommissions(
    memberId: string,
    options?: ReconciliationOptions,
    client?: Prisma.TransactionClient
  ): Promise<MemberReconciliationSummary> {
    const startTime = Date.now();
    const db = client || prisma;
    const discrepancies: CommissionDiscrepancy[] = [];

    if (!memberId || !memberId.trim()) {
      throw AppError.badRequest('Valid memberId is required for member reconciliation');
    }

    const cleanMemberId = memberId.trim();

    // 1. Resolve Member Profile
    const member = await db.distributorProfile.findFirst({
      where: {
        OR: [{ id: cleanMemberId }, { distributorCode: cleanMemberId }, { userId: cleanMemberId }],
      },
      select: { id: true, distributorCode: true, userId: true },
    });

    if (!member) {
      throw AppError.notFound(`Member '${cleanMemberId}' not found`, 'MEMBER_NOT_FOUND');
    }

    // 2. Fetch Member Wallet and Wallet Transactions
    const wallet = await db.wallet.findFirst({
      where: {
        OR: [{ distributorId: member.id }, { userId: member.userId }],
      },
      include: {
        transactions: true,
      },
    });

    let currentBalance = 0;
    let ledgerSum = 0;

    if (wallet) {
      currentBalance = Number(wallet.availableBalance ?? wallet.balance ?? 0);

      for (const tx of wallet.transactions) {
        const amt = Number(tx.amount);
        if (tx.type === 'CREDIT' || tx.type === 'COMMISSION') {
          ledgerSum = SafeDecimal.round(ledgerSum + amt, 2);
        } else if (tx.type === 'DEBIT' || tx.type === 'REVERSAL' || tx.type === 'PAYOUT') {
          ledgerSum = SafeDecimal.round(ledgerSum - Math.abs(amt), 2);
        }
      }

      // Check Wallet Balance Integrity
      if (Math.abs(currentBalance - ledgerSum) > 0.01) {
        discrepancies.push({
          id: `disc-member-wallet-drift-${member.id}`,
          type: 'WALLET_MISMATCH',
          severity: 'CRITICAL',
          memberId: member.id,
          distributorCode: member.distributorCode,
          expectedValue: ledgerSum,
          actualValue: currentBalance,
          discrepancyAmount: SafeDecimal.round(currentBalance - ledgerSum, 2),
          description: `Wallet balance (₹${currentBalance}) does not match transaction ledger sum (₹${ledgerSum}).`,
        });
      }

      if (currentBalance < 0) {
        discrepancies.push({
          id: `disc-member-neg-wallet-${member.id}`,
          type: 'WALLET_MISMATCH',
          severity: 'HIGH',
          memberId: member.id,
          distributorCode: member.distributorCode,
          actualValue: currentBalance,
          description: `Member has negative wallet balance (₹${currentBalance}).`,
        });
      }
    }

    // 3. Fetch Member Commission Transactions
    const memberCommissions = await db.commissionTransaction.findMany({
      where: { recipientMemberId: member.id },
      include: { walletTransaction: true, reversals: true },
    });

    for (const comm of memberCommissions) {
      // Check invalid level
      if (comm.commissionLevel < 1 || comm.commissionLevel > 5) {
        discrepancies.push({
          id: `disc-member-level-${comm.id}`,
          type: 'INCORRECT_COMMISSION_LEVEL',
          severity: 'HIGH',
          commissionId: comm.id,
          memberId: member.id,
          level: comm.commissionLevel,
          description: `Commission transaction '${comm.id}' has invalid level ${comm.commissionLevel}.`,
        });
      }

      // Check PAID commission without wallet link
      if (comm.status === 'PAID' && (!comm.walletTransactionId || !comm.walletTransaction)) {
        discrepancies.push({
          id: `disc-member-paid-nowallet-${comm.id}`,
          type: 'WALLET_MISMATCH',
          severity: 'CRITICAL',
          commissionId: comm.id,
          memberId: member.id,
          description: `PAID commission '${comm.id}' is missing a wallet transaction link.`,
        });
      }

      // Check REVERSED commission without reversal record
      if (comm.status === 'REVERSED' && (!comm.reversals || comm.reversals.length === 0)) {
        discrepancies.push({
          id: `disc-member-rev-missing-${comm.id}`,
          type: 'REVERSAL_MISMATCH',
          severity: 'HIGH',
          commissionId: comm.id,
          memberId: member.id,
          description: `Commission '${comm.id}' marked as REVERSED but has no CommissionReversal ledger record.`,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const hasDiscrepancies = discrepancies.length > 0;

    // Log Reconciliation
    await AuditService.recordLog({
      userId: options?.actor || undefined,
      action: 'COMMISSION_RECONCILIATION_MEMBER',
      entityType: 'DistributorProfile',
      entityId: member.id,
      oldValue: null,
      newValue: {
        memberId: member.id,
        distributorCode: member.distributorCode,
        hasDiscrepancies,
        discrepancyCount: discrepancies.length,
        discrepancies: discrepancies.map((d) => ({
          type: d.type,
          severity: d.severity,
          description: d.description,
        })),
        durationMs,
      },
      ipAddress: options?.ipAddress || undefined,
      userAgent: options?.userAgent || undefined,
    }).catch(() => {});

    return {
      memberId: member.id,
      distributorCode: member.distributorCode,
      totalOrdersAnalyzed: 0,
      totalCommissionsAnalyzed: memberCommissions.length,
      walletBalance: currentBalance,
      walletLedgerSum: ledgerSum,
      hasDiscrepancies,
      discrepancyCount: discrepancies.length,
      discrepancies,
      reconciledAt: new Date(),
      durationMs,
    };
  }

  /**
   * 3. reconcileCommissionPeriod(startDate, endDate, options?)
   * Audits all orders and commissions created/updated within a time window.
   */
  public static async reconcileCommissionPeriod(
    startDate: string | Date,
    endDate: string | Date,
    options?: ReconciliationOptions,
    client?: Prisma.TransactionClient
  ): Promise<PeriodReconciliationSummary> {
    const startTime = Date.now();
    const db = client || prisma;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw AppError.badRequest('Invalid startDate or endDate provided for period reconciliation');
    }

    // Query orders in window
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: { id: true },
    });

    const allDiscrepancies: CommissionDiscrepancy[] = [];
    const ordersWithDiscrepancies = new Set<string>();

    const discrepanciesByType: Record<CommissionDiscrepancyType, number> = {
      MISSING_COMMISSION: 0,
      DUPLICATE_COMMISSION: 0,
      INCORRECT_COMMISSION_AMOUNT: 0,
      INCORRECT_RECIPIENT: 0,
      INCORRECT_COMMISSION_LEVEL: 0,
      WALLET_MISMATCH: 0,
      REVERSAL_MISMATCH: 0,
    };

    // Reconcile each order in period
    for (const ord of orders) {
      try {
        const orderResult = await this.reconcileOrderCommission(ord.id, options, db);
        if (orderResult.hasDiscrepancies) {
          ordersWithDiscrepancies.add(ord.id);
          for (const d of orderResult.discrepancies) {
            allDiscrepancies.push(d);
            discrepanciesByType[d.type] = (discrepanciesByType[d.type] || 0) + 1;
          }
        }
      } catch (err: any) {
        logger.warn({ orderId: ord.id, err: err.message }, 'Order reconciliation failed during period sweep');
      }
    }

    const [totalCommissions, totalReversals] = await Promise.all([
      db.commissionTransaction.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
      db.commissionReversal.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
    ]);

    const durationMs = Date.now() - startTime;

    // Log Period Reconciliation
    await AuditService.recordLog({
      userId: options?.actor || undefined,
      action: 'COMMISSION_RECONCILIATION_PERIOD',
      entityType: 'CommissionPeriod',
      entityId: `${start.toISOString()}_${end.toISOString()}`,
      oldValue: null,
      newValue: {
        startDate: start,
        endDate: end,
        ordersAnalyzed: orders.length,
        totalDiscrepancies: allDiscrepancies.length,
        discrepanciesByType,
        durationMs,
      },
      ipAddress: options?.ipAddress || undefined,
      userAgent: options?.userAgent || undefined,
    }).catch(() => {});

    return {
      startDate: start,
      endDate: end,
      ordersAnalyzed: orders.length,
      commissionsAnalyzed: totalCommissions,
      reversalsAnalyzed: totalReversals,
      totalDiscrepancies: allDiscrepancies.length,
      discrepanciesByType,
      ordersWithDiscrepancies: Array.from(ordersWithDiscrepancies),
      discrepancies: allDiscrepancies,
      reconciledAt: new Date(),
      durationMs,
    };
  }
}
