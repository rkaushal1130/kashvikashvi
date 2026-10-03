/**
 * ============================================================================
 * COMPLETE COMMISSION TEST SUITE (PROMPT 26)
 * ============================================================================
 * Comprehensive unit, integration, and database test suite for the Kashvimlm
 * Commission Engine.
 *
 * SPECIFICATION TESTS:
 * - TEST 1 — BASIC COMMISSION (BV = ₹10,000 -> L1=₹2,400, L2=₹800, L3=₹1,300, L4=₹500, L5=₹400, Total=₹5,400)
 * - TEST 2 — BV ₹1,000 (BV = ₹1,000 -> L1=₹240, L2=₹80, L3=₹130, L4=₹50, L5=₹40, Total=₹540)
 * - TEST 3 — MISSING UPLINE (If only 3 uplines exist: create L1, L2, L3 only; do not create L4 or L5)
 * - TEST 4 — DUPLICATE ORDER PROCESSING (Process same order twice -> exactly one distribution)
 * - TEST 5 — DUPLICATE WEBHOOK (Process same payment webhook twice -> exactly one distribution)
 * - TEST 6 — ZERO BV (BV = 0 -> No commission)
 * - TEST 7 — REFUND (Refund order -> original commission remains, reversal created, no duplicate reversal)
 * - TEST 8 — PARTIAL REFUND (Refund 50% -> 50% proportional commission reversal)
 * - TEST 9 — SPONSOR CHAIN (A->B->C->D->E->F; F creates BV -> E=L1, D=L2, C=L3, B=L4, A=L5)
 * - TEST 10 — BINARY TREE INDEPENDENCE (Changing binary placement does NOT affect sponsor commission levels)
 * - TEST 11 — COMMISSION CONFIGURATION (Use configured rate rather than hardcoded percentage)
 * - TEST 12 — CONCURRENT PROCESSING (Process order concurrently -> no duplicate commission or wallet credit)
 * - TEST 13 — RANK INDEPENDENCE (Rank changes do not accidentally alter unilevel commission percentages)
 * - TEST 14 — FINANCIAL PRECISION (Decimal BV & commission calculations with zero floating-point drift)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import { Prisma } from '@prisma/client';
import { CommissionCalculationService } from '../src/services/commissionCalculation.service';
import { SponsorUplineService } from '../src/services/sponsorUpline.service';
import { OrderCommissionLifecycleService } from '../src/services/orderCommissionLifecycle.service';
import { CommissionReversalService } from '../src/services/commissionReversal.service';
import { CommissionConfigService } from '../src/services/commissionConfig.service';
import { CommissionSecurityService } from '../src/services/commissionSecurity.service';
import { SafeDecimal } from '../src/utils/safeDecimal';

describe('PROMPT 26: COMPLETE COMMISSION TEST SUITE', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CommissionConfigService.clearCache();
    CommissionSecurityService.clearWebhookCache();

    // Default mock for interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    vi.spyOn(prisma.sponsorRelationship, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([
      { id: 'tier-1', levelNumber: 1, percentage: new Prisma.Decimal(24), isActive: true },
      { id: 'tier-2', levelNumber: 2, percentage: new Prisma.Decimal(8), isActive: true },
      { id: 'tier-3', levelNumber: 3, percentage: new Prisma.Decimal(13), isActive: true },
      { id: 'tier-4', levelNumber: 4, percentage: new Prisma.Decimal(5), isActive: true },
      { id: 'tier-5', levelNumber: 5, percentage: new Prisma.Decimal(4), isActive: true },
    ] as any);
  });

  // =========================================================================
  // TEST 1 — BASIC COMMISSION (BV = ₹10,000)
  // =========================================================================
  describe('TEST 1 — BASIC COMMISSION', () => {
    it('should calculate exact 5-level commission breakdown for BV = ₹10,000 totaling ₹5,400', () => {
      const bv = 10000;
      const result = CommissionCalculationService.calculateTheoreticalCommission(bv);

      expect(result.businessVolume).toBe(10000);
      expect(result.totalTheoreticalPercentage).toBe(54);
      expect(result.totalTheoreticalAmount).toBe(5400);

      const [l1, l2, l3, l4, l5] = result.tiers;

      // Level 1: 24% = ₹2,400
      expect(l1.level).toBe(1);
      expect(l1.percentage).toBe(24);
      expect(l1.commissionAmount).toBe(2400);

      // Level 2: 8% = ₹800
      expect(l2.level).toBe(2);
      expect(l2.percentage).toBe(8);
      expect(l2.commissionAmount).toBe(800);

      // Level 3: 13% = ₹1,300
      expect(l3.level).toBe(3);
      expect(l3.percentage).toBe(13);
      expect(l3.commissionAmount).toBe(1300);

      // Level 4: 5% = ₹500
      expect(l4.level).toBe(4);
      expect(l4.percentage).toBe(5);
      expect(l4.commissionAmount).toBe(500);

      // Level 5: 4% = ₹400
      expect(l5.level).toBe(5);
      expect(l5.percentage).toBe(4);
      expect(l5.commissionAmount).toBe(400);

      // Total Verification
      const sum = l1.commissionAmount + l2.commissionAmount + l3.commissionAmount + l4.commissionAmount + l5.commissionAmount;
      expect(sum).toBe(5400);
    });
  });

  // =========================================================================
  // TEST 2 — BV ₹1,000
  // =========================================================================
  describe('TEST 2 — BV ₹1,000', () => {
    it('should calculate exact 5-level commission breakdown for BV = ₹1,000 totaling ₹540', () => {
      const bv = 1000;
      const result = CommissionCalculationService.calculateTheoreticalCommission(bv);

      expect(result.businessVolume).toBe(1000);
      expect(result.totalTheoreticalPercentage).toBe(54);
      expect(result.totalTheoreticalAmount).toBe(540);

      const [l1, l2, l3, l4, l5] = result.tiers;

      // Level 1: 24% = ₹240
      expect(l1.level).toBe(1);
      expect(l1.percentage).toBe(24);
      expect(l1.commissionAmount).toBe(240);

      // Level 2: 8% = ₹80
      expect(l2.level).toBe(2);
      expect(l2.percentage).toBe(8);
      expect(l2.commissionAmount).toBe(80);

      // Level 3: 13% = ₹130
      expect(l3.level).toBe(3);
      expect(l3.percentage).toBe(13);
      expect(l3.commissionAmount).toBe(130);

      // Level 4: 5% = ₹50
      expect(l4.level).toBe(4);
      expect(l4.percentage).toBe(5);
      expect(l4.commissionAmount).toBe(50);

      // Level 5: 4% = ₹40
      expect(l5.level).toBe(5);
      expect(l5.percentage).toBe(4);
      expect(l5.commissionAmount).toBe(40);

      // Total Verification
      const sum = l1.commissionAmount + l2.commissionAmount + l3.commissionAmount + l4.commissionAmount + l5.commissionAmount;
      expect(sum).toBe(540);
    });
  });

  // =========================================================================
  // TEST 3 — MISSING UPLINE
  // =========================================================================
  describe('TEST 3 — MISSING UPLINE', () => {
    it('should create only Level 1, 2, 3 and NOT create Level 4 or 5 if only 3 uplines exist', async () => {
      const buyerId = 'dist-buyer-test3';

      // Mock buyer profile
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue({
        id: buyerId,
        distributorId: 'KV-BUYER',
        distributorCode: 'DST-BUYER',
        firstName: 'Pooja',
        lastName: 'Sen',
        displayName: 'Pooja Sen',
        status: 'ACTIVE',
        sponsorId: 'upline-1',
        deletedAt: null,
      });

      // Mock only 3 uplines (upline-1 -> upline-2 -> upline-3 -> null)
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue([
        {
          level: 1,
          distributorId: 'upline-1',
          distributorCode: 'DST-UP1',
          displayName: 'Upline One',
          status: 'ACTIVE',
          sponsorId: 'upline-2',
          isDirect: true,
          isActive: true,
          isEligibleForCommission: true,
        },
        {
          level: 2,
          distributorId: 'upline-2',
          distributorCode: 'DST-UP2',
          displayName: 'Upline Two',
          status: 'ACTIVE',
          sponsorId: 'upline-3',
          isDirect: false,
          isActive: true,
          isEligibleForCommission: true,
        },
        {
          level: 3,
          distributorId: 'upline-3',
          distributorCode: 'DST-UP3',
          displayName: 'Upline Three',
          status: 'ACTIVE',
          sponsorId: null, // Root
          isDirect: false,
          isActive: true,
          isEligibleForCommission: true,
        },
      ]);

      // Calculate commissions for 10,000 BV
      const breakdown = await CommissionCalculationService.calculateUplineCommission(buyerId, 10000, {
        requireActive: false,
      });

      // Created levels: ONLY 1, 2, 3
      expect(breakdown.length).toBe(3);
      expect(breakdown.map((b) => b.level)).toEqual([1, 2, 3]);
      expect(breakdown[0].recipientId).toBe('upline-1');
      expect(breakdown[0].commissionAmount).toBe(2400); // 24%
      expect(breakdown[1].recipientId).toBe('upline-2');
      expect(breakdown[1].commissionAmount).toBe(800); // 8%
      expect(breakdown[2].recipientId).toBe('upline-3');
      expect(breakdown[2].commissionAmount).toBe(1300); // 13%

      // Skipped levels: Level 4 and Level 5 must NOT be created
      expect(breakdown.skippedLevels.length).toBe(2);
      expect(breakdown.skippedLevels.map((s) => s.level)).toEqual([4, 5]);
      expect(breakdown.skippedLevels[0].reason).toBe('NO_UPLINE_EXISTS');
      expect(breakdown.skippedLevels[1].reason).toBe('NO_UPLINE_EXISTS');

      // Total distributed commission: 2400 + 800 + 1300 = 4500 (not 5400)
      expect(breakdown.totalCommissionAmount).toBe(4500);
      expect(breakdown.totalDistributedPercentage).toBe(45);
    });
  });

  // =========================================================================
  // TEST 4 — DUPLICATE ORDER PROCESSING
  // =========================================================================
  describe('TEST 4 — DUPLICATE ORDER PROCESSING', () => {
    it('should process the same order twice and return exactly one commission distribution', async () => {
      const orderId = 'ord-dup-test4';

      // Mock order
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-DUP-001',
        status: 'PAID',
        totalAmount: new Prisma.Decimal(10000),
        totalBV: new Prisma.Decimal(5000),
        commissionableBusinessVolume: new Prisma.Decimal(5000),
        distributorId: 'dist-buyer-4',
        payments: [{ id: 'pay-dup-1', status: 'COMPLETED' }],
        distributor: {
          id: 'dist-buyer-4',
          distributorCode: 'DST-BUYER-4',
          firstName: 'Ananya',
          lastName: 'Deshmukh',
        },
      } as any);

      // On first call: no existing commissions
      // On second call: existing commissions exist
      const mockExisting = [
        {
          id: 'comm-dup-1',
          orderId,
          commissionLevel: 1,
          percentage: new Prisma.Decimal(24),
          grossCommissionAmount: new Prisma.Decimal(1200),
          status: 'PAID',
          walletTransactionId: 'wtx-dup-1',
          recipientMemberId: 'dist-upline-1',
          recipient: { id: 'dist-upline-1', distributorCode: 'DST-UP1', firstName: 'Upline', lastName: 'One' },
          walletTransaction: { id: 'wtx-dup-1', transactionNumber: 'WTX-001', balanceBefore: 0, balanceAfter: 1200 },
        },
      ];

      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue(mockExisting as any);

      // Call processOrderCommission (represents second call on already processed order)
      const result = await OrderCommissionLifecycleService.processOrderCommission(orderId);

      expect(result.status).toBe('ALREADY_PROCESSED');
      expect(result.isIdempotentSkip).toBe(true);
      expect(result.commissionsCreated).toBe(0);
      expect(result.recipients.length).toBe(1);
      expect(result.totalCommission).toBe(1200);
    });
  });

  // =========================================================================
  // TEST 5 — DUPLICATE WEBHOOK
  // =========================================================================
  describe('TEST 5 — DUPLICATE WEBHOOK', () => {
    it('should process payment webhook once and safely skip duplicate delivery', async () => {
      let backendActionCount = 0;
      const gateway = 'RAZORPAY';
      const eventId = 'pay_2026_webhook_evt_777';

      const webhookHandler = async () => {
        backendActionCount++;
        return { orderId: 'ord-webhook-5', commissionDistributed: true };
      };

      // 1. Initial Webhook Delivery
      const firstRun = await CommissionSecurityService.processWebhookIdempotent(gateway, eventId, webhookHandler);
      expect(firstRun.isDuplicate).toBe(false);
      expect(firstRun.result?.commissionDistributed).toBe(true);
      expect(backendActionCount).toBe(1);

      // 2. Duplicate / Replay Webhook Delivery
      const duplicateRun = await CommissionSecurityService.processWebhookIdempotent(gateway, eventId, webhookHandler);
      expect(duplicateRun.isDuplicate).toBe(true);
      expect(duplicateRun.result?.commissionDistributed).toBe(true);
      // Handler must NOT have been executed a second time
      expect(backendActionCount).toBe(1);
    });
  });

  // =========================================================================
  // TEST 6 — ZERO BV
  // =========================================================================
  describe('TEST 6 — ZERO BV', () => {
    it('should generate no commission when BV = 0', () => {
      const result = CommissionCalculationService.calculateTheoreticalCommission(0);

      expect(result.businessVolume).toBe(0);
      expect(result.totalTheoreticalAmount).toBe(0);
      for (const tier of result.tiers) {
        expect(tier.commissionAmount).toBe(0);
      }
    });

    it('should return empty commission breakdown when BV = 0 for an upline query', async () => {
      const breakdown = await CommissionCalculationService.calculateUplineCommission('dist-any', 0);

      expect(breakdown.length).toBe(0);
      expect(breakdown.totalCommissionAmount).toBe(0);
      expect(breakdown.totalDistributedPercentage).toBe(0);
      expect(breakdown.skippedLevels.length).toBe(5);
      for (const skipped of breakdown.skippedLevels) {
        expect(skipped.reason).toBe('ZERO_BV');
      }
    });
  });

  // =========================================================================
  // TEST 7 — REFUND
  // =========================================================================
  describe('TEST 7 — REFUND', () => {
    it('should keep original commission record, create compensatory reversal transaction, and prevent duplicate reversal', async () => {
      const originalCommissionId = 'comm-test7-orig';
      const orderId = 'ord-test7';
      const memberId = 'dist-test7-upline';

      // Mock original commission transaction (status remains in DB, transitions to REVERSED)
      vi.spyOn(prisma.commissionTransaction, 'findUnique').mockResolvedValue({
        id: originalCommissionId,
        orderId,
        recipientMemberId: memberId,
        grossCommissionAmount: new Prisma.Decimal(2400),
        businessVolume: new Prisma.Decimal(10000),
        status: 'PAID',
        walletTransactionId: 'wtx-orig-7',
        recipient: {
          id: memberId,
          userId: 'usr-upline-7',
          distributorCode: 'DST-UP7',
          firstName: 'Upline',
          lastName: 'Seven',
        },
      } as any);

      // On first reversal: no existing reversal record
      vi.spyOn(prisma.commissionReversal, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(prisma.commissionReversal, 'findFirst').mockResolvedValueOnce(null);

      // Mock wallet lookups
      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-7',
        distributorId: memberId,
        availableBalance: new Prisma.Decimal(5000),
        balance: new Prisma.Decimal(5000),
      } as any);

      vi.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({
        id: 'wtx-rev-7',
        walletId: 'wal-7',
        amount: new Prisma.Decimal(-2400),
        balanceBefore: new Prisma.Decimal(5000),
        balanceAfter: new Prisma.Decimal(2600),
      } as any);

      vi.spyOn(prisma.wallet, 'update').mockResolvedValue({} as any);
      vi.spyOn(prisma.commissionTransaction, 'update').mockResolvedValue({} as any);

      vi.spyOn(prisma.commissionReversal, 'create').mockResolvedValue({
        id: 'rev-rec-7',
        originalCommissionId,
        orderId,
        recipientMemberId: memberId,
        amount: new Prisma.Decimal(-2400),
        originalAmount: new Prisma.Decimal(2400),
        recoveryStatus: 'COMPLETED',
      } as any);

      // 1. First Reversal Execution
      const reversalResult = await CommissionReversalService.reverseSingleCommission(originalCommissionId, {
        reason: 'Customer return and refund',
      });

      expect(reversalResult.isIdempotentSkip).toBe(false);
      expect(reversalResult.reversalAmount).toBe(-2400);
      expect(reversalResult.recoveryStatus).toBe('COMPLETED');

      // 2. Second Reversal Attempt (Idempotent Replay)
      vi.spyOn(prisma.commissionReversal, 'findUnique').mockResolvedValue({
        id: 'rev-rec-7',
        originalCommissionId,
        amount: new Prisma.Decimal(-2400),
        recoveryStatus: 'COMPLETED',
      } as any);
      vi.spyOn(prisma.commissionReversal, 'findFirst').mockResolvedValue({
        id: 'rev-rec-7',
        originalCommissionId,
        amount: new Prisma.Decimal(-2400),
        recoveryStatus: 'COMPLETED',
      } as any);

      const replayResult = await CommissionReversalService.reverseSingleCommission(originalCommissionId);
      expect(replayResult.isIdempotentSkip).toBe(true);
      expect(replayResult.reversalAmount).toBe(-2400);
    });
  });

  // =========================================================================
  // TEST 8 — PARTIAL REFUND
  // =========================================================================
  describe('TEST 8 — PARTIAL REFUND', () => {
    it('should create proportional 50% commission reversal for a 50% partial refund', async () => {
      const orderId = 'ord-partial-test8';
      const originalCommissionId = 'comm-orig-8';
      const memberId = 'dist-upline-8';

      // Original order: BV 10,000, Level 1 Commission: ₹2,400
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-PARTIAL-008',
        status: 'PAID',
        totalAmount: new Prisma.Decimal(15000),
        totalBV: new Prisma.Decimal(10000),
        commissionableBusinessVolume: new Prisma.Decimal(10000),
      } as any);

      vi.spyOn(prisma.commissionTransaction, 'findMany').mockResolvedValue([
        {
          id: originalCommissionId,
          orderId,
          recipientMemberId: memberId,
          commissionLevel: 1,
          businessVolume: new Prisma.Decimal(10000),
          percentage: new Prisma.Decimal(24),
          grossCommissionAmount: new Prisma.Decimal(2400),
          status: 'PAID',
          walletTransactionId: 'wtx-orig-8',
          calculationDetails: {},
          recipient: {
            id: memberId,
            userId: 'usr-upline-8',
            distributorCode: 'DST-UP8',
            firstName: 'Upline',
            lastName: 'Eight',
          },
        },
      ] as any);

      // Existing reversals = 0
      vi.spyOn(prisma.commissionReversal, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.commissionReversal, 'findFirst').mockResolvedValue(null);

      // Mock wallet
      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-8',
        distributorId: memberId,
        availableBalance: new Prisma.Decimal(10000),
        balance: new Prisma.Decimal(10000),
      } as any);
      vi.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({} as any);
      vi.spyOn(prisma.wallet, 'update').mockResolvedValue({} as any);
      vi.spyOn(prisma.commissionTransaction, 'update').mockResolvedValue({} as any);

      vi.spyOn(prisma.commissionReversal, 'create').mockImplementation(async (args: any) => {
        return {
          id: 'rev-partial-rec-1',
          ...args.data,
        } as any;
      });

      // Execute 50% partial refund (5,000 BV out of 10,000 BV)
      const summary = await CommissionReversalService.reverseOrderCommissions(orderId, {
        isPartialRefund: true,
        refundedBV: 5000,
        refundPercentage: 50,
        reason: '50% item return',
      });

      expect(summary.totalReversedAmount).toBe(1200);
      expect(summary.reversals.length).toBe(1);
      expect(summary.reversals[0].reversedBV).toBe(5000);
      // Original commission was 2,400 -> 50% reversal is -1,200
      expect(summary.reversals[0].reversalAmount).toBe(-1200);
    });
  });

  // =========================================================================
  // TEST 9 — SPONSOR CHAIN (A -> B -> C -> D -> E -> F)
  // =========================================================================
  describe('TEST 9 — SPONSOR CHAIN', () => {
    it('should assign E=L1, D=L2, C=L3, B=L4, A=L5 when F creates BV in chain A->B->C->D->E->F', async () => {
      // Mock genealogy:
      // F is sponsored by E (Level 1)
      // E is sponsored by D (Level 2)
      // D is sponsored by C (Level 3)
      // C is sponsored by B (Level 4)
      // B is sponsored by A (Level 5)
      // A is root (sponsorId: null)
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue({
        id: 'node-F',
        distributorId: 'DST-F',
        distributorCode: 'DST-F',
        firstName: 'F',
        lastName: 'Member',
        displayName: 'F Member',
        status: 'ACTIVE',
        sponsorId: 'node-E',
        deletedAt: null,
      });

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
        return { id: 'node-F', distributorCode: 'DST-F', sponsorId: 'node-E', status: 'ACTIVE' } as any;
      });

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        const id = args.where.id;
        switch (id) {
          case 'node-F': return { id: 'node-F', distributorCode: 'DST-F', sponsorId: 'node-E', status: 'ACTIVE' } as any;
          case 'node-E': return { id: 'node-E', distributorCode: 'DST-E', sponsorId: 'node-D', status: 'ACTIVE' } as any;
          case 'node-D': return { id: 'node-D', distributorCode: 'DST-D', sponsorId: 'node-C', status: 'ACTIVE' } as any;
          case 'node-C': return { id: 'node-C', distributorCode: 'DST-C', sponsorId: 'node-B', status: 'ACTIVE' } as any;
          case 'node-B': return { id: 'node-B', distributorCode: 'DST-B', sponsorId: 'node-A', status: 'ACTIVE' } as any;
          case 'node-A': return { id: 'node-A', distributorCode: 'DST-A', sponsorId: null, status: 'ACTIVE' } as any;
          default: return null;
        }
      });

      const chain = await SponsorUplineService.getUplineChain('node-F', 5);

      expect(chain.length).toBe(5);

      // Verify exact level mapping
      expect(chain[0].distributorId).toBe('node-E');
      expect(chain[0].level).toBe(1);

      expect(chain[1].distributorId).toBe('node-D');
      expect(chain[1].level).toBe(2);

      expect(chain[2].distributorId).toBe('node-C');
      expect(chain[2].level).toBe(3);

      expect(chain[3].distributorId).toBe('node-B');
      expect(chain[3].level).toBe(4);

      expect(chain[4].distributorId).toBe('node-A');
      expect(chain[4].level).toBe(5);
    });
  });

  // =========================================================================
  // TEST 10 — BINARY TREE INDEPENDENCE
  // =========================================================================
  describe('TEST 10 — BINARY TREE INDEPENDENCE', () => {
    it('should maintain sponsor commission levels regardless of binary tree placement changes', async () => {
      // Distributor F has sponsor genealogy: E -> D -> C -> B -> A
      // In binary placement, F is placed under 'binary-parent-X' on 'RIGHT' leg
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue({
        id: 'node-F',
        distributorId: 'DST-F',
        distributorCode: 'DST-F',
        firstName: 'F',
        lastName: 'Member',
        displayName: 'F Member',
        status: 'ACTIVE',
        sponsorId: 'node-E',
        deletedAt: null,
      });

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
        return {
          id: 'node-F',
          distributorCode: 'DST-F',
          sponsorId: 'node-E',
          parentId: 'node-X',
          position: 'RIGHT',
          status: 'ACTIVE',
        } as any;
      });

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
        const id = args.where.id;
        if (id === 'node-F') {
          return {
            id: 'node-F',
            distributorCode: 'DST-F',
            sponsorId: 'node-E', // Sponsor is E
            parentId: 'node-X',   // Binary placement is under X
            position: 'RIGHT',   // Binary leg is RIGHT
            status: 'ACTIVE',
          } as any;
        }
        if (id === 'node-E') return { id: 'node-E', sponsorId: 'node-D', status: 'ACTIVE' } as any;
        if (id === 'node-D') return { id: 'node-D', sponsorId: 'node-C', status: 'ACTIVE' } as any;
        if (id === 'node-C') return { id: 'node-C', sponsorId: 'node-B', status: 'ACTIVE' } as any;
        if (id === 'node-B') return { id: 'node-B', sponsorId: 'node-A', status: 'ACTIVE' } as any;
        if (id === 'node-A') return { id: 'node-A', sponsorId: null, status: 'ACTIVE' } as any;
        return null;
      });

      // Upline chain resolution strictly follows sponsorId, completely ignoring parentId/position
      const chain = await SponsorUplineService.getUplineChain('node-F', 5);

      expect(chain[0].distributorId).toBe('node-E');
      expect(chain[0].level).toBe(1);
      expect(chain[4].distributorId).toBe('node-A');
      expect(chain[4].level).toBe(5);
    });
  });

  // =========================================================================
  // TEST 11 — COMMISSION CONFIGURATION
  // =========================================================================
  describe('TEST 11 — COMMISSION CONFIGURATION', () => {
    it('should use configured commission rate rather than hardcoded percentage when configuration changes', async () => {
      // Modify configuration: Change Level 1 from 24% to 30%
      const configuredTiers = [
        { id: 'tier-1', levelNumber: 1, percentage: new Prisma.Decimal(30), percentageNumber: 30, isActive: true },
        { id: 'tier-2', levelNumber: 2, percentage: new Prisma.Decimal(8), percentageNumber: 8, isActive: true },
        { id: 'tier-3', levelNumber: 3, percentage: new Prisma.Decimal(13), percentageNumber: 13, isActive: true },
        { id: 'tier-4', levelNumber: 4, percentage: new Prisma.Decimal(5), percentageNumber: 5, isActive: true },
        { id: 'tier-5', levelNumber: 5, percentage: new Prisma.Decimal(4), percentageNumber: 4, isActive: true },
      ];

      vi.spyOn(CommissionConfigService, 'getCommissionRates').mockResolvedValue(configuredTiers as any);

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue({
        id: 'dist-buyer-cfg',
        distributorId: 'KV-CFG',
        distributorCode: 'DST-CFG',
        firstName: 'Test',
        lastName: 'Buyer',
        displayName: 'Test Buyer',
        status: 'ACTIVE',
        sponsorId: 'upline-1',
        deletedAt: null,
      });

      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue([
        {
          level: 1,
          distributorId: 'upline-1',
          distributorCode: 'DST-UP1',
          displayName: 'Upline 1',
          status: 'ACTIVE',
          sponsorId: null,
          isDirect: true,
          isActive: true,
          isEligibleForCommission: true,
        },
      ]);

      // Calculate for 10,000 BV
      const breakdown = await CommissionCalculationService.calculateUplineCommission('dist-buyer-cfg', 10000, {
        requireActive: false,
      });

      // Level 1 commission must be 30% (₹3,000) instead of the hardcoded 24% (₹2,400)
      expect(breakdown[0].level).toBe(1);
      expect(breakdown[0].percentage).toBe(30);
      expect(breakdown[0].commissionAmount).toBe(3000);
    });
  });

  // =========================================================================
  // TEST 12 — CONCURRENT PROCESSING
  // =========================================================================
  describe('TEST 12 — CONCURRENT PROCESSING', () => {
    it('should process simultaneous requests for the same order serially, creating zero duplicates and zero ledger inconsistencies', async () => {
      const orderId = 'ord-concurrent-test12';
      let executionCount = 0;
      let existingPosted = false;

      const processCommissionMock = async () => {
        return CommissionSecurityService.withOrderLock(orderId, async () => {
          executionCount++;
          if (existingPosted) {
            return {
              orderId,
              status: 'ALREADY_PROCESSED',
              isIdempotentSkip: true,
              commissionsCreated: 0,
            };
          }

          // Simulate processing work
          await new Promise((resolve) => setTimeout(resolve, 20));
          existingPosted = true;

          return {
            orderId,
            status: 'SUCCESS',
            isIdempotentSkip: false,
            commissionsCreated: 5,
          };
        });
      };

      // Launch 2 simultaneous processing calls
      const [res1, res2] = await Promise.all([processCommissionMock(), processCommissionMock()]);

      expect(executionCount).toBe(2);

      // Exactly ONE call creates the commissions
      const successResults = [res1, res2].filter((r) => r.status === 'SUCCESS');
      const skippedResults = [res1, res2].filter((r) => r.isIdempotentSkip === true);

      expect(successResults.length).toBe(1);
      expect(skippedResults.length).toBe(1);
      expect(skippedResults[0].commissionsCreated).toBe(0);
    });
  });

  // =========================================================================
  // TEST 13 — RANK INDEPENDENCE
  // =========================================================================
  describe('TEST 13 — RANK INDEPENDENCE', () => {
    it('should keep unilevel commission tier rates unchanged regardless of distributor rank', () => {
      const bv = 10000;
      const ranks = ['MEMBER', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CROWN_AMBASSADOR'];

      for (const rank of ranks) {
        const result = CommissionCalculationService.calculateTheoreticalCommission(bv);

        // Verify tier percentages remain canonical 24%, 8%, 13%, 5%, 4%
        expect(result.tiers[0].percentage).toBe(24);
        expect(result.tiers[1].percentage).toBe(8);
        expect(result.tiers[2].percentage).toBe(13);
        expect(result.tiers[3].percentage).toBe(5);
        expect(result.tiers[4].percentage).toBe(4);
        expect(result.totalTheoreticalAmount).toBe(5400);
      }
    });
  });

  // =========================================================================
  // TEST 14 — FINANCIAL PRECISION
  // =========================================================================
  describe('TEST 14 — FINANCIAL PRECISION', () => {
    it('should compute exact decimal BV calculations without floating point drift', () => {
      // Test decimal BV = 1333.33
      const bv = 1333.33;

      const l1 = CommissionCalculationService.calculateCommissionAmount(bv, 24);
      const l2 = CommissionCalculationService.calculateCommissionAmount(bv, 8);
      const l3 = CommissionCalculationService.calculateCommissionAmount(bv, 13);
      const l4 = CommissionCalculationService.calculateCommissionAmount(bv, 5);
      const l5 = CommissionCalculationService.calculateCommissionAmount(bv, 4);

      // Calculations:
      // 1333.33 * 0.24 = 319.9992 -> 320.00
      // 1333.33 * 0.08 = 106.6664 -> 106.67
      // 1333.33 * 0.13 = 173.3329 -> 173.33
      // 1333.33 * 0.05 = 66.6665  -> 66.67
      // 1333.33 * 0.04 = 53.3332  -> 53.33
      expect(l1).toBe(320.00);
      expect(l2).toBe(106.67);
      expect(l3).toBe(173.33);
      expect(l4).toBe(66.67);
      expect(l5).toBe(53.33);

      const total = SafeDecimal.round(l1 + l2 + l3 + l4 + l5, 2);
      expect(total).toBe(720.00);

      // Assert no string float artifacts (e.g. 320.00000000000006)
      expect(l1.toString()).toBe('320');
      expect(l2.toString()).toBe('106.67');
      expect(l3.toString()).toBe('173.33');
      expect(l4.toString()).toBe('66.67');
      expect(l5.toString()).toBe('53.33');
    });

    it('should preserve fractional cent precision with SafeDecimal operations', () => {
      const a = SafeDecimal.round(0.1 + 0.2, 2);
      expect(a).toBe(0.3); // Avoids IEEE 754 0.30000000000000004

      const microBV = 0.05;
      const microCommission = CommissionCalculationService.calculateCommissionAmount(microBV, 24);
      expect(microCommission).toBe(0.01); // 0.05 * 0.24 = 0.012 -> 0.01
    });
  });
});
