/**
 * Automated Test Suite: Dedicated Commission Calculation Engine (Prompt 16)
 *
 * Verifies:
 * 1. Exact commission percentage formula:
 *    commissionAmount = commissionableBusinessVolume × commissionPercentage / 100
 * 2. Exact Canonical 5-Level Rates:
 *    Level 1 = 24%
 *    Level 2 = 8%
 *    Level 3 = 13%
 *    Level 4 = 5%
 *    Level 5 = 4%
 *    Total Theoretical Distribution = 54%
 * 3. Exact Prompt 16 Example on ₹10,000 BV:
 *    Level 1: 10,000 × 24% = ₹2,400
 *    Level 2: 10,000 × 8%  = ₹800
 *    Level 3: 10,000 × 13% = ₹1,300
 *    Level 4: 10,000 × 5%  = ₹500
 *    Level 5: 10,000 × 4%  = ₹400
 *    Total: ₹5,400
 * 4. All 4 required engine methods:
 *    - calculateCommissionForOrder(orderId)
 *    - calculateCommissionForMemberPurchase(memberId, orderId)
 *    - calculateUplineCommission(memberId, businessVolume)
 *    - calculateCommissionAmount(businessVolume, percentage)
 * 5. Detailed breakdown array structure:
 *    [
 *      {
 *        level: 1,
 *        recipientId,
 *        businessVolume,
 *        percentage,
 *        commissionAmount
 *      },
 *      ...
 *    ]
 * 6. Eligibility confirmation:
 *    "Do not automatically assume every upline is eligible until the rank/eligibility rule has been confirmed."
 * 7. PURE CALCULATION & WALLET ISOLATION:
 *    "Do not directly credit wallets during pure calculation."
 *    "Calculation and financial posting must be separate operations."
 * 8. DETERMINISM:
 *    "The calculation must be deterministic. Calling the calculation twice with the same inputs must produce the same result."
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  CommissionCalculationService,
  CommissionEngineService,
} from '../src/services/commissionCalculation.service';
import { LevelCommissionService } from '../src/services/levelCommission.service';
import { SponsorUplineService, UplineNode } from '../src/services/sponsorUpline.service';
import { CANONICAL_COMMISSION_TIERS } from '../src/types/commissionCalculation.types';

describe('DEDICATED COMMISSION CALCULATION ENGINE (PROMPT 16 TEST SUITE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests run cleanly in both offline & online DB environments
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock commissionLevel DB queries to return empty so default canonical rates apply
    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);
  });

  // Mock genealogy: A (L5) -> B (L4) -> C (L3) -> D (L2) -> E (L1) -> F (Purchaser)
  const mockPurchaser = {
    id: 'uuid-purchaser-f',
    distributorId: 'KV-1006',
    distributorCode: 'KV-1006',
    firstName: 'Frank',
    lastName: 'Purchaser',
    displayName: 'Frank Purchaser',
    status: 'ACTIVE',
    sponsorId: 'uuid-upline-e',
    deletedAt: null,
  };

  const mock5Uplines: UplineNode[] = [
    {
      level: 1,
      distributorId: 'uuid-upline-e',
      distributorCode: 'KV-1005',
      displayName: 'Eve Level 1',
      status: 'ACTIVE',
      sponsorId: 'uuid-upline-d',
      isDirect: true,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 2,
      distributorId: 'uuid-upline-d',
      distributorCode: 'KV-1004',
      displayName: 'David Level 2',
      status: 'ACTIVE',
      sponsorId: 'uuid-upline-c',
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 3,
      distributorId: 'uuid-upline-c',
      distributorCode: 'KV-1003',
      displayName: 'Charlie Level 3',
      status: 'ACTIVE',
      sponsorId: 'uuid-upline-b',
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 4,
      distributorId: 'uuid-upline-b',
      distributorCode: 'KV-1002',
      displayName: 'Bob Level 4',
      status: 'ACTIVE',
      sponsorId: 'uuid-upline-a',
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
    {
      level: 5,
      distributorId: 'uuid-upline-a',
      distributorCode: 'KV-1001',
      displayName: 'Alice Level 5',
      status: 'ACTIVE',
      sponsorId: null,
      isDirect: false,
      isActive: true,
      isEligibleForCommission: true,
    },
  ];

  // ==========================================================================
  // SECTION 1: PURE MATHEMATICAL CALCULATION (calculateCommissionAmount)
  // ==========================================================================
  describe('1. calculateCommissionAmount(businessVolume, percentage)', () => {
    it('should compute exact prompt example: 10,000 BV across levels 1 to 5', () => {
      // Level 1: 10,000 × 24% = ₹2,400
      const l1 = CommissionCalculationService.calculateCommissionAmount(10000, 24);
      expect(l1).toBe(2400.0);

      // Level 2: 10,000 × 8% = ₹800
      const l2 = CommissionCalculationService.calculateCommissionAmount(10000, 8);
      expect(l2).toBe(800.0);

      // Level 3: 10,000 × 13% = ₹1,300
      const l3 = CommissionCalculationService.calculateCommissionAmount(10000, 13);
      expect(l3).toBe(1300.0);

      // Level 4: 10,000 × 5% = ₹500
      const l4 = CommissionCalculationService.calculateCommissionAmount(10000, 5);
      expect(l4).toBe(500.0);

      // Level 5: 10,000 × 4% = ₹400
      const l5 = CommissionCalculationService.calculateCommissionAmount(10000, 4);
      expect(l5).toBe(400.0);

      // Total: ₹5,400 (54% of 10,000)
      const total = l1 + l2 + l3 + l4 + l5;
      expect(total).toBe(5400.0);
    });

    it('should support string and Decimal inputs without floating point inaccuracy', () => {
      expect(CommissionCalculationService.calculateCommissionAmount('10000', '24')).toBe(2400.0);
      expect(CommissionCalculationService.calculateCommissionAmount('250.00', '24')).toBe(60.0);
      expect(CommissionCalculationService.calculateCommissionAmount('250.00', '8')).toBe(20.0);
      expect(CommissionCalculationService.calculateCommissionAmount('250.00', '13')).toBe(32.5);
      expect(CommissionCalculationService.calculateCommissionAmount('250.00', '5')).toBe(12.5);
      expect(CommissionCalculationService.calculateCommissionAmount('250.00', '4')).toBe(10.0);
    });

    it('should return 0 for zero or negative business volume or percentage', () => {
      expect(CommissionCalculationService.calculateCommissionAmount(0, 24)).toBe(0);
      expect(CommissionCalculationService.calculateCommissionAmount(-500, 24)).toBe(0);
      expect(CommissionCalculationService.calculateCommissionAmount(10000, 0)).toBe(0);
      expect(CommissionCalculationService.calculateCommissionAmount(10000, -10)).toBe(0);
    });

    it('should provide theoretical 5-level calculation helper', () => {
      const theoretical = CommissionCalculationService.calculateTheoreticalCommission(10000);
      expect(theoretical.businessVolume).toBe(10000);
      expect(theoretical.totalTheoreticalPercentage).toBe(54.0);
      expect(theoretical.totalTheoreticalAmount).toBe(5400.0);
      expect(theoretical.tiers).toHaveLength(5);
      expect(theoretical.tiers[0].commissionAmount).toBe(2400.0);
      expect(theoretical.tiers[1].commissionAmount).toBe(800.0);
      expect(theoretical.tiers[2].commissionAmount).toBe(1300.0);
      expect(theoretical.tiers[3].commissionAmount).toBe(500.0);
      expect(theoretical.tiers[4].commissionAmount).toBe(400.0);
    });
  });

  // ==========================================================================
  // SECTION 2: UPLINE COMMISSION CALCULATION (calculateUplineCommission)
  // ==========================================================================
  describe('2. calculateUplineCommission(memberId, businessVolume)', () => {
    it('should return the detailed breakdown array matching prompt specification', async () => {
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      const breakdown = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );

      // Must be an Array
      expect(Array.isArray(breakdown)).toBe(true);
      expect(breakdown).toHaveLength(5);

      // Verify exact keys required by prompt on each element:
      // level, recipientId, businessVolume, percentage, commissionAmount
      expect(breakdown[0]).toEqual({
        level: 1,
        recipientId: 'uuid-upline-e',
        businessVolume: 10000,
        percentage: 24,
        commissionAmount: 2400,
        recipientCode: 'KV-1005',
        recipientName: 'Eve Level 1',
        status: 'ELIGIBLE',
        isEligible: true,
      });

      expect(breakdown[1]).toEqual({
        level: 2,
        recipientId: 'uuid-upline-d',
        businessVolume: 10000,
        percentage: 8,
        commissionAmount: 800,
        recipientCode: 'KV-1004',
        recipientName: 'David Level 2',
        status: 'ELIGIBLE',
        isEligible: true,
      });

      expect(breakdown[2]).toEqual({
        level: 3,
        recipientId: 'uuid-upline-c',
        businessVolume: 10000,
        percentage: 13,
        commissionAmount: 1300,
        recipientCode: 'KV-1003',
        recipientName: 'Charlie Level 3',
        status: 'ELIGIBLE',
        isEligible: true,
      });

      expect(breakdown[3]).toEqual({
        level: 4,
        recipientId: 'uuid-upline-b',
        businessVolume: 10000,
        percentage: 5,
        commissionAmount: 500,
        recipientCode: 'KV-1002',
        recipientName: 'Bob Level 4',
        status: 'ELIGIBLE',
        isEligible: true,
      });

      expect(breakdown[4]).toEqual({
        level: 5,
        recipientId: 'uuid-upline-a',
        businessVolume: 10000,
        percentage: 4,
        commissionAmount: 400,
        recipientCode: 'KV-1001',
        recipientName: 'Alice Level 5',
        status: 'ELIGIBLE',
        isEligible: true,
      });

      // Total commission amount
      expect(breakdown.totalCommissionAmount).toBe(5400.0);
      expect(breakdown.totalDistributedPercentage).toBe(54.0);
    });

    it('should correctly handle truncated upline chains (e.g. only 2 uplines exist)', async () => {
      // Member only has L1 and L2 uplines (L3..L5 do not exist)
      const truncatedUplines = [mock5Uplines[0], mock5Uplines[1]];

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(truncatedUplines);

      const breakdown = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );

      // Only 2 eligible recipients exist
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].level).toBe(1);
      expect(breakdown[0].commissionAmount).toBe(2400.0);
      expect(breakdown[1].level).toBe(2);
      expect(breakdown[1].commissionAmount).toBe(800.0);

      // Total paid is only ₹3,200 (₹2,400 + ₹800)
      expect(breakdown.totalCommissionAmount).toBe(3200.0);
      expect(breakdown.totalDistributedPercentage).toBe(32.0);

      // Theoretical total remains ₹5,400 (54%)
      expect(breakdown.totalTheoreticalAmount).toBe(5400.0);

      // Skipped levels are documented with reasons
      expect(breakdown.skippedLevels).toHaveLength(3);
      expect(breakdown.skippedLevels.map((s) => s.level)).toEqual([3, 4, 5]);
      expect(breakdown.skippedLevels.every((s) => s.reason === 'NO_UPLINE_EXISTS')).toBe(true);
    });

    it('should skip inactive upline and not assume eligibility', async () => {
      // David (Level 2) is INACTIVE
      const uplinesWithInactive = mock5Uplines.map((u) => {
        if (u.level === 2) {
          return { ...u, status: 'INACTIVE', isActive: false, isEligibleForCommission: false };
        }
        return u;
      });

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(uplinesWithInactive);

      const breakdown = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );

      // Level 2 should NOT be in the breakdown list
      expect(breakdown).toHaveLength(4);
      expect(breakdown.map((b) => b.level)).toEqual([1, 3, 4, 5]);

      // Level 3 still receives exact 13% (no compression / level shifting)
      expect(breakdown.find((b) => b.level === 3)?.commissionAmount).toBe(1300.0);

      // Skipped levels tracks level 2 as UPLINE_INACTIVE
      const skippedL2 = breakdown.skippedLevels.find((s) => s.level === 2);
      expect(skippedL2).toBeDefined();
      expect(skippedL2?.reason).toBe('UPLINE_INACTIVE');
    });

    it('should confirm eligibility via custom rank/qualification rule callback', async () => {
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      // Business rule: Level 4 and 5 must have minimum rank/qualification confirmed
      const confirmEligibilityRule = vi.fn(async (upline: UplineNode, level: number) => {
        // Only levels 1, 2, 3 qualify under this specific business rule
        return level <= 3;
      });

      const breakdown = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000,
        { confirmEligibility: confirmEligibilityRule }
      );

      expect(confirmEligibilityRule).toHaveBeenCalled();
      expect(breakdown).toHaveLength(3);
      expect(breakdown.map((b) => b.level)).toEqual([1, 2, 3]);

      // Levels 4 & 5 rejected by qualification rule
      expect(breakdown.skippedLevels.map((s) => s.level)).toEqual([4, 5]);
      expect(breakdown.skippedLevels.every((s) => s.reason === 'ELIGIBILITY_NOT_CONFIRMED')).toBe(true);
    });

    it('should return empty breakdown for 0 BV or negative BV', async () => {
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);

      const zeroResult = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        0
      );
      expect(zeroResult).toHaveLength(0);
      expect(zeroResult.totalCommissionAmount).toBe(0);

      const negResult = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        -100
      );
      expect(negResult).toHaveLength(0);
      expect(negResult.totalCommissionAmount).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 3: ORDER PURCHASE CALCULATION (calculateCommissionForMemberPurchase)
  // ==========================================================================
  describe('3. calculateCommissionForMemberPurchase(memberId, orderId)', () => {
    it('should calculate commissions from authoritative order BV for paid order', async () => {
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-1001',
        orderNumber: 'ORD-2026-1001',
        status: 'PAID',
        totalBV: 10000 as any,
        commissionableBusinessVolume: 10000 as any,
        distributorId: 'uuid-purchaser-f',
      } as any);

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      const breakdown = await CommissionCalculationService.calculateCommissionForMemberPurchase(
        'uuid-purchaser-f',
        'ord-1001'
      );

      expect(breakdown).toHaveLength(5);
      expect(breakdown.totalCommissionAmount).toBe(5400.0);
      expect(breakdown.orderId).toBe('ord-1001');
      expect(breakdown.orderNumber).toBe('ORD-2026-1001');
    });

    it('should reject non-paid order unless allowPreview option is set', async () => {
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-pending',
        orderNumber: 'ORD-PENDING-01',
        status: 'PAYMENT_PENDING',
        totalBV: 10000 as any,
        distributorId: 'uuid-purchaser-f',
      } as any);

      await expect(
        CommissionCalculationService.calculateCommissionForMemberPurchase(
          'uuid-purchaser-f',
          'ord-pending'
        )
      ).rejects.toThrow('Order must be PAID or CONFIRMED');

      // But with allowPreview: true, preview calculation succeeds
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      const preview = await CommissionCalculationService.calculateCommissionForMemberPurchase(
        'uuid-purchaser-f',
        'ord-pending',
        { allowPreview: true }
      );
      expect(preview).toHaveLength(5);
      expect(preview.totalCommissionAmount).toBe(5400.0);
    });

    it('should return empty breakdown for cancelled or refunded order', async () => {
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-cancelled',
        orderNumber: 'ORD-CANCEL-01',
        status: 'CANCELLED',
        totalBV: 10000 as any,
        distributorId: 'uuid-purchaser-f',
      } as any);

      const breakdown = await CommissionCalculationService.calculateCommissionForMemberPurchase(
        'uuid-purchaser-f',
        'ord-cancelled'
      );

      expect(breakdown).toHaveLength(0);
      expect(breakdown.totalCommissionAmount).toBe(0);
    });
  });

  // ==========================================================================
  // SECTION 4: ORDER LEVEL CALCULATION (calculateCommissionForOrder)
  // ==========================================================================
  describe('4. calculateCommissionForOrder(orderId)', () => {
    it('should automatically resolve purchasing member and compute 5-level breakdown', async () => {
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-auto',
        orderNumber: 'ORD-2026-AUTO',
        status: 'PAID',
        totalBV: 10000 as any,
        commissionableBusinessVolume: 10000 as any,
        distributorId: 'uuid-purchaser-f',
      } as any);

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      const breakdown = await CommissionCalculationService.calculateCommissionForOrder('ord-auto');

      expect(breakdown).toHaveLength(5);
      expect(breakdown[0].commissionAmount).toBe(2400.0);
      expect(breakdown[1].commissionAmount).toBe(800.0);
      expect(breakdown[2].commissionAmount).toBe(1300.0);
      expect(breakdown[3].commissionAmount).toBe(500.0);
      expect(breakdown[4].commissionAmount).toBe(400.0);
      expect(breakdown.totalCommissionAmount).toBe(5400.0);
    });

    it('should throw NOT_FOUND for invalid orderId', async () => {
      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(
        CommissionCalculationService.calculateCommissionForOrder('non-existent-order')
      ).rejects.toThrow("Order with ID 'non-existent-order' not found");
    });
  });

  // ==========================================================================
  // SECTION 5: PURE CALCULATION & WALLET ISOLATION (MANDATORY INVARIANT)
  // ==========================================================================
  describe('5. Pure Calculation & Wallet Isolation', () => {
    it('MUST NOT credit wallets or mutate financial ledgers during pure calculation', async () => {
      const walletUpdateSpy = vi.spyOn(prisma.wallet, 'update');
      const walletCreateSpy = vi.spyOn(prisma.wallet, 'create');
      const walletTxSpy = vi.spyOn(prisma.walletTransaction, 'create');
      const levelCommissionSpy = vi.spyOn(prisma.levelCommission, 'create');

      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-safe',
        orderNumber: 'ORD-SAFE-01',
        status: 'PAID',
        totalBV: 10000 as any,
        commissionableBusinessVolume: 10000 as any,
        distributorId: 'uuid-purchaser-f',
      } as any);

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      // Perform all 3 calculation calls
      await CommissionCalculationService.calculateCommissionAmount(10000, 24);
      await CommissionCalculationService.calculateUplineCommission('uuid-purchaser-f', 10000);
      await CommissionCalculationService.calculateCommissionForOrder('ord-safe');

      // ASSERT: Zero wallet interactions occurred!
      expect(walletUpdateSpy).not.toHaveBeenCalled();
      expect(walletCreateSpy).not.toHaveBeenCalled();
      expect(walletTxSpy).not.toHaveBeenCalled();
      expect(levelCommissionSpy).not.toHaveBeenCalled();
    });

    it('should separate calculation and financial ledger posting', async () => {
      const breakdown = [
        {
          level: 1,
          recipientId: 'uuid-upline-e',
          businessVolume: 10000,
          percentage: 24,
          commissionAmount: 2400,
        },
      ] as any;

      vi.spyOn(prisma.order, 'findFirst').mockResolvedValue({
        id: 'ord-post',
        orderNumber: 'ORD-POST-01',
        distributorId: 'uuid-purchaser-f',
      } as any);

      vi.spyOn(prisma.levelCommission, 'findMany').mockResolvedValue([]);
      const createSpy = vi.spyOn(prisma.levelCommission, 'create').mockResolvedValue({
        id: 'lcm-101',
      } as any);

      // Financial posting is an explicit separate call
      const postResult = await CommissionCalculationService.postCommissionBreakdownToLedger(
        'ord-post',
        breakdown
      );

      expect(postResult.postedCount).toBe(1);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // SECTION 6: DETERMINISM (MANDATORY INVARIANT)
  // ==========================================================================
  describe('6. Determinism & Idempotency of Calculations', () => {
    it('calling calculation multiple times with the same inputs MUST produce the exact same result', async () => {
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      // Run 1
      const run1 = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );

      // Run 2
      const run2 = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );

      // Run 3
      const run3 = await CommissionCalculationService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );

      // Exact deep equality between all runs
      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);
      expect(run1.totalCommissionAmount).toBe(run2.totalCommissionAmount);
      expect(run1.totalDistributedPercentage).toBe(run2.totalDistributedPercentage);
    });
  });

  // ==========================================================================
  // SECTION 7: DELEGATION & ALIASES
  // ==========================================================================
  describe('7. Service Aliases & LevelCommissionService Delegations', () => {
    it('CommissionEngineService alias should work interchangeably', () => {
      expect(CommissionEngineService).toBe(CommissionCalculationService);
      const amount = CommissionEngineService.calculateCommissionAmount(10000, 24);
      expect(amount).toBe(2400.0);
    });

    it('LevelCommissionService should delegate to CommissionCalculationService', async () => {
      expect(LevelCommissionService.calculateCommissionAmount(10000, 24)).toBe(2400.0);

      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mock5Uplines);

      const breakdown = await LevelCommissionService.calculateUplineCommission(
        'uuid-purchaser-f',
        10000
      );
      expect(breakdown).toHaveLength(5);
      expect(breakdown.totalCommissionAmount).toBe(5400.0);
    });
  });
});
