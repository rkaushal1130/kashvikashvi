import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../src/config/database';
import {
  CumulativeRankCommissionService,
  CANONICAL_RANK_CONFIGS,
  RankCode,
  TierCommissionCalculation,
} from '../src/services/cumulativeRankCommission.service';

describe('COMPLETE MLM RANK AND CUMULATIVE COMMISSION SYSTEM TESTS (PHASE 9)', () => {
  const createMockDistributor = (overrides?: any) => ({
    id: 'dist-test-001',
    distributorCode: 'KV-1001',
    distributorId: 'KV-1001',
    firstName: 'Kashvi',
    lastName: 'Leader',
    displayName: 'Kashvi Leader',
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    lifetimePV: 0,
    currentBB: 0,
    currentMatching: 0,
    sponsorId: 'KV-ROOT',
    currentLevelId: null,
    currentRankId: null,
    currentLevel: null,
    currentRank: null,
    highestRank: null,
    user: { id: 'usr-001', role: 'DISTRIBUTOR', status: 'ACTIVE' },
    mlmNodes: [{ id: 'node-001', parentId: 'KV-ROOT', position: 'LEFT' }],
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    CumulativeRankCommissionService.resetState();

    // Mock prisma.$transaction to execute synchronous callback
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Provide default resolved mocks for Prisma models
    vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).level, 'updateMany').mockResolvedValue({ count: 1 } as any);
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(createMockDistributor() as any);
    vi.spyOn(prisma.distributorProfile, 'findMany').mockResolvedValue([createMockDistributor()] as any);
    vi.spyOn(prisma.commission, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.commission, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.commission, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.commission, 'create').mockImplementation(async ({ data }: any) => ({
      id: `comm-${data.businessReference}`,
      ...data,
      amount: Number(data.amount),
      createdAt: new Date(),
    }));
    vi.spyOn(prisma.commission, 'update').mockImplementation(async ({ data }: any) => ({
      id: 'comm-updated',
      ...data,
    }));
    vi.spyOn(prisma.wallet, 'findUnique').mockResolvedValue({
      id: 'wallet-001',
      distributorId: 'dist-test-001',
      availableBalance: 0,
      balance: 0,
      lifetimeEarned: 0,
    } as any);
    vi.spyOn(prisma.wallet, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({ id: 'wtx-001' } as any);
  });

  // =========================================================================
  // 1. EXACTLY MEETING EVERY RANK'S BV AND MATCHING THRESHOLDS
  // =========================================================================
  describe('1. Exactly Meeting Every Rank Threshold (Phase 1 & 2)', () => {
    it('Exactly meets Silver: BV = 250, Left = 2,000, Right = 2,000 => SILVER', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 250, leftMatching: 2000, rightMatching: 2000 }
      );

      expect(qual.currentRank).toBe('SILVER');
      expect(qual.currentRankOrder).toBe(1);
      expect(qual.isQualified).toBe(true);
      expect(qual.missingRequirements.bvGap).toBe(0);
      expect(qual.missingRequirements.leftMatchingGap).toBe(3000); // Towards Gold (5000 - 2000)
      expect(qual.missingRequirements.rightMatchingGap).toBe(3000);
    });

    it('Exactly meets Gold: BV = 250, Left = 5,000, Right = 5,000 => GOLD', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 250, leftMatching: 5000, rightMatching: 5000 }
      );

      expect(qual.currentRank).toBe('GOLD');
      expect(qual.currentRankOrder).toBe(2);
      expect(qual.isQualified).toBe(true);
    });

    it('Exactly meets Platinum: BV = 500, Left = 50,000, Right = 50,000 => PLATINUM', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 500, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(qual.currentRank).toBe('PLATINUM');
      expect(qual.currentRankOrder).toBe(3);
      expect(qual.isQualified).toBe(true);
    });

    it('Exactly meets Diamond: BV = 1,000, Left = 60,000, Right = 60,000 => DIAMOND', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1000, leftMatching: 60000, rightMatching: 60000 }
      );

      expect(qual.currentRank).toBe('DIAMOND');
      expect(qual.currentRankOrder).toBe(4);
      expect(qual.isQualified).toBe(true);
    });

    it('Exactly meets Ruby: BV = 1,000, Left = 100,000, Right = 100,000 => RUBY', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1000, leftMatching: 100000, rightMatching: 100000 }
      );

      expect(qual.currentRank).toBe('RUBY');
      expect(qual.currentRankOrder).toBe(5);
      expect(qual.isQualified).toBe(true);
      expect(qual.nextRank).toBeNull(); // Ruby is highest canonical rank
    });
  });

  // =========================================================================
  // 2. VALUES BELOW EACH THRESHOLD
  // =========================================================================
  describe('2. Values Below Each Threshold (Disqualification & Degradation)', () => {
    it('Silver BV shortfall: BV = 249, Left = 2000, Right = 2000 => BASE', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 249, leftMatching: 2000, rightMatching: 2000 }
      );
      expect(qual.currentRank).toBe('BASE');
      expect(qual.missingRequirements.bvGap).toBe(1);
    });

    it('Silver Left matching shortfall: BV = 250, Left = 1999, Right = 2000 => BASE', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 250, leftMatching: 1999, rightMatching: 2000 }
      );
      expect(qual.currentRank).toBe('BASE');
      expect(qual.missingRequirements.leftMatchingGap).toBe(1);
    });

    it('Silver Right matching shortfall: BV = 250, Left = 2000, Right = 1999 => BASE', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 250, leftMatching: 2000, rightMatching: 1999 }
      );
      expect(qual.currentRank).toBe('BASE');
      expect(qual.missingRequirements.rightMatchingGap).toBe(1);
    });

    it('Platinum BV shortfall: BV = 499, Left = 50000, Right = 50000 => GOLD (meets Gold 250 BV)', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 499, leftMatching: 50000, rightMatching: 50000 }
      );
      expect(qual.currentRank).toBe('GOLD');
      expect(qual.missingRequirements.bvGap).toBe(1);
    });

    it('Diamond matching shortfall: BV = 1000, Left = 60000, Right = 59999 => PLATINUM', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1000, leftMatching: 60000, rightMatching: 59999 }
      );
      expect(qual.currentRank).toBe('PLATINUM');
      expect(qual.missingRequirements.rightMatchingGap).toBe(1);
    });

    it('Ruby matching shortfall: BV = 1000, Left = 99999, Right = 100000 => DIAMOND', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1000, leftMatching: 99999, rightMatching: 100000 }
      );
      expect(qual.currentRank).toBe('DIAMOND');
      expect(qual.missingRequirements.leftMatchingGap).toBe(1);
    });
  });

  // =========================================================================
  // 3. LEFT VS RIGHT ASYMMETRY (STRICT INDEPENDENT EVALUATION - NO ADDING)
  // =========================================================================
  describe('3. Left vs Right Asymmetry (Never Sum Left and Right)', () => {
    it('Left = 4000, Right = 0 => BASE (MUST NOT qualify for Silver)', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 250, leftMatching: 4000, rightMatching: 0 }
      );

      // 4000 left + 0 right must NEVER be summed to qualify for 2000 matching!
      expect(qual.currentRank).toBe('BASE');
      expect(qual.missingRequirements.rightMatchingGap).toBe(2000);
    });

    it('Left = 0, Right = 150000 => BASE (Zero Left leg fails all ranks)', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1000, leftMatching: 0, rightMatching: 150000 }
      );
      expect(qual.currentRank).toBe('BASE');
      expect(qual.missingRequirements.leftMatchingGap).toBe(2000);
    });

    it('Asymmetric: Left = 100000, Right = 4000, BV = 500 => SILVER', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 500, leftMatching: 100000, rightMatching: 4000 }
      );
      // Right is 4000: >= 2000 (Silver), but < 5000 (Gold)
      expect(qual.currentRank).toBe('SILVER');
    });

    it('Asymmetric: Left = 7000, Right = 55000, BV = 500 => GOLD', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 500, leftMatching: 7000, rightMatching: 55000 }
      );
      // Left is 7000: >= 5000 (Gold), but < 50000 (Platinum)
      expect(qual.currentRank).toBe('GOLD');
    });
  });

  // =========================================================================
  // 4. EXCESS MATCHING ON EITHER SIDE
  // =========================================================================
  describe('4. Excess Matching Volume on Either Side', () => {
    it('Excess Left volume (Left = 250000, Right = 100000, BV = 1000) => RUBY', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1000, leftMatching: 250000, rightMatching: 100000 }
      );
      expect(qual.currentRank).toBe('RUBY');
      expect(qual.isQualified).toBe(true);
    });

    it('Excess Right volume (Left = 100000, Right = 300000, BV = 1500) => RUBY', async () => {
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        createMockDistributor(),
        { bv: 1500, leftMatching: 100000, rightMatching: 300000 }
      );
      expect(qual.currentRank).toBe('RUBY');
      expect(qual.isQualified).toBe(true);
    });
  });

  // =========================================================================
  // 5. CUMULATIVE COMMISSION TIERS FOR HIGHER RANKS (PHASE 3)
  // =========================================================================
  describe('5. Cumulative Commission Eligibility Matrix', () => {
    it('Silver member receives Silver (24%) = 1 tier (24% total)', () => {
      const tiers = CumulativeRankCommissionService.getEligibleCommissionTiers('SILVER');
      expect(tiers.length).toBe(1);
      expect(tiers[0].rankCode).toBe('SILVER');
      expect(tiers[0].percentage).toBe(24);
      expect(tiers[0].cumulativePercentage).toBe(24);
    });

    it('Gold member receives Silver (24%) + Gold (8%) = 2 tiers (32% total)', () => {
      const tiers = CumulativeRankCommissionService.getEligibleCommissionTiers('GOLD');
      expect(tiers.length).toBe(2);
      expect(tiers[0].rankCode).toBe('SILVER');
      expect(tiers[0].percentage).toBe(24);
      expect(tiers[1].rankCode).toBe('GOLD');
      expect(tiers[1].percentage).toBe(8);
      expect(tiers[1].cumulativePercentage).toBe(32);
    });

    it('Platinum member receives Silver 24% + Gold 8% + Platinum 13% = 3 tiers (45% total)', () => {
      const tiers = CumulativeRankCommissionService.getEligibleCommissionTiers('PLATINUM');
      expect(tiers.length).toBe(3);
      expect(tiers.map((t) => t.percentage)).toEqual([24, 8, 13]);
      expect(tiers[2].cumulativePercentage).toBe(45);
    });

    it('Diamond member receives Silver 24% + Gold 8% + Platinum 13% + Diamond 5% = 4 tiers (50% total)', () => {
      const tiers = CumulativeRankCommissionService.getEligibleCommissionTiers('DIAMOND');
      expect(tiers.length).toBe(4);
      expect(tiers.map((t) => t.percentage)).toEqual([24, 8, 13, 5]);
      expect(tiers[3].cumulativePercentage).toBe(50);
    });

    it('Ruby member receives Silver 24% + Gold 8% + Platinum 13% + Diamond 5% + Ruby 4% = 5 tiers (54% total)', () => {
      const tiers = CumulativeRankCommissionService.getEligibleCommissionTiers('RUBY');
      expect(tiers.length).toBe(5);
      expect(tiers.map((t) => t.percentage)).toEqual([24, 8, 13, 5, 4]);
      expect(tiers[4].cumulativePercentage).toBe(54);
    });

    it('Base member receives 0 tiers (0% total)', () => {
      const tiers = CumulativeRankCommissionService.getEligibleCommissionTiers('BASE');
      expect(tiers.length).toBe(0);
    });
  });

  // =========================================================================
  // 6. PERCENTAGE AND ELIGIBLE-BASE CALCULATION ARITHMETIC
  // =========================================================================
  describe('6. Percentage and Eligible-Base Calculation Arithmetic', async () => {
    it('Calculates each tier independently for Gold member on 10,000 Matched BV base', async () => {
      vi.spyOn(CumulativeRankCommissionService, 'getMemberRankQualification').mockResolvedValue({
        memberId: 'dist-test-001',
        distributorCode: 'KV-1001',
        name: 'Kashvi Leader',
        sponsorId: 'KV-ROOT',
        sponsorName: 'Root',
        parentPlacementId: 'KV-ROOT',
        placementLeg: 'LEFT',
        currentRank: 'GOLD',
        currentRankName: 'Gold',
        currentRankOrder: 2,
        qualifyingBV: 300,
        leftMatching: 12000,
        rightMatching: 10000,
        matchedVolume: 10000,
        nextRank: 'PLATINUM',
        nextRankName: 'Platinum',
        missingRequirements: { bvGap: 200, leftMatchingGap: 38000, rightMatchingGap: 40000 },
        rankProgressPercent: 50,
        isQualified: true,
        eligibleCommissionTiers: [
          { tierOrder: 1, rankCode: 'SILVER', rankName: 'Silver', percentage: 24, cumulativePercentage: 24 },
          { tierOrder: 2, rankCode: 'GOLD', rankName: 'Gold', percentage: 8, cumulativePercentage: 32 },
        ],
        cumulativePercentage: 32,
        paymentStatus: 'PAID',
        isCommissionEligible: true,
      });

      const calculations = await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        'dist-test-001',
        'CYCLE-2026-W38',
        { baseAmount: 10000 }
      );

      expect(calculations.length).toBe(2);

      // Tier 1: Silver 24% of 10,000 = 2,400.00
      expect(calculations[0].rankCode).toBe('SILVER');
      expect(calculations[0].percentage).toBe(24);
      expect(calculations[0].calculatedAmount).toBe(2400.0);

      // Tier 2: Gold 8% of 10,000 = 800.00
      expect(calculations[1].rankCode).toBe('GOLD');
      expect(calculations[1].percentage).toBe(8);
      expect(calculations[1].calculatedAmount).toBe(800.0);

      const total = calculations.reduce((sum, c) => sum + c.calculatedAmount, 0);
      expect(total).toBe(3200.0);
    });
  });

  // =========================================================================
  // 7. REPEATED CALCULATION REQUESTS (STRICT IDEMPOTENCY)
  // =========================================================================
  describe('7. Idempotency: Repeated Requests Do Not Create Duplicate Commissions', async () => {
    it('Calling calculation twice produces identical amounts and does not duplicate records', async () => {
      vi.spyOn(CumulativeRankCommissionService, 'getMemberRankQualification').mockResolvedValue({
        memberId: 'dist-test-001',
        distributorCode: 'KV-1001',
        name: 'Kashvi Leader',
        sponsorId: 'KV-ROOT',
        sponsorName: 'Root',
        parentPlacementId: 'KV-ROOT',
        placementLeg: 'LEFT',
        currentRank: 'SILVER',
        currentRankName: 'Silver',
        currentRankOrder: 1,
        qualifyingBV: 250,
        leftMatching: 2000,
        rightMatching: 2000,
        matchedVolume: 2000,
        nextRank: 'GOLD',
        nextRankName: 'Gold',
        missingRequirements: { bvGap: 0, leftMatchingGap: 3000, rightMatchingGap: 3000 },
        rankProgressPercent: 50,
        isQualified: true,
        eligibleCommissionTiers: [
          { tierOrder: 1, rankCode: 'SILVER', rankName: 'Silver', percentage: 24, cumulativePercentage: 24 },
        ],
        cumulativePercentage: 24,
        paymentStatus: 'PAID',
        isCommissionEligible: true,
      });

      const firstCall = await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        'dist-test-001',
        'CYCLE-2026-W38',
        { baseAmount: 2000 }
      );
      expect(firstCall.length).toBe(1);
      expect(firstCall[0].calculatedAmount).toBe(480.0);

      // Second call
      const secondCall = await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        'dist-test-001',
        'CYCLE-2026-W38',
        { baseAmount: 2000 }
      );
      expect(secondCall.length).toBe(1);
      expect(secondCall[0].calculatedAmount).toBe(480.0);
      expect(secondCall[0].businessReference).toBe(firstCall[0].businessReference);
    });
  });

  // =========================================================================
  // 8. CONCURRENT CALCULATIONS
  // =========================================================================
  describe('8. Concurrent Calculation Requests', async () => {
    it('Concurrent requests for the same member and period resolve safely', async () => {
      vi.spyOn(CumulativeRankCommissionService, 'getMemberRankQualification').mockResolvedValue({
        memberId: 'dist-test-001',
        distributorCode: 'KV-1001',
        name: 'Kashvi Leader',
        sponsorId: 'KV-ROOT',
        sponsorName: 'Root',
        parentPlacementId: 'KV-ROOT',
        placementLeg: 'LEFT',
        currentRank: 'SILVER',
        currentRankName: 'Silver',
        currentRankOrder: 1,
        qualifyingBV: 250,
        leftMatching: 2000,
        rightMatching: 2000,
        matchedVolume: 2000,
        nextRank: 'GOLD',
        nextRankName: 'Gold',
        missingRequirements: { bvGap: 0, leftMatchingGap: 3000, rightMatchingGap: 3000 },
        rankProgressPercent: 50,
        isQualified: true,
        eligibleCommissionTiers: [
          { tierOrder: 1, rankCode: 'SILVER', rankName: 'Silver', percentage: 24, cumulativePercentage: 24 },
        ],
        cumulativePercentage: 24,
        paymentStatus: 'PAID',
        isCommissionEligible: true,
      });

      const [res1, res2] = await Promise.all([
        CumulativeRankCommissionService.calculateMemberCumulativeCommissions('dist-test-001', 'CYCLE-CONCURRENT-01', { baseAmount: 2000 }),
        CumulativeRankCommissionService.calculateMemberCumulativeCommissions('dist-test-001', 'CYCLE-CONCURRENT-01', { baseAmount: 2000 }),
      ]);

      expect(res1[0].calculatedAmount).toBe(480.0);
      expect(res2[0].calculatedAmount).toBe(480.0);
      expect(res1[0].businessReference).toBe(res2[0].businessReference);
    });
  });

  // =========================================================================
  // 9. FAILED OR PENDING PAYMENTS DO NOT QUALIFY MEMBERS (PHASE 7)
  // =========================================================================
  describe('9. Payment Gating: Pending or Failed Payments Never Qualify Members', async () => {
    it('Member with paymentStatus = PENDING has isCommissionEligible = false and earns 0 commission', async () => {
      const unpaidMember = createMockDistributor({
        status: 'PENDING',
        paymentStatus: 'PENDING',
      });

      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        unpaidMember,
        { bv: 500, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(qual.paymentStatus).toBe('PENDING');
      expect(qual.isCommissionEligible).toBe(false);

      const comms = await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        unpaidMember.id,
        'CYCLE-2026-W38'
      );
      expect(comms.length).toBe(0);
    });

    it('Member with paymentStatus = FAILED has isCommissionEligible = false', async () => {
      const failedMember = createMockDistributor({
        status: 'INACTIVE',
        paymentStatus: 'FAILED',
      });

      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        failedMember,
        { bv: 1000, leftMatching: 100000, rightMatching: 100000 }
      );

      expect(qual.isCommissionEligible).toBe(false);
    });
  });

  // =========================================================================
  // 10. REVERSED TRANSACTIONS AND AUDITING (PHASE 4)
  // =========================================================================
  describe('10. Reversal Workflow and Audit Trail', async () => {
    it('Reverses an incorrect commission entry with auditable reason', async () => {
      const commRef = 'CUMULATIVE_RANK:CYCLE-REV-01:dist-test-001:SILVER';

      vi.spyOn(CumulativeRankCommissionService, 'getMemberRankQualification').mockResolvedValue({
        memberId: 'dist-test-001',
        distributorCode: 'KV-1001',
        name: 'Kashvi Leader',
        sponsorId: 'KV-ROOT',
        sponsorName: 'Root',
        parentPlacementId: 'KV-ROOT',
        placementLeg: 'LEFT',
        currentRank: 'SILVER',
        currentRankName: 'Silver',
        currentRankOrder: 1,
        qualifyingBV: 250,
        leftMatching: 2000,
        rightMatching: 2000,
        matchedVolume: 2000,
        nextRank: 'GOLD',
        nextRankName: 'Gold',
        missingRequirements: { bvGap: 0, leftMatchingGap: 3000, rightMatchingGap: 3000 },
        rankProgressPercent: 50,
        isQualified: true,
        eligibleCommissionTiers: [
          { tierOrder: 1, rankCode: 'SILVER', rankName: 'Silver', percentage: 24, cumulativePercentage: 24 },
        ],
        cumulativePercentage: 24,
        paymentStatus: 'PAID',
        isCommissionEligible: true,
      });

      // Seed in-memory
      await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        'dist-test-001',
        'CYCLE-REV-01',
        { baseAmount: 2000 }
      );

      const reversalResult = await CumulativeRankCommissionService.reverseCommission(
        commRef,
        'Order refund and fraudulent BV roll-up detected',
        'admin-usr-01'
      );

      expect(reversalResult.reversed).toBe(true);
      expect(reversalResult.reason).toContain('Order refund');

      const auditTrail = CumulativeRankCommissionService.getAuditTrail();
      expect(auditTrail.some((a) => a.action === 'REVERSE_COMMISSION')).toBe(true);
    });
  });

  // =========================================================================
  // 11. COMMISSION APPROVAL AND PAYOUT WORKFLOW
  // =========================================================================
  describe('11. Commission Approval and Wallet Payout Workflow', async () => {
    it('Approves calculated commissions and payouts to wallet with explicit confirmation', async () => {
      const periodId = 'CYCLE-APPROVAL-01';

      vi.spyOn(CumulativeRankCommissionService, 'getMemberRankQualification').mockResolvedValue({
        memberId: 'dist-test-001',
        distributorCode: 'KV-1001',
        name: 'Kashvi Leader',
        sponsorId: 'KV-ROOT',
        sponsorName: 'Root',
        parentPlacementId: 'KV-ROOT',
        placementLeg: 'LEFT',
        currentRank: 'SILVER',
        currentRankName: 'Silver',
        currentRankOrder: 1,
        qualifyingBV: 250,
        leftMatching: 2000,
        rightMatching: 2000,
        matchedVolume: 2000,
        nextRank: 'GOLD',
        nextRankName: 'Gold',
        missingRequirements: { bvGap: 0, leftMatchingGap: 3000, rightMatchingGap: 3000 },
        rankProgressPercent: 50,
        isQualified: true,
        eligibleCommissionTiers: [
          { tierOrder: 1, rankCode: 'SILVER', rankName: 'Silver', percentage: 24, cumulativePercentage: 24 },
        ],
        cumulativePercentage: 24,
        paymentStatus: 'PAID',
        isCommissionEligible: true,
      });

      // 1. Calculate
      const calculated = await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        'dist-test-001',
        periodId,
        { baseAmount: 5000 }
      );
      expect(calculated.length).toBeGreaterThanOrEqual(1);

      // 2. Approve
      const approval = await CumulativeRankCommissionService.approveCommissions(periodId, 'admin-usr-01');
      expect(approval.approvedCount).toBeGreaterThanOrEqual(1);

      // 3. Payout
      const payout = await CumulativeRankCommissionService.payoutCommissions(periodId, 'admin-usr-01');
      expect(payout.paidCount).toBeGreaterThanOrEqual(1);

      const audit = CumulativeRankCommissionService.getAuditTrail();
      expect(audit.some((a) => a.action === 'PAYOUT_COMMISSIONS')).toBe(true);
    });
  });

  // =========================================================================
  // 12. CONFIGURABLE RANK RETENTION POLICY (PHASE 2)
  // =========================================================================
  describe('12. Configurable Rank Retention Policy', async () => {
    it('Retains previously achieved rank when retention policy is enabled', async () => {
      CumulativeRankCommissionService.setRankRetentionPolicy(true);

      const memberWithHistoricalRank = createMockDistributor({
        currentLevel: { code: 'PLATINUM', order: 3 },
      });

      // Temporary volume drop (e.g. Left 2000, Right 2000 only satisfies Silver)
      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        memberWithHistoricalRank,
        { bv: 250, leftMatching: 2000, rightMatching: 2000 }
      );

      // With retention enabled, member retains Platinum
      expect(qual.currentRank).toBe('PLATINUM');
    });

    it('Allows downgrade when retention policy is explicitly disabled', async () => {
      CumulativeRankCommissionService.setRankRetentionPolicy(false);

      const memberWithHistoricalRank = createMockDistributor({
        currentLevel: { code: 'PLATINUM', order: 3 },
      });

      const qual = await CumulativeRankCommissionService.getMemberRankQualification(
        memberWithHistoricalRank,
        { bv: 250, leftMatching: 2000, rightMatching: 2000 }
      );

      // Without retention, drops to currently qualified rank (Silver)
      expect(qual.currentRank).toBe('SILVER');
    });
  });

  // =========================================================================
  // 13. DYNAMIC CONFIGURATION OF RANK REQUIREMENTS AND RATES (PHASE 1)
  // =========================================================================
  describe('13. Dynamic Admin Configuration of Rank Requirements', async () => {
    it('Updates rank requirement and validates ranges', async () => {
      const updated = await CumulativeRankCommissionService.updateRankConfig('SILVER', {
        minBV: 300,
        commissionPercent: 25,
      });

      expect(updated.minBV).toBe(300);
      expect(updated.commissionPercent).toBe(25);

      // Invalid percentage rejects
      await expect(
        CumulativeRankCommissionService.updateRankConfig('SILVER', {
          commissionPercent: 120, // > 100%
        })
      ).rejects.toThrow('Commission percentage must be between 0 and 100%');
    });
  });

  // =========================================================================
  // 14. ADMIN COMMISSION REPORT (PHASE 5)
  // =========================================================================
  describe('14. Admin Comprehensive Commission Report', async () => {
    it('Generates admin report item with all required dimensions', async () => {
      const report = await CumulativeRankCommissionService.getAdminCommissionReport();
      expect(report.length).toBeGreaterThan(0);

      const first = report[0];
      expect(first).toHaveProperty('distributorId');
      expect(first).toHaveProperty('distributorCode');
      expect(first).toHaveProperty('sponsorId');
      expect(first).toHaveProperty('placementDetails');
      expect(first).toHaveProperty('achievedRank');
      expect(first).toHaveProperty('qualifyingBV');
      expect(first).toHaveProperty('leftMatching');
      expect(first).toHaveProperty('rightMatching');
      expect(first).toHaveProperty('missingRequirements');
      expect(first).toHaveProperty('eligibleTiers');
      expect(first).toHaveProperty('cumulativePercentage');
      expect(first).toHaveProperty('eligibleBase');
      expect(first).toHaveProperty('calculatedAmount');
      expect(first).toHaveProperty('pendingAmount');
      expect(first).toHaveProperty('approvedAmount');
      expect(first).toHaveProperty('paidAmount');
      expect(first).toHaveProperty('reversedAmount');
    });
  });
});
