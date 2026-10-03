/**
 * Automated Test Suite: Commission Reversal System (Prompt 22)
 *
 * Verifies:
 * 1. Immutability Invariant:
 *    - Never delete the original commission transaction.
 *    - Original record remains intact; status is updated to REVERSED.
 *    - Creates compensatory CommissionReversal with negative amount (e.g. -₹2,400).
 * 2. 7-Field Audit Traceability:
 *    - Tracks: originalCommissionId, reversalId, orderId, refundId, amount, reason, timestamp.
 * 3. Partial Refund Support:
 *    - Proportionally computes reversals for partial refunds.
 *    - Enforces cumulative cap: total reversals never exceed original gross commission.
 * 4. Strict Idempotency Guarantee:
 *    - Do not reverse the same commission twice.
 *    - Repeated calls return existing reversal with isIdempotentSkip: true and 0 duplicate debits.
 * 5. Withdrawn Commission & Recovery Policies:
 *    - When funds already withdrawn and wallet has insufficient balance:
 *      - Policy 'REQUIRE_ADMIN_RECONCILIATION' (Default): Recovers available balance down to 0,
 *        flags shortfall in unrecoveredAmount with status PENDING_ADMIN_RECONCILIATION.
 *        Never silently creates money or unaccounted negative balances.
 *      - Policy 'ALLOW_NEGATIVE_BALANCE': Deducts full amount into negative balance when configured.
 * 6. Unpaid Commission Reversals:
 *    - Reversing PENDING/APPROVED commissions sets REVERSED_UNPAID without wallet debit.
 * 7. Admin Reconciliation Management:
 *    - Queries pending reconciliations and resolves deficits with audit trail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { CommissionReversalService } from '../src/services/commissionReversal.service';
import { AppError } from '../src/utils/appError';

describe('COMMISSION REVERSAL SYSTEM (PROMPT 22 TEST SUITE)', () => {
  let inMemoryOrders: Map<string, any>;
  let inMemoryCommissionTx: Map<string, any>;
  let inMemoryReversals: Map<string, any>;
  let inMemoryWallets: Map<string, any>;
  let inMemoryWalletTx: Map<string, any>;
  let inMemoryDistributors: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    CommissionReversalService.resetRecoveryPolicy();

    inMemoryOrders = new Map();
    inMemoryCommissionTx = new Map();
    inMemoryReversals = new Map();
    inMemoryWallets = new Map();
    inMemoryWalletTx = new Map();
    inMemoryDistributors = new Map();

    // 1. Setup mock distributors and wallets
    for (let i = 1; i <= 5; i++) {
      const distId = `dist-upline-${i}`;
      const userId = `user-upline-${i}`;
      inMemoryDistributors.set(distId, {
        id: distId,
        userId,
        distributorCode: `DST-1000${i}`,
        firstName: `Leader${i}`,
        lastName: `Verma`,
      });

      inMemoryWallets.set(distId, {
        id: `wallet-${distId}`,
        distributorId: distId,
        userId,
        availableBalance: new Prisma.Decimal(5000), // Default 5,000 available balance
        pendingBalance: new Prisma.Decimal(0),
        lifetimeEarned: new Prisma.Decimal(5000),
        lifetimePaid: new Prisma.Decimal(0),
        currency: 'INR',
        isLocked: false,
      });
    }

    // 2. Setup mock order (10,000 BV)
    inMemoryOrders.set('ord-rev-100', {
      id: 'ord-rev-100',
      orderNumber: 'ORD-2026-REV',
      status: 'PAID',
      totalAmount: new Prisma.Decimal(12000),
      totalBV: new Prisma.Decimal(10000),
      commissionableBusinessVolume: new Prisma.Decimal(10000),
    });

    // 3. Setup mock paid commissions for ord-rev-100
    // Level 1: 24% = 2,400
    // Level 2: 8% = 800
    // Level 3: 13% = 1,300
    // Level 4: 5% = 500
    // Level 5: 4% = 400
    const rates = [
      { level: 1, pct: 24, amt: 2400 },
      { level: 2, pct: 8, amt: 800 },
      { level: 3, pct: 13, amt: 1300 },
      { level: 4, pct: 5, amt: 500 },
      { level: 5, pct: 4, amt: 400 },
    ];

    rates.forEach((r) => {
      const commId = `comm-tx-${r.level}`;
      const wtxId = `wtx-paid-${r.level}`;
      inMemoryCommissionTx.set(commId, {
        id: commId,
        recipientMemberId: `dist-upline-${r.level}`,
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-rev-100',
        commissionLevel: r.level,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(r.pct),
        grossCommissionAmount: new Prisma.Decimal(r.amt),
        status: 'PAID',
        walletTransactionId: wtxId,
        calculationDetails: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      inMemoryWalletTx.set(wtxId, {
        id: wtxId,
        walletId: `wallet-dist-upline-${r.level}`,
        memberId: `dist-upline-${r.level}`,
        commissionTransactionId: commId,
        orderId: 'ord-rev-100',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(r.amt),
      });
    });

    // 4. Mock Prisma interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock prisma.order
    vi.spyOn(prisma.order, 'findUnique').mockImplementation(async (args: any) => {
      return inMemoryOrders.get(args.where.id) || null;
    });

    // Mock prisma.commissionTransaction
    vi.spyOn(prisma.commissionTransaction, 'findMany').mockImplementation(async (args: any) => {
      const orderId = args.where?.orderId;
      return Array.from(inMemoryCommissionTx.values())
        .filter((c) => !orderId || c.orderId === orderId)
        .map((c) => ({
          ...c,
          recipient: inMemoryDistributors.get(c.recipientMemberId) || { id: c.recipientMemberId },
          walletTransaction: inMemoryWalletTx.get(c.walletTransactionId) || null,
        }));
    });

    vi.spyOn(prisma.commissionTransaction, 'update').mockImplementation(async (args: any) => {
      const comm = inMemoryCommissionTx.get(args.where.id);
      if (comm) {
        Object.assign(comm, args.data);
      }
      return comm;
    });

    // Mock prisma.commissionReversal
    vi.spyOn(prisma.commissionReversal, 'findMany').mockImplementation(async (args: any) => {
      const origId = args.where?.originalCommissionId;
      const orderId = args.where?.orderId;
      const status = args.where?.recoveryStatus;
      return Array.from(inMemoryReversals.values()).filter((r) => {
        if (origId && r.originalCommissionId !== origId) return false;
        if (orderId && r.orderId !== orderId) return false;
        if (status && r.recoveryStatus !== status) return false;
        return true;
      });
    });

    vi.spyOn(prisma.commissionReversal, 'findUnique').mockImplementation(async (args: any) => {
      return inMemoryReversals.get(args.where.id) || null;
    });

    vi.spyOn(prisma.commissionReversal, 'create').mockImplementation(async (args: any) => {
      const id = `rev-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const record = {
        id,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryReversals.set(id, record);
      return record;
    });

    vi.spyOn(prisma.commissionReversal, 'update').mockImplementation(async (args: any) => {
      const rev = inMemoryReversals.get(args.where.id);
      if (rev) {
        Object.assign(rev, args.data);
      }
      return rev;
    });

    // Mock prisma.wallet
    vi.spyOn(prisma.wallet, 'findFirst').mockImplementation(async (args: any) => {
      const orList = args.where?.OR || [];
      for (const cond of orList) {
        if (cond.distributorId && inMemoryWallets.has(cond.distributorId)) {
          return inMemoryWallets.get(cond.distributorId);
        }
      }
      return null;
    });

    vi.spyOn(prisma.wallet, 'update').mockImplementation(async (args: any) => {
      for (const w of inMemoryWallets.values()) {
        if (w.id === args.where.id) {
          if (args.data.availableBalance !== undefined) {
            w.availableBalance = new Prisma.Decimal(args.data.availableBalance);
          }
          if (args.data.lifetimeEarned?.decrement) {
            w.lifetimeEarned = w.lifetimeEarned.sub(new Prisma.Decimal(args.data.lifetimeEarned.decrement));
          }
          return w;
        }
      }
      return null;
    });

    // Mock prisma.walletTransaction
    vi.spyOn(prisma.walletTransaction, 'create').mockImplementation(async (args: any) => {
      const id = `wtx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const record = {
        id,
        ...args.data,
      };
      inMemoryWalletTx.set(id, record);
      return record;
    });
  });

  // ==========================================================================
  // SECTION 1: FULL ORDER CANCELLATION & IMMUTABILITY INVARIANT
  // ==========================================================================
  describe('1. Full Order Cancellation & Immutability Invariant', () => {
    it('should create compensatory reversal transactions (-₹2,400) without deleting original records', async () => {
      const orderId = 'ord-rev-100';

      const result = await CommissionReversalService.reverseOrderCommissions(orderId, {
        reason: 'Customer cancelled order before shipping',
      });

      // Verify 5 reversals created for the 5 levels
      expect(result.totalReversalsCreated).toBe(5);
      expect(result.totalReversedAmount).toBe(5400); // 2400 + 800 + 1300 + 500 + 400
      expect(result.status).toBe('SUCCESS');

      // INVARIANT 1: Original records must NOT be deleted
      expect(inMemoryCommissionTx.size).toBe(5);
      const originalLevel1 = inMemoryCommissionTx.get('comm-tx-1');
      expect(originalLevel1).toBeDefined();
      expect(originalLevel1.status).toBe('REVERSED');
      expect(originalLevel1.reversalReason).toBe('Customer cancelled order before shipping');
      expect(originalLevel1.reversedAt).toBeInstanceOf(Date);

      // INVARIANT 2: Compensatory Commission Reversal has negative amount (-₹2,400)
      const level1Reversal = result.reversals.find((r) => r.commissionLevel === 1);
      expect(level1Reversal).toBeDefined();
      expect(level1Reversal?.reversalAmount).toBe(-2400);
      expect(level1Reversal?.originalAmount).toBe(2400);
      expect(level1Reversal?.recoveryStatus).toBe('COMPLETED');
      expect(level1Reversal?.walletTransactionId).toBeDefined();

      // INVARIANT 3: Verify all 7 prompt-tracked fields
      // - originalCommissionId
      // - reversalId
      // - orderId
      // - refundId
      // - amount
      // - reason
      // - timestamp
      expect(level1Reversal?.originalCommissionId).toBe('comm-tx-1');
      expect(level1Reversal?.reversalId).toBeDefined();
      expect(level1Reversal?.orderId).toBe(orderId);
      expect(level1Reversal?.amount).toBe(-2400);
      expect(level1Reversal?.reason).toBe('Customer cancelled order before shipping');
      expect(level1Reversal?.timestamp).toBeInstanceOf(Date);

      // INVARIANT 4: Wallet debited by ₹2,400 (5,000 - 2,400 = 2,600)
      const walletLevel1 = inMemoryWallets.get('dist-upline-1');
      expect(Number(walletLevel1.availableBalance)).toBe(2600);
    });
  });

  // ==========================================================================
  // SECTION 2: PARTIAL REFUND SUPPORT & CUMULATIVE CAPPING
  // ==========================================================================
  describe('2. Partial Refund Support & Cumulative Capping', () => {
    it('should proportionally reverse commissions for a 50% partial refund', async () => {
      const orderId = 'ord-rev-100';

      // 50% partial refund (5,000 BV of 10,000 BV)
      const result = await CommissionReversalService.reverseOrderCommissions(orderId, {
        refundedBV: 5000,
        refundId: 'ref-part-50',
        isPartialRefund: true,
        reason: 'Returned 1 of 2 items',
      });

      expect(result.isPartial).toBe(true);
      expect(result.totalReversalsCreated).toBe(5);
      expect(result.totalReversedAmount).toBe(2700); // 50% of 5,400

      // Level 1: 50% of 2,400 = 1,200 reversed
      const level1 = result.reversals.find((r) => r.commissionLevel === 1);
      expect(level1?.reversalAmount).toBe(-1200);
      expect(level1?.reversedBV).toBe(5000);

      // Wallet debited by 1,200 (5,000 - 1,200 = 3,800)
      const wallet = inMemoryWallets.get('dist-upline-1');
      expect(Number(wallet.availableBalance)).toBe(3800);

      // Original record is NOT yet fully reversed (remains PAID with partial notes)
      const comm1 = inMemoryCommissionTx.get('comm-tx-1');
      expect(comm1.status).toBe('PAID');
      expect(comm1.calculationDetails.totalReversedAmount).toBe(1200);
      expect(comm1.calculationDetails.isFullyReversed).toBe(false);
    });

    it('should cap cumulative partial reversals so total reversals never exceed original gross commission', async () => {
      const orderId = 'ord-rev-100';

      // 1st Partial Refund: 75% (7,500 BV) -> Reverses 1,800 of Level 1 (2,400)
      await CommissionReversalService.reverseOrderCommissions(orderId, {
        refundedBV: 7500,
        refundId: 'ref-part-1',
        isPartialRefund: true,
      });

      // 2nd Partial Refund: Attempts 50% refund (5,000 BV) -> But only 600 remaining on Level 1!
      const result2 = await CommissionReversalService.reverseOrderCommissions(orderId, {
        refundedBV: 5000,
        refundId: 'ref-part-2',
        isPartialRefund: true,
      });

      const level1Reversal2 = result2.reversals.find((r) => r.commissionLevel === 1);
      expect(level1Reversal2?.reversalAmount).toBe(-600); // Capped at remaining 600

      // Now Level 1 is fully reversed (1,800 + 600 = 2,400)
      const comm1 = inMemoryCommissionTx.get('comm-tx-1');
      expect(comm1.status).toBe('REVERSED');
      expect(comm1.calculationDetails.isFullyReversed).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 3: STRICT IDEMPOTENCY GUARANTEE
  // ==========================================================================
  describe('3. Strict Idempotency Guarantee', () => {
    it('should prevent reversing the exact same refund or cancellation twice', async () => {
      const orderId = 'ord-rev-100';
      const refundId = 'ref-unique-12345';

      // 1st Call: Reverses commissions
      const firstResult = await CommissionReversalService.reverseOrderCommissions(orderId, {
        refundId,
        reason: 'Damaged item return',
      });
      expect(firstResult.totalReversalsCreated).toBe(5);
      expect(firstResult.totalReversedAmount).toBe(5400);

      const reversalsCountAfterFirst = inMemoryReversals.size;
      const walletTxCountAfterFirst = inMemoryWalletTx.size;

      // 2nd Call with same refundId: Must return existing without duplicate records or wallet deductions!
      const secondResult = await CommissionReversalService.reverseOrderCommissions(orderId, {
        refundId,
        reason: 'Damaged item return',
      });

      expect(secondResult.reversals.every((r) => r.isIdempotentSkip)).toBe(true);
      expect(inMemoryReversals.size).toBe(reversalsCountAfterFirst);
      expect(inMemoryWalletTx.size).toBe(walletTxCountAfterFirst);

      // Wallet balance remains 2,600 (not debited a second time!)
      const wallet = inMemoryWallets.get('dist-upline-1');
      expect(Number(wallet.availableBalance)).toBe(2600);
    });
  });

  // ==========================================================================
  // SECTION 4: WITHDRAWN COMMISSIONS & RECOVERY POLICIES
  // ==========================================================================
  describe('4. Withdrawn Commissions & Recovery Policies', () => {
    it('should flag shortfall as PENDING_ADMIN_RECONCILIATION under default recovery policy when funds are withdrawn', async () => {
      // Simulate that dist-upline-1 has ALREADY WITHDRAWN almost all money!
      // Only ₹400 remaining in wallet, but Level 1 reversal is ₹2,400!
      inMemoryWallets.get('dist-upline-1').availableBalance = new Prisma.Decimal(400);

      const result = await CommissionReversalService.reverseOrderCommissions('ord-rev-100', {
        reason: 'Full order refund after customer payout',
      });

      // Overall status requires administrative reconciliation
      expect(result.status).toBe('PENDING_ADMIN_RECONCILIATION');
      expect(result.totalUnrecoveredAmount).toBe(2000); // 2,400 - 400 = 2,000 shortfall

      const level1Reversal = result.reversals.find((r) => r.commissionLevel === 1);
      expect(level1Reversal?.recoveryStatus).toBe('PENDING_ADMIN_RECONCILIATION');
      expect(level1Reversal?.unrecoveredAmount).toBe(2000);

      // INVARIANT: Wallet debited down to 0, NEVER silently creates money or negative balance!
      const wallet = inMemoryWallets.get('dist-upline-1');
      expect(Number(wallet.availableBalance)).toBe(0);
    });

    it('should apply negative balance when ALLOW_NEGATIVE_BALANCE policy is explicitly configured', async () => {
      CommissionReversalService.setRecoveryPolicy('ALLOW_NEGATIVE_BALANCE');

      // Member has 400 available, reversal is 2,400
      inMemoryWallets.get('dist-upline-1').availableBalance = new Prisma.Decimal(400);

      const result = await CommissionReversalService.reverseOrderCommissions('ord-rev-100', {
        reason: 'Authorized negative balance clawback',
      });

      const level1Reversal = result.reversals.find((r) => r.commissionLevel === 1);
      expect(level1Reversal?.recoveryStatus).toBe('NEGATIVE_BALANCE_APPLIED');
      expect(level1Reversal?.unrecoveredAmount).toBe(0);

      // Wallet available balance drops to -2,000 (400 - 2,400 = -2,000)
      const wallet = inMemoryWallets.get('dist-upline-1');
      expect(Number(wallet.availableBalance)).toBe(-2000);
    });
  });

  // ==========================================================================
  // SECTION 5: UNPAID COMMISSION REVERSAL
  // ==========================================================================
  describe('5. Unpaid Commission Reversals (PENDING / APPROVED without wallet credit)', () => {
    it('should reverse PENDING commissions as REVERSED_UNPAID without debiting wallet', async () => {
      // Setup order with PENDING commissions (never paid to wallet)
      const unpaidOrderId = 'ord-unpaid-rev';
      inMemoryOrders.set(unpaidOrderId, {
        id: unpaidOrderId,
        orderNumber: 'ORD-UNPAID',
        totalAmount: new Prisma.Decimal(10000),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryCommissionTx.set('comm-unpaid-1', {
        id: 'comm-unpaid-1',
        recipientMemberId: 'dist-upline-1',
        sourceMemberId: 'dist-buyer',
        orderId: unpaidOrderId,
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PENDING',
        walletTransactionId: null, // Never credited!
        calculationDetails: {},
      });

      const initialWalletBalance = Number(inMemoryWallets.get('dist-upline-1').availableBalance);

      const result = await CommissionReversalService.reverseOrderCommissions(unpaidOrderId, {
        reason: 'Order cancelled before payment clearance',
      });

      expect(result.totalReversalsCreated).toBe(1);
      expect(result.reversals[0].recoveryStatus).toBe('REVERSED_UNPAID');
      expect(result.reversals[0].unrecoveredAmount).toBe(0);

      // Wallet balance was not touched
      expect(Number(inMemoryWallets.get('dist-upline-1').availableBalance)).toBe(initialWalletBalance);
    });
  });

  // ==========================================================================
  // SECTION 6: ADMINISTRATIVE RECONCILIATION RESOLUTION
  // ==========================================================================
  describe('6. Administrative Reconciliation Resolution', () => {
    it('should query pending reconciliations and resolve deficit with audit notes', async () => {
      // 1. Create a shortfall reversal
      inMemoryWallets.get('dist-upline-1').availableBalance = new Prisma.Decimal(0);
      const revSummary = await CommissionReversalService.reverseOrderCommissions('ord-rev-100');

      const shortfallRev = revSummary.reversals.find((r) => r.unrecoveredAmount > 0);
      expect(shortfallRev).toBeDefined();

      // 2. Query pending reconciliations
      const pendingList = await CommissionReversalService.getPendingReconciliations();
      expect(pendingList.length).toBeGreaterThan(0);
      expect(pendingList.some((p) => p.id === shortfallRev?.reversalId)).toBe(true);

      // 3. Resolve reconciliation as administrator (e.g. deducted from offline bank payout)
      const resolved = await CommissionReversalService.resolveAdministrativeReconciliation({
        reversalId: shortfallRev!.reversalId,
        resolutionType: 'DEDUCTED_FROM_PAYOUT',
        notes: 'Clawed back from weekly offline bank payout batch #44',
        adminUserId: 'admin-super',
      });

      expect(resolved.recoveryStatus).toBe('COMPLETED');
      expect(resolved.metadata.resolutionType).toBe('DEDUCTED_FROM_PAYOUT');
      expect(resolved.metadata.resolvedByAdminId).toBe('admin-super');
    });
  });
});
