/**
 * Automated Test Suite: Order Commission Lifecycle (Prompt 21)
 *
 * Verifies:
 * 1. "Do not generate commission merely because an order record was created":
 *    - Order in PAYMENT_PENDING state does NOT generate or post commissions.
 * 2. Canonical Lifecycle Flow:
 *    - ORDER CREATED -> PAYMENT PENDING -> PAYMENT SUCCESSFUL ->
 *      ORDER COMMISSION ELIGIBLE -> BV CONFIRMED -> COMMISSION CALCULATED ->
 *      COMMISSION POSTED -> COMMISSION AVAILABLE
 * 3. Business Trigger Rules:
 *    - When triggerPolicy is 'ORDER_DELIVERED', commission posting is held until DELIVERED.
 *    - When triggerPolicy is 'MANUAL_APPROVAL', commission is held until CONFIRMED.
 * 4. Holding Period Support:
 *    - Sets availableAt according to holdingPeriodDays (return/cooling-off window).
 * 5. Disqualification Rules:
 *    - CANCELLED or REFUNDED orders are disqualified.
 *    - Zero BV orders are not eligible.
 * 6. Single Authoritative Function & Strict Idempotency:
 *    - processOrderCommission(orderId)
 *    - Multiple invocations for the exact same order create ONLY ONE commission distribution.
 *    - Subsequent invocations safely return existing distribution with isIdempotentSkip: true.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import {
  OrderCommissionLifecycleService,
  processOrderCommission,
} from '../src/services/orderCommissionLifecycle.service';
import { SponsorUplineService, UplineNode } from '../src/services/sponsorUpline.service';
import { CommissionEligibilityService } from '../src/services/commissionEligibility.service';
import { AppError } from '../src/utils/appError';

describe('ORDER COMMISSION LIFECYCLE ENGINE (PROMPT 21 TEST SUITE)', () => {
  let inMemoryOrders: Map<string, any>;
  let inMemoryPayments: Map<string, any[]>;
  let inMemoryCommissionTx: Map<string, any>;
  let inMemoryWallets: Map<string, any>;
  let inMemoryWalletTx: Map<string, any>;
  let inMemoryDistributors: Map<string, any>;

  const createMockUplineChain = (): UplineNode[] => [
    {
      level: 1,
      distributorId: 'dist-upline-1',
      distributorCode: 'DST-10001',
      displayName: 'Direct Sponsor A',
      status: 'ACTIVE',
      sponsorId: 'dist-upline-2',
      isDirect: true,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 2,
      distributorId: 'dist-upline-2',
      distributorCode: 'DST-10002',
      displayName: 'Second Upline B',
      status: 'ACTIVE',
      sponsorId: 'dist-upline-3',
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 3,
      distributorId: 'dist-upline-3',
      distributorCode: 'DST-10003',
      displayName: 'Third Upline C',
      status: 'ACTIVE',
      sponsorId: 'dist-upline-4',
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 4,
      distributorId: 'dist-upline-4',
      distributorCode: 'DST-10004',
      displayName: 'Fourth Upline D',
      status: 'ACTIVE',
      sponsorId: 'dist-upline-5',
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 5,
      distributorId: 'dist-upline-5',
      distributorCode: 'DST-10005',
      displayName: 'Fifth Upline E',
      status: 'ACTIVE',
      sponsorId: null,
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    OrderCommissionLifecycleService.resetConfig();
    CommissionEligibilityService.resetRuleConfigs();

    inMemoryOrders = new Map();
    inMemoryPayments = new Map();
    inMemoryCommissionTx = new Map();
    inMemoryWallets = new Map();
    inMemoryWalletTx = new Map();
    inMemoryDistributors = new Map();

    // Setup 5 distributor uplines and wallets
    for (let i = 1; i <= 5; i++) {
      const distId = `dist-upline-${i}`;
      const userId = `user-upline-${i}`;
      inMemoryDistributors.set(distId, {
        id: distId,
        userId,
        distributorCode: `DST-1000${i}`,
        firstName: `Leader${i}`,
        lastName: `Patel`,
        status: 'ACTIVE',
      });

      inMemoryWallets.set(distId, {
        id: `wallet-${distId}`,
        distributorId: distId,
        userId,
        availableBalance: new Prisma.Decimal(0),
        pendingBalance: new Prisma.Decimal(0),
        lifetimeEarned: new Prisma.Decimal(0),
        lifetimePaid: new Prisma.Decimal(0),
        currency: 'INR',
        isLocked: false,
      });
    }

    // Setup purchaser profile
    inMemoryDistributors.set('dist-buyer', {
      id: 'dist-buyer',
      userId: 'user-buyer',
      distributorCode: 'DST-BUYER',
      firstName: 'Rahul',
      lastName: 'Kumar',
      status: 'ACTIVE',
    });

    // Mock Prisma transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock row locks
    vi.spyOn(prisma, '$executeRawUnsafe').mockResolvedValue(1 as any);

    // Mock Upline Chain
    vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(createMockUplineChain());

    // Mock prisma.order
    vi.spyOn(prisma.order, 'findUnique').mockImplementation(async (args: any) => {
      const order = inMemoryOrders.get(args.where.id);
      if (!order) return null;
      const payments = inMemoryPayments.get(order.id) || [];
      const distributor = inMemoryDistributors.get(order.distributorId) || null;
      const user = distributor ? { id: distributor.userId, email: 'buyer@test.com' } : null;
      const comms = Array.from(inMemoryCommissionTx.values()).filter((c) => c.orderId === order.id);
      return {
        ...order,
        payments,
        distributor,
        user,
        items: [],
        commissionTransactions: comms,
      };
    });

    // Mock prisma.commissionLevel.findMany to return canonical default rates
    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([
      { id: 'cl-1', levelNumber: 1, percentage: new Prisma.Decimal(24), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cl-2', levelNumber: 2, percentage: new Prisma.Decimal(8), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cl-3', levelNumber: 3, percentage: new Prisma.Decimal(13), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cl-4', levelNumber: 4, percentage: new Prisma.Decimal(5), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cl-5', levelNumber: 5, percentage: new Prisma.Decimal(4), isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    // Mock prisma.distributorProfile
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
      return inMemoryDistributors.get(args.where.id) || null;
    });

    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
      if (args.where?.userId) {
        for (const d of inMemoryDistributors.values()) {
          if (d.userId === args.where.userId) return d;
        }
      }
      return null;
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

    vi.spyOn(prisma.wallet, 'create').mockImplementation(async (args: any) => {
      const wallet = {
        id: `wallet-${args.data.distributorId}`,
        ...args.data,
        availableBalance: new Prisma.Decimal(args.data.availableBalance || 0),
        lifetimeEarned: new Prisma.Decimal(args.data.lifetimeEarned || 0),
      };
      inMemoryWallets.set(args.data.distributorId, wallet);
      return wallet;
    });

    vi.spyOn(prisma.wallet, 'update').mockImplementation(async (args: any) => {
      for (const w of inMemoryWallets.values()) {
        if (w.id === args.where.id) {
          if (args.data.availableBalance !== undefined) {
            w.availableBalance = new Prisma.Decimal(args.data.availableBalance);
          }
          if (args.data.lifetimeEarned?.increment) {
            w.lifetimeEarned = w.lifetimeEarned.add(new Prisma.Decimal(args.data.lifetimeEarned.increment));
          }
          return w;
        }
      }
      return null;
    });

    // Mock prisma.commissionTransaction
    vi.spyOn(prisma.commissionTransaction, 'findMany').mockImplementation(async (args: any) => {
      const orderId = args.where?.orderId;
      let results = Array.from(inMemoryCommissionTx.values());
      if (orderId) {
        results = results.filter((c) => c.orderId === orderId);
      }
      return results.map((c) => {
        const recipient = inMemoryDistributors.get(c.recipientMemberId) || null;
        const walletTransaction = inMemoryWalletTx.get(c.walletTransactionId) || null;
        return {
          ...c,
          recipient,
          walletTransaction,
        };
      });
    });

    vi.spyOn(prisma.commissionTransaction, 'create').mockImplementation(async (args: any) => {
      const id = `comm-${args.data.orderId}-${args.data.commissionLevel}-${Date.now()}`;
      const record = {
        id,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryCommissionTx.set(id, record);
      return record;
    });

    vi.spyOn(prisma.commissionTransaction, 'update').mockImplementation(async (args: any) => {
      const comm = inMemoryCommissionTx.get(args.where.id);
      if (comm) {
        Object.assign(comm, args.data);
      }
      return comm;
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
  // SECTION 1: DO NOT GENERATE COMMISSIONS UPON ORDER CREATION (PAYMENT PENDING)
  // ==========================================================================
  describe('1. Order Creation & Payment Pending Rules', () => {
    it('should NOT generate commission merely because an order was created (status = PAYMENT_PENDING)', async () => {
      const orderId = 'ord-created-1';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-PENDING-001',
        distributorId: 'dist-buyer',
        status: 'PAYMENT_PENDING',
        paidAt: null,
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        {
          id: 'pay-pending-1',
          orderId,
          status: 'PENDING',
          amount: new Prisma.Decimal(10000),
        },
      ]);

      const result = await processOrderCommission(orderId);

      // Verify no commissions were created
      expect(result.lifecycleStage).toBe('PAYMENT_PENDING');
      expect(result.status).toBe('PENDING_STAGE');
      expect(result.isEligible).toBe(false);
      expect(result.commissionsCreated).toBe(0);
      expect(result.totalCommission).toBe(0);
      expect(result.reason).toContain('Payment is pending');
      expect(inMemoryCommissionTx.size).toBe(0);
      expect(inMemoryWalletTx.size).toBe(0);
    });

    it('should hold commissions if payment record is absent and order is PENDING', async () => {
      const orderId = 'ord-no-payment-1';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-DRAFT-001',
        distributorId: 'dist-buyer',
        status: 'PENDING',
        paidAt: null,
        totalBV: new Prisma.Decimal(5000),
        commissionableBusinessVolume: new Prisma.Decimal(5000),
      });

      inMemoryPayments.set(orderId, []);

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('PAYMENT_PENDING');
      expect(result.isEligible).toBe(false);
      expect(result.commissionsCreated).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 2: CANONICAL LIFECYCLE FLOW (PAYMENT SUCCESSFUL -> COMMISSION AVAILABLE)
  // ==========================================================================
  describe('2. Canonical Lifecycle Flow on Payment Confirmation', () => {
    it('should transition through full lifecycle and post commissions when payment succeeds', async () => {
      const orderId = 'ord-paid-success';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-PAID-001',
        distributorId: 'dist-buyer',
        status: 'PAID',
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        {
          id: 'pay-completed-1',
          orderId,
          status: 'COMPLETED',
          amount: new Prisma.Decimal(12000),
          paidAt: new Date(),
        },
      ]);

      const result = await processOrderCommission(orderId);

      // Verify completion of full canonical lifecycle
      expect(result.lifecycleStage).toBe('COMMISSION_AVAILABLE');
      expect(result.status).toBe('SUCCESS');
      expect(result.isEligible).toBe(true);
      expect(result.businessVolume).toBe(10000);
      expect(result.commissionsCreated).toBe(5);
      expect(result.totalCommission).toBe(5400); // 2400 + 800 + 1300 + 500 + 400 = 5400

      // Check all 5 levels created
      expect(result.recipients.length).toBe(5);
      expect(result.recipients[0].level).toBe(1);
      expect(result.recipients[0].percentage).toBe(24);
      expect(result.recipients[0].commissionAmount).toBe(2400);

      expect(result.recipients[1].level).toBe(2);
      expect(result.recipients[1].percentage).toBe(8);
      expect(result.recipients[1].commissionAmount).toBe(800);

      expect(result.recipients[2].level).toBe(3);
      expect(result.recipients[2].percentage).toBe(13);
      expect(result.recipients[2].commissionAmount).toBe(1300);

      expect(result.recipients[3].level).toBe(4);
      expect(result.recipients[3].percentage).toBe(5);
      expect(result.recipients[3].commissionAmount).toBe(500);

      expect(result.recipients[4].level).toBe(5);
      expect(result.recipients[4].percentage).toBe(4);
      expect(result.recipients[4].commissionAmount).toBe(400);

      // Verify wallet credits created
      expect(inMemoryWalletTx.size).toBe(5);
      const level1Wallet = inMemoryWallets.get('dist-upline-1');
      expect(Number(level1Wallet.availableBalance)).toBe(2400);
    });
  });

  // ==========================================================================
  // SECTION 3: BUSINESS RULE TRIGGERS (ORDER DELIVERED / MANUAL APPROVAL)
  // ==========================================================================
  describe('3. Business Rule Triggers (Delivery & Approval Policies)', () => {
    it('should hold commissions if triggerPolicy is ORDER_DELIVERED and order is not yet DELIVERED', async () => {
      OrderCommissionLifecycleService.setConfig({
        triggerPolicy: 'ORDER_DELIVERED',
      });

      const orderId = 'ord-paid-in-transit';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-SHIPPED-001',
        distributorId: 'dist-buyer',
        status: 'SHIPPED', // Paid and shipped, but NOT yet delivered
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-ship-1', orderId, status: 'COMPLETED' },
      ]);

      const result = await processOrderCommission(orderId);

      // Verify commissions held at ORDER_COMMISSION_ELIGIBLE stage
      expect(result.lifecycleStage).toBe('ORDER_COMMISSION_ELIGIBLE');
      expect(result.status).toBe('PENDING_STAGE');
      expect(result.isEligible).toBe(false);
      expect(result.commissionsCreated).toBe(0);
      expect(result.reason).toContain("ORDER_DELIVERED");
      expect(inMemoryCommissionTx.size).toBe(0);
    });

    it('should release commissions when order in ORDER_DELIVERED policy transitions to DELIVERED', async () => {
      OrderCommissionLifecycleService.setConfig({
        triggerPolicy: 'ORDER_DELIVERED',
      });

      const orderId = 'ord-delivered-success';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-DELIVERED-001',
        distributorId: 'dist-buyer',
        status: 'DELIVERED', // Successfully delivered!
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-del-1', orderId, status: 'COMPLETED' },
      ]);

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('COMMISSION_AVAILABLE');
      expect(result.status).toBe('SUCCESS');
      expect(result.commissionsCreated).toBe(5);
      expect(result.totalCommission).toBe(5400);
    });

    it('should hold commissions if triggerPolicy is MANUAL_APPROVAL until order is CONFIRMED', async () => {
      OrderCommissionLifecycleService.setConfig({
        triggerPolicy: 'MANUAL_APPROVAL',
      });

      const orderId = 'ord-paid-unapproved';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-PROCESSING-001',
        distributorId: 'dist-buyer',
        status: 'PROCESSING', // Paid, but not yet administratively confirmed
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-proc-1', orderId, status: 'COMPLETED' },
      ]);

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('ORDER_COMMISSION_ELIGIBLE');
      expect(result.status).toBe('PENDING_STAGE');
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('MANUAL_APPROVAL');
    });
  });

  // ==========================================================================
  // SECTION 4: HOLDING PERIOD / COOLING-OFF WINDOW
  // ==========================================================================
  describe('4. Holding Period / Cooling-Off Window', () => {
    it('should set availableAt according to holdingPeriodDays (return window)', async () => {
      OrderCommissionLifecycleService.setConfig({
        triggerPolicy: 'PAYMENT_CONFIRMED',
        holdingPeriodDays: 14, // 14-day return window
      });

      const orderId = 'ord-holding-period';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-HOLD-001',
        distributorId: 'dist-buyer',
        status: 'PAID',
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-hold-1', orderId, status: 'COMPLETED' },
      ]);

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('COMMISSION_POSTED');
      expect(result.status).toBe('SUCCESS');
      expect(result.availableAt).toBeInstanceOf(Date);

      // Verify availableAt is ~14 days in the future
      const diffDays = Math.round(
        (result.availableAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(14);
    });
  });

  // ==========================================================================
  // SECTION 5: DISQUALIFICATIONS & EDGE CASES
  // ==========================================================================
  describe('5. Disqualifications & Edge Cases', () => {
    it('should disqualify CANCELLED orders from commission distribution', async () => {
      const orderId = 'ord-cancelled-1';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-CANCELLED-001',
        distributorId: 'dist-buyer',
        status: 'CANCELLED',
        totalBV: new Prisma.Decimal(10000),
      });

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('DISQUALIFIED');
      expect(result.status).toBe('DISQUALIFIED');
      expect(result.isEligible).toBe(false);
      expect(result.commissionsCreated).toBe(0);
      expect(result.reason).toContain('cancelled');
    });

    it('should disqualify REFUNDED orders from commission distribution', async () => {
      const orderId = 'ord-refunded-1';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-REFUNDED-001',
        distributorId: 'dist-buyer',
        status: 'REFUNDED',
        totalBV: new Prisma.Decimal(10000),
      });

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('DISQUALIFIED');
      expect(result.status).toBe('DISQUALIFIED');
      expect(result.isEligible).toBe(false);
      expect(result.commissionsCreated).toBe(0);
      expect(result.reason).toContain('refunded');
    });

    it('should reject orders with zero commissionable Business Volume (BV <= 0)', async () => {
      const orderId = 'ord-zero-bv-1';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-ZEROBV-001',
        distributorId: 'dist-buyer',
        status: 'PAID',
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(0),
        commissionableBusinessVolume: new Prisma.Decimal(0),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-zero-1', orderId, status: 'COMPLETED' },
      ]);

      const result = await processOrderCommission(orderId);

      expect(result.lifecycleStage).toBe('BV_CONFIRMED');
      expect(result.status).toBe('NOT_ELIGIBLE');
      expect(result.isEligible).toBe(false);
      expect(result.commissionsCreated).toBe(0);
      expect(result.reason).toContain('zero commissionable Business Volume');
    });
  });

  // ==========================================================================
  // SECTION 6: STRICT IDEMPOTENCY GUARANTEE
  // ==========================================================================
  describe('6. Strict Idempotency Guarantee', () => {
    it('should create ONLY ONE commission distribution when processOrderCommission is called multiple times', async () => {
      const orderId = 'ord-idempotency-check';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-IDEMP-001',
        distributorId: 'dist-buyer',
        status: 'PAID',
        paidAt: new Date(),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-idemp-1', orderId, status: 'COMPLETED' },
      ]);

      // 1. First Call: Creates the commission distribution
      const firstResult = await processOrderCommission(orderId);
      expect(firstResult.status).toBe('SUCCESS');
      expect(firstResult.isIdempotentSkip).toBe(false);
      expect(firstResult.commissionsCreated).toBe(5);
      expect(firstResult.totalCommission).toBe(5400);

      const initialLedgerCount = inMemoryCommissionTx.size;
      const initialWalletTxCount = inMemoryWalletTx.size;
      expect(initialLedgerCount).toBe(5);
      expect(initialWalletTxCount).toBe(5);

      const level1BalanceAfterFirst = Number(inMemoryWallets.get('dist-upline-1').availableBalance);
      expect(level1BalanceAfterFirst).toBe(2400);

      // 2. Second Call: Must NOT create new commissions or double-credit wallets!
      const secondResult = await processOrderCommission(orderId);
      expect(secondResult.status).toBe('ALREADY_PROCESSED');
      expect(secondResult.isIdempotentSkip).toBe(true);
      expect(secondResult.commissionsCreated).toBe(0);
      expect(secondResult.totalCommission).toBe(5400); // Returns existing total
      expect(secondResult.recipients.length).toBe(5);

      // Invariants: zero new records in memory
      expect(inMemoryCommissionTx.size).toBe(initialLedgerCount);
      expect(inMemoryWalletTx.size).toBe(initialWalletTxCount);

      // Invariant: wallet balance unchanged
      const level1BalanceAfterSecond = Number(inMemoryWallets.get('dist-upline-1').availableBalance);
      expect(level1BalanceAfterSecond).toBe(2400);

      // 3. Third Call: Same idempotent guarantee
      const thirdResult = await processOrderCommission(orderId);
      expect(thirdResult.status).toBe('ALREADY_PROCESSED');
      expect(thirdResult.isIdempotentSkip).toBe(true);
      expect(inMemoryCommissionTx.size).toBe(initialLedgerCount);
      expect(inMemoryWalletTx.size).toBe(initialWalletTxCount);
    });
  });

  // ==========================================================================
  // SECTION 7: READ-ONLY LIFECYCLE STATUS INSPECTOR
  // ==========================================================================
  describe('7. Lifecycle Status Inspector', () => {
    it('should inspect lifecycle status accurately without altering database state', async () => {
      const orderId = 'ord-inspect-1';
      inMemoryOrders.set(orderId, {
        id: orderId,
        orderNumber: 'ORD-INSPECT-001',
        distributorId: 'dist-buyer',
        status: 'PAYMENT_PENDING',
        totalBV: new Prisma.Decimal(8000),
      });

      inMemoryPayments.set(orderId, [
        { id: 'pay-insp-1', orderId, status: 'PENDING' },
      ]);

      const inspectResult = await OrderCommissionLifecycleService.getOrderCommissionLifecycleStatus(orderId);

      expect(inspectResult.lifecycleStage).toBe('PAYMENT_PENDING');
      expect(inspectResult.isEligible).toBe(false);
      expect(inspectResult.hasExistingCommissions).toBe(false);
      expect(inMemoryCommissionTx.size).toBe(0);
    });
  });
});
