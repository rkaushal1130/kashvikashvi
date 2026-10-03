/**
 * Automated Test Suite: Commission Eligibility Engine (Prompt 17)
 *
 * Verifies:
 * 1. Dedicated CommissionEligibilityService:
 *    - isEligibleForLevel(upline, level)
 *    - isEligibleForLevel1(upline)
 *    - isEligibleForLevel2(upline)
 *    - isEligibleForLevel3(upline)
 *    - isEligibleForLevel4(upline)
 *    - isEligibleForLevel5(upline)
 *    - evaluateAllLevels(upline)
 *    - filterEligibleUplines(uplines)
 * 2. Strict Business Invariant:
 *    "Do NOT mix eligibility rules into the percentage calculation."
 *    "Keep rank and commission-level concepts separate."
 * 3. Explicitly Confirmed Rules by Default:
 *    - Level 1 = 24%, Level 2 = 8%, Level 3 = 13%, Level 4 = 5%, Level 5 = 4%.
 *    - Active distributors (status === 'ACTIVE', not deleted) qualify for ALL levels.
 *    - Inactive / suspended / deleted distributors are rejected with detailed reasons.
 * 4. STRICT NON-ASSUMPTION OF RANKS:
 *    "Do not silently assume:
 *      Silver   = Level 1
 *      Gold     = Level 2
 *      Platinum = Level 3
 *      Diamond  = Level 4
 *      Ruby     = Level 5
 *    unless this is explicitly configured by the business."
 *    - A Base rank distributor with ACTIVE status is ELIGIBLE for Levels 1, 2, 3, 4, 5.
 * 5. Extensibility for Future Configurable Rules:
 *    - Minimum rank (configured explicitly)
 *    - Active membership
 *    - KYC verification
 *    - Account status
 *    - Personal Business Volume (PBV) threshold
 *    - Activity qualification period
 *    - Commission cap
 * 6. Integration with CommissionCalculationService:
 *    - Calculation engine delegates to eligibility service seamlessly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import { CommissionEligibilityService } from '../src/services/commissionEligibility.service';
import { CommissionCalculationService } from '../src/services/commissionCalculation.service';
import { SponsorUplineService, UplineNode } from '../src/services/sponsorUpline.service';

describe('COMMISSION ELIGIBILITY ENGINE (PROMPT 17 TEST SUITE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Always reset rule configurations to baseline confirmed rules before each test
    CommissionEligibilityService.resetRuleConfigs();

    // Mock interactive transactions so tests run cleanly
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);
  });

  const baseActiveDistributor = {
    id: 'uuid-base-01',
    distributorId: 'KV-BASE',
    distributorCode: 'KV-BASE',
    firstName: 'Bob',
    lastName: 'Base',
    displayName: 'Bob Base',
    status: 'ACTIVE',
    deletedAt: null,
    lifetimePV: 100 as any,
    currentBB: 50 as any,
    activatedAt: new Date(),
    user: { id: 'usr-01', status: 'ACTIVE', email: 'bob.base@example.com' },
    kycProfile: { id: 'kyc-01', status: 'PENDING' },
    currentLevel: { id: 'lvl-0', code: 'BASE', name: 'Base', order: 0 },
    currentRank: { id: 'rnk-0', name: 'Base' },
  };

  const goldActiveDistributor = {
    id: 'uuid-gold-02',
    distributorId: 'KV-GOLD',
    distributorCode: 'KV-GOLD',
    firstName: 'Grace',
    lastName: 'Gold',
    displayName: 'Grace Gold',
    status: 'ACTIVE',
    deletedAt: null,
    lifetimePV: 500 as any,
    currentBB: 250 as any,
    activatedAt: new Date(),
    user: { id: 'usr-02', status: 'ACTIVE', email: 'grace.gold@example.com' },
    kycProfile: { id: 'kyc-02', status: 'VERIFIED' },
    currentLevel: { id: 'lvl-2', code: 'GOLD', name: 'Gold', order: 2 },
    currentRank: { id: 'rnk-2', name: 'Gold' },
  };

  const inactiveDistributor = {
    id: 'uuid-inact-03',
    distributorId: 'KV-INACT',
    distributorCode: 'KV-INACT',
    firstName: 'Ian',
    lastName: 'Inactive',
    displayName: 'Ian Inactive',
    status: 'INACTIVE',
    deletedAt: null,
    lifetimePV: 0 as any,
    currentBB: 0 as any,
    user: { id: 'usr-03', status: 'INACTIVE', email: 'ian.inactive@example.com' },
    kycProfile: null,
    currentLevel: { id: 'lvl-0', code: 'BASE', name: 'Base', order: 0 },
    currentRank: { id: 'rnk-0', name: 'Base' },
  };

  const suspendedDistributor = {
    id: 'uuid-susp-04',
    distributorId: 'KV-SUSP',
    distributorCode: 'KV-SUSP',
    firstName: 'Sam',
    lastName: 'Suspended',
    displayName: 'Sam Suspended',
    status: 'SUSPENDED',
    deletedAt: null,
    lifetimePV: 50 as any,
    currentBB: 10 as any,
    user: { id: 'usr-04', status: 'SUSPENDED', email: 'sam.suspended@example.com' },
    kycProfile: null,
    currentLevel: { id: 'lvl-0', code: 'BASE', name: 'Base', order: 0 },
    currentRank: { id: 'rnk-0', name: 'Base' },
  };

  // ==========================================================================
  // SECTION 1: LEVEL-BY-LEVEL ELIGIBILITY DETERMINATION
  // ==========================================================================
  describe('1. Level-by-Level Eligibility Determination (Levels 1 to 5)', () => {
    it('isEligibleForLevel1: determines if upline is eligible for Level 1 commission (24%)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel1('uuid-base-01');
      expect(check.isEligible).toBe(true);
      expect(check.level).toBe(1);
      expect(check.distributorId).toBe('uuid-base-01');
      expect(check.reasons).toHaveLength(0);
      expect(check.passedRules).toContain('Membership status is active (ACTIVE)');
    });

    it('isEligibleForLevel2: determines if upline is eligible for Level 2 commission (8%)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel2('uuid-base-01');
      expect(check.isEligible).toBe(true);
      expect(check.level).toBe(2);
    });

    it('isEligibleForLevel3: determines if upline is eligible for Level 3 commission (13%)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel3('uuid-base-01');
      expect(check.isEligible).toBe(true);
      expect(check.level).toBe(3);
    });

    it('isEligibleForLevel4: determines if upline is eligible for Level 4 commission (5%)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel4('uuid-base-01');
      expect(check.isEligible).toBe(true);
      expect(check.level).toBe(4);
    });

    it('isEligibleForLevel5: determines if upline is eligible for Level 5 commission (4%)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel5('uuid-base-01');
      expect(check.isEligible).toBe(true);
      expect(check.level).toBe(5);
    });

    it('checkEligibility boolean helper returns true for active distributor', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      const result = await CommissionEligibilityService.checkEligibility('uuid-base-01', 3);
      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 2: NO INVENTED RANK ASSUMPTIONS (STRICT INVARIANT)
  // ==========================================================================
  describe('2. Strict Non-Assumption of Career Ranks for Commission Levels', () => {
    it('MUST NOT silently assume Silver=L1, Gold=L2, Platinum=L3, Diamond=L4, Ruby=L5', async () => {
      // Bob is at BASE rank (order 0)
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);

      // Verify Bob qualifies for ALL 5 levels under confirmed business rules
      const report = await CommissionEligibilityService.evaluateAllLevels('uuid-base-01');

      expect(report.overallEligible).toBe(true);
      expect(report.levels[1].isEligible).toBe(true);
      expect(report.levels[2].isEligible).toBe(true);
      expect(report.levels[3].isEligible).toBe(true);
      expect(report.levels[4].isEligible).toBe(true);
      expect(report.levels[5].isEligible).toBe(true);

      // Verify that no rank requirement is listed in reasons
      expect(report.levels[1].passedRules).toContain('No rank requirement enforced for Level 1 (default confirmed rule)');
      expect(report.levels[5].passedRules).toContain('No rank requirement enforced for Level 5 (default confirmed rule)');
    });

    it('evaluates UplineNode directly without requiring database round-trip', async () => {
      const uplineNode: UplineNode = {
        level: 1,
        distributorId: 'node-dist-01',
        distributorCode: 'KV-NODE',
        displayName: 'Node Member',
        status: 'ACTIVE',
        sponsorId: null,
        isDirect: true,
        isActive: true,
        isEligibleForCommission: true,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      const check = await CommissionEligibilityService.isEligibleForLevel(uplineNode, 1);
      expect(check.isEligible).toBe(true);
      expect(check.criteria.accountActive).toBe(true);
      expect(check.reasons).toHaveLength(0);
    });
  });

  // ==========================================================================
  // SECTION 3: INACTIVE, SUSPENDED, DELETED REJECTIONS
  // ==========================================================================
  describe('3. Account Status & Inactivity Enforcement', () => {
    it('rejects INACTIVE distributor with clear explanation', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(inactiveDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel('uuid-inact-03', 1);
      expect(check.isEligible).toBe(false);
      expect(check.reasons.some((r) => r.includes('not active (Status: INACTIVE)'))).toBe(true);
    });

    it('rejects SUSPENDED distributor with clear explanation', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(suspendedDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel('uuid-susp-04', 2);
      expect(check.isEligible).toBe(false);
      expect(check.reasons.some((r) => r.includes('not active (Status: SUSPENDED)'))).toBe(true);
    });

    it('rejects soft-deleted distributor', async () => {
      const deletedDistributor = {
        ...baseActiveDistributor,
        deletedAt: new Date(),
      };
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(deletedDistributor as any);

      const check = await CommissionEligibilityService.isEligibleForLevel('uuid-base-01', 1);
      expect(check.isEligible).toBe(false);
      expect(check.reasons.some((r) => r.includes('deleted / terminated'))).toBe(true);
    });

    it('rejects non-existent upline distributor ID', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      const check = await CommissionEligibilityService.isEligibleForLevel('non-existent-id', 1);
      expect(check.isEligible).toBe(false);
      expect(check.reasons.some((r) => r.includes('not found in system'))).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 4: FUTURE RULE EXTENSIBILITY (EXPLICIT CONFIGURATION)
  // ==========================================================================
  describe('4. Future Rule Extensibility & Pluggable Configurations', () => {
    it('supports explicitly configuring a minimum rank requirement for Level 3 (e.g. GOLD)', async () => {
      // Configure Level 3 to require GOLD rank
      CommissionEligibilityService.setRuleConfig(3, { minimumRank: 'GOLD' });

      // 1. Base rank distributor fails Level 3
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);
      const baseCheck = await CommissionEligibilityService.isEligibleForLevel3('uuid-base-01');
      expect(baseCheck.isEligible).toBe(false);
      expect(baseCheck.reasons.some((r) => r.includes('Minimum rank requirement for Level 3 not met'))).toBe(true);

      // But Base rank member still qualifies for Level 1 (no rank rule configured on L1)
      const baseL1Check = await CommissionEligibilityService.isEligibleForLevel1('uuid-base-01');
      expect(baseL1Check.isEligible).toBe(true);

      // 2. Gold rank distributor passes Level 3
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(goldActiveDistributor as any);
      const goldCheck = await CommissionEligibilityService.isEligibleForLevel3('uuid-gold-02');
      expect(goldCheck.isEligible).toBe(true);
      expect(goldCheck.passedRules.some((p) => p.includes('Minimum rank requirement met'))).toBe(true);
    });

    it('supports explicitly configuring KYC verification requirement', async () => {
      // Configure Level 1 to require verified KYC
      CommissionEligibilityService.setRuleConfig(1, { requireKycApproved: true });

      // Base distributor has PENDING KYC -> fails
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);
      const checkPending = await CommissionEligibilityService.isEligibleForLevel1('uuid-base-01');
      expect(checkPending.isEligible).toBe(false);
      expect(checkPending.reasons.some((r) => r.includes('KYC verification required'))).toBe(true);

      // Gold distributor has VERIFIED KYC -> passes
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(goldActiveDistributor as any);
      const checkVerified = await CommissionEligibilityService.isEligibleForLevel1('uuid-gold-02');
      expect(checkVerified.isEligible).toBe(true);
    });

    it('supports explicitly configuring personal volume (minPersonalBV) threshold', async () => {
      // Configure Level 2 to require at least 200 Personal BV
      CommissionEligibilityService.setRuleConfig(2, { minPersonalBV: 200 });

      // Base member has 100 PBV -> fails
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(baseActiveDistributor as any);
      const baseCheck = await CommissionEligibilityService.isEligibleForLevel2('uuid-base-01');
      expect(baseCheck.isEligible).toBe(false);
      expect(baseCheck.reasons.some((r) => r.includes('Minimum personal volume not met'))).toBe(true);

      // Gold member has 500 PBV -> passes
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(goldActiveDistributor as any);
      const goldCheck = await CommissionEligibilityService.isEligibleForLevel2('uuid-gold-02');
      expect(goldCheck.isEligible).toBe(true);
    });

    it('resetRuleConfigs restores original rules with zero rank requirements', () => {
      CommissionEligibilityService.setRuleConfig(3, { minimumRank: 'RUBY', requireKycApproved: true });
      expect(CommissionEligibilityService.getRuleConfig(3).minimumRank).toBe('RUBY');

      CommissionEligibilityService.resetRuleConfigs();
      expect(CommissionEligibilityService.getRuleConfig(3).minimumRank).toBeNull();
      expect(CommissionEligibilityService.getRuleConfig(3).requireKycApproved).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 5: FILTERING UPLINE NODES
  // ==========================================================================
  describe('5. filterEligibleUplines(uplines)', () => {
    it('filters out inactive upline nodes while preserving generation levels', async () => {
      const uplines: UplineNode[] = [
        { level: 1, distributorId: 'u1', distributorCode: 'KV-1', displayName: 'Upline 1', status: 'ACTIVE', sponsorId: null, isDirect: true, isActive: true, isEligibleForCommission: true },
        { level: 2, distributorId: 'u2', distributorCode: 'KV-2', displayName: 'Upline 2', status: 'INACTIVE', sponsorId: null, isDirect: false, isActive: false, isEligibleForCommission: false },
        { level: 3, distributorId: 'u3', distributorCode: 'KV-3', displayName: 'Upline 3', status: 'ACTIVE', sponsorId: null, isDirect: false, isActive: true, isEligibleForCommission: true },
      ];

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      const eligible = await CommissionEligibilityService.filterEligibleUplines(uplines);

      expect(eligible).toHaveLength(2);
      expect(eligible.map((e) => e.level)).toEqual([1, 3]);
      expect(eligible.map((e) => e.distributorId)).toEqual(['u1', 'u3']);
    });
  });

  // ==========================================================================
  // SECTION 6: INTEGRATION WITH COMMISSION CALCULATION ENGINE
  // ==========================================================================
  describe('6. Integration with CommissionCalculationService', () => {
    it('CommissionCalculationService delegates eligibility checks to CommissionEligibilityService', async () => {
      const eligibilitySpy = vi.spyOn(CommissionEligibilityService, 'isEligibleForLevel');

      const mockPurchaser = {
        id: 'purchaser-id',
        distributorId: 'KV-P',
        distributorCode: 'KV-P',
        firstName: 'Paul',
        lastName: 'Purchaser',
        displayName: 'Paul Purchaser',
        status: 'ACTIVE',
        sponsorId: 'upline-1',
        deletedAt: null,
      };

      const mockUplineChain: UplineNode[] = [
        { level: 1, distributorId: 'upline-1', distributorCode: 'KV-U1', displayName: 'Upline One', status: 'ACTIVE', sponsorId: null, isDirect: true, isActive: true, isEligibleForCommission: true },
      ];

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);
      vi.spyOn(SponsorUplineService, 'resolveMemberProfile').mockResolvedValue(mockPurchaser as any);
      vi.spyOn(SponsorUplineService, 'getUplineChain').mockResolvedValue(mockUplineChain);

      const breakdown = await CommissionCalculationService.calculateUplineCommission(
        'purchaser-id',
        10000
      );

      // Assert eligibility service was called
      expect(eligibilitySpy).toHaveBeenCalled();
      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].commissionAmount).toBe(2400.0);
    });
  });
});
