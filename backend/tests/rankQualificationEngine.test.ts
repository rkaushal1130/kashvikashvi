import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  AutomaticRankQualificationEngine,
  RankQualificationEngine,
  LevelService,
  CANONICAL_LEVELS,
} from '../src/services';
import { BBService } from '../src/services/bb.service';
import { BinaryVolumeService } from '../src/services/binaryVolume.service';
import { MatchingService } from '../src/services/matching.service';

describe('PROMPT 6: AUTOMATIC MLM RANK QUALIFICATION ENGINE TESTS', () => {
  const mockMemberId = 'dist-mem-prompt6-001';

  const createMockDistributor = (overrides?: any) => ({
    id: mockMemberId,
    distributorCode: 'KV-60001',
    distributorId: 'KV-60001',
    currentBB: 0,
    currentMatching: 0,
    currentLevelId: null,
    currentRankId: null,
    currentLevel: null,
    currentRank: null,
    highestRank: null,
    user: { firstName: 'Binary', lastName: 'Leader' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests execute synchronously without hanging
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Provide default resolved mocks for Prisma models so tests never hang trying to connect to port 5432
    vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).level, 'create').mockImplementation(async ({ data }: any) => ({
      id: `lvl-${data.code}`,
      ...data,
    }));
    vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.rank, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.rank, 'create').mockImplementation(async ({ data }: any) => ({
      id: `rnk-${data.rankCode}`,
      ...data,
    }));
    vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async () => createMockDistributor() as any);
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async () => createMockDistributor() as any);
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);
    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'hist-6001',
      ...data,
    }));
    vi.spyOn((prisma as any).bVLedger, 'aggregate').mockResolvedValue({ _sum: { bv: 0 } });
  });

  // =========================================================================
  // 1. QUALIFICATION FORMULA: ALL THREE CONDITIONS ARE MANDATORY
  // =========================================================================
  describe('1. Exact Qualification Formula (Examples 1-5)', () => {
    it('Example 1: BB = 250, Left = 2000, Right = 2000 => SILVER', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 250, leftMatching: 2000, rightMatching: 2000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('SILVER');
      expect(evaluation.eligibleLevel.order).toBe(1);
      expect(evaluation.currentBB).toBe(250);
      expect(evaluation.currentLeftMatching).toBe(2000);
      expect(evaluation.currentRightMatching).toBe(2000);
    });

    it('Example 2: BB = 250, Left = 5000, Right = 5000 => GOLD', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 250, leftMatching: 5000, rightMatching: 5000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('GOLD');
      expect(evaluation.eligibleLevel.order).toBe(2);
    });

    it('Example 3: BB = 500, Left = 50000, Right = 50000 => PLATINUM', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 500, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');
      expect(evaluation.eligibleLevel.order).toBe(3);
    });

    it('Example 4: BB = 1000, Left = 60000, Right = 60000 => DIAMOND', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 1000, leftMatching: 60000, rightMatching: 60000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('DIAMOND');
      expect(evaluation.eligibleLevel.order).toBe(4);
    });

    it('Example 5: BB = 1000, Left = 100000, Right = 100000 => RUBY', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 1000, leftMatching: 100000, rightMatching: 100000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.eligibleLevel.order).toBe(5);
    });
  });

  // =========================================================================
  // 2. DISQUALIFICATION: ALL THREE REQUIREMENTS ARE MANDATORY
  // =========================================================================
  describe('2. Disqualification: All Three Requirements are Mandatory', () => {
    it('BB = 500, Left = 50000, Right = 40000 => NOT PLATINUM (Right leg shortfall)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 500, leftMatching: 50000, rightMatching: 40000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('PLATINUM');
      // Right is 40,000, so it satisfies Gold (needs 5,000)
      expect(evaluation.eligibleLevel.code).toBe('GOLD');
    });

    it('BB = 500, Left = 40000, Right = 50000 => NOT PLATINUM (Left leg shortfall)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 500, leftMatching: 40000, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('PLATINUM');
      // Left is 40,000, so it satisfies Gold (needs 5,000)
      expect(evaluation.eligibleLevel.code).toBe('GOLD');
    });

    it('BB = 400, Left = 50000, Right = 50000 => NOT PLATINUM (BB shortfall: 400 < 500)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 400, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('PLATINUM');
      // BB 400 satisfies Gold (needs 250) and matching 50,000 satisfies Gold (needs 5,000)
      expect(evaluation.eligibleLevel.code).toBe('GOLD');
    });

    it('BB = 249, Left = 2000, Right = 2000 => NOT SILVER (BB shortfall: 249 < 250)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 249, leftMatching: 2000, rightMatching: 2000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('BASE');
    });

    it('BB = 250, Left = 1999, Right = 2000 => NOT SILVER (Left matching shortfall)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 250, leftMatching: 1999, rightMatching: 2000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('BASE');
    });

    it('BB = 250, Left = 2000, Right = 1999 => NOT SILVER (Right matching shortfall)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 250, leftMatching: 2000, rightMatching: 1999 }
      );

      expect(evaluation.eligibleLevel.code).toBe('BASE');
    });
  });

  // =========================================================================
  // 3. HIGHEST-TO-LOWEST EVALUATION & DIRECT MULTI-TIER PROMOTION
  // =========================================================================
  describe('3. Highest-to-Lowest Evaluation & Direct Qualification', () => {
    it('BB = 1500, Left = 150000, Right = 150000 => Directly qualifies for RUBY', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 1500, leftMatching: 150000, rightMatching: 150000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.eligibleLevel.order).toBe(5);
      expect(evaluation.isPromotionAvailable).toBe(true);
    });

    it('Direct jump from BASE to DIAMOND: BB = 1000, Left = 65000, Right = 65000', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 1000, leftMatching: 65000, rightMatching: 65000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('DIAMOND');
      expect(evaluation.eligibleLevel.order).toBe(4);
    });

    it('Direct jump from BASE to PLATINUM: BB = 600, Left = 52000, Right = 52000', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 600, leftMatching: 52000, rightMatching: 52000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');
      expect(evaluation.eligibleLevel.order).toBe(3);
    });

    it('Asymmetric volume evaluates to highest leg-balanced qualification (Left 150000, Right 4000 -> SILVER)', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        createMockDistributor(),
        { bb: 1000, leftMatching: 150000, rightMatching: 4000 }
      );

      // Right is 4,000, which is >= 2,000 (Silver), but < 5,000 (Gold)
      expect(evaluation.eligibleLevel.code).toBe('SILVER');
    });
  });

  // =========================================================================
  // 4. checkLevelQualification(memberId, levelId)
  // =========================================================================
  describe('4. checkLevelQualification(memberId, levelId)', () => {
    it('should return isQualified=true when all 3 qualifications for PLATINUM are satisfied', async () => {
      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        mockMemberId,
        'PLATINUM',
        { bb: 500, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
      expect(check.bbGap).toBe(0);
      expect(check.leftMatchingGap).toBe(0);
      expect(check.rightMatchingGap).toBe(0);
      expect(check.targetLevel.code).toBe('PLATINUM');
    });

    it('should return isQualified=false and correct gap when Right leg is short for PLATINUM', async () => {
      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        mockMemberId,
        'PLATINUM',
        { bb: 500, leftMatching: 50000, rightMatching: 40000 }
      );

      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(false);
      expect(check.bbGap).toBe(0);
      expect(check.leftMatchingGap).toBe(0);
      expect(check.rightMatchingGap).toBe(10000); // 50,000 - 40,000
    });

    it('should support checking by level order number (e.g. order 5 for RUBY)', async () => {
      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        mockMemberId,
        5,
        { bb: 1000, leftMatching: 100000, rightMatching: 100000 }
      );

      expect(check.targetLevel.code).toBe('RUBY');
      expect(check.isQualified).toBe(true);
    });

    it('should throw badRequest on unknown level identifier', async () => {
      await expect(
        AutomaticRankQualificationEngine.checkLevelQualification(mockMemberId, 'UNKNOWN_TIER')
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 5. promoteMember(memberId, levelId)
  // =========================================================================
  describe('5. promoteMember(memberId, levelId)', () => {
    it('should promote member directly to RUBY when eligible and create history record', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(createMockDistributor() as any);

      const result = await AutomaticRankQualificationEngine.promoteMember(mockMemberId, {
        overrideBB: 1500,
        overrideLeftMatching: 150000,
        overrideRightMatching: 150000,
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.newLevel.code).toBe('RUBY');
      expect(result.snapshot.qualifiedBB).toBe(1500);
      expect(result.snapshot.qualifiedLeftMatching).toBe(150000);
      expect(result.snapshot.qualifiedRightMatching).toBe(150000);
    });

    it('should promote to specific levelId when member qualifies', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(createMockDistributor() as any);

      // Member has volumes for Gold
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(5000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(5000);

      const result = await AutomaticRankQualificationEngine.promoteMember(mockMemberId, 'GOLD');

      expect(result.promoted).toBe(true);
      expect(result.newLevel.code).toBe('GOLD');
    });

    it('should NOT promote when member does NOT meet all 3 qualifications for specified levelId', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(createMockDistributor() as any);

      // Member only has volumes for Silver (2000), not Platinum (50,000)
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(2000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(2000);

      const result = await AutomaticRankQualificationEngine.promoteMember(mockMemberId, 'PLATINUM');

      expect(result.promoted).toBe(false);
      expect(result.message).toContain('does not satisfy all 3 qualifications');
    });

    it('should NOT demote member if specified level is lower than or equal to current level', async () => {
      const mockGoldDistributor = createMockDistributor({
        currentLevel: { order: 2, code: 'GOLD', name: 'Gold' },
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockGoldDistributor as any);

      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(2000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(2000);

      const result = await AutomaticRankQualificationEngine.promoteMember(mockMemberId, 'SILVER');

      expect(result.promoted).toBe(false);
      expect(result.newLevel.code).toBe('GOLD');
      expect(result.message).toContain('No demotion allowed');
    });
  });

  // =========================================================================
  // 6. recalculateMemberLevel(memberId)
  // =========================================================================
  describe('6. recalculateMemberLevel(memberId)', () => {
    it('should audit BB, Left Matching, and Right Matching and promote member if eligible', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(createMockDistributor() as any);

      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(60000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(60000);

      const audit = await AutomaticRankQualificationEngine.recalculateMemberLevel(mockMemberId);

      expect(audit.auditedBB).toBe(1000);
      expect(audit.auditedLeftMatching).toBe(60000);
      expect(audit.auditedRightMatching).toBe(60000);
      expect(audit.previousLevel.code).toBe('BASE');
      expect(audit.evaluatedEligibleLevel.code).toBe('DIAMOND');
      expect(audit.promoted).toBe(true);
    });

    it('should NOT demote member when volume drops during recalculation', async () => {
      const mockDiamondDistributor = createMockDistributor({
        currentLevel: { order: 4, code: 'DIAMOND', name: 'Diamond' },
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDiamondDistributor as any);

      // Volume dropped to 0
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(0);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(0);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(0);

      const audit = await AutomaticRankQualificationEngine.recalculateMemberLevel(mockMemberId);

      expect(audit.previousLevel.code).toBe('DIAMOND');
      expect(audit.promoted).toBe(false);
    });
  });

  // =========================================================================
  // 7. getMemberLevelProgress(memberId)
  // =========================================================================
  describe('7. getMemberLevelProgress(memberId)', () => {
    it('should return authoritative progress metrics toward next tier', async () => {
      const mockSilverDistributor = createMockDistributor({
        currentLevel: {
          order: 1,
          code: 'SILVER',
          name: 'Silver',
          requiredBB: 250,
          requiredLeftMatching: 2000,
          requiredRightMatching: 2000,
        },
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);

      // Member at Silver has BB = 250, Left = 3000, Right = 4000.
      // Next tier is GOLD (BB = 250, Left = 5000, Right = 5000).
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(3000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(4000);

      const progress = await AutomaticRankQualificationEngine.getMemberLevelProgress(mockMemberId);

      expect(progress.currentLevel.code).toBe('SILVER');
      expect(progress.nextLevel?.code).toBe('GOLD');
      expect(progress.currentBB).toBe(250);
      expect(progress.currentLeftMatching).toBe(3000);
      expect(progress.currentRightMatching).toBe(4000);
      expect(progress.bbGap).toBe(0); // 250 - 250
      expect(progress.leftMatchingGap).toBe(2000); // 5000 - 3000
      expect(progress.rightMatchingGap).toBe(1000); // 5000 - 4000
      expect(progress.matchingGap).toBe(2000); // max(2000, 1000)
      expect(progress.isQualifiedForNext).toBe(false);
    });

    it('should indicate maxLevel reached for RUBY member', async () => {
      const mockRubyDistributor = createMockDistributor({
        currentLevel: {
          order: 5,
          code: 'RUBY',
          name: 'Ruby',
          requiredBB: 1000,
          requiredLeftMatching: 100000,
          requiredRightMatching: 100000,
        },
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockRubyDistributor as any);

      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(100000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(100000);

      const progress = await AutomaticRankQualificationEngine.getMemberLevelProgress(mockMemberId);

      expect(progress.currentLevel.code).toBe('RUBY');
      expect(progress.nextLevel).toBeNull();
      expect(progress.isMaxLevel).toBe(true);
      expect(progress.isQualifiedForNext).toBe(false);
    });
  });

  // =========================================================================
  // 8. BACKEND IS THE SINGLE SOURCE OF TRUTH
  // =========================================================================
  describe('8. Backend as Single Source of Truth', () => {
    it('pure helper isRankQualified verifies all conditions synchronously without database dependency', () => {
      const silver = CANONICAL_LEVELS.find((l) => l.code === 'SILVER')!;
      const gold = CANONICAL_LEVELS.find((l) => l.code === 'GOLD')!;
      const platinum = CANONICAL_LEVELS.find((l) => l.code === 'PLATINUM')!;
      const diamond = CANONICAL_LEVELS.find((l) => l.code === 'DIAMOND')!;
      const ruby = CANONICAL_LEVELS.find((l) => l.code === 'RUBY')!;

      // Valid cases
      expect(AutomaticRankQualificationEngine.isRankQualified(250, 2000, 2000, silver)).toBe(true);
      expect(AutomaticRankQualificationEngine.isRankQualified(250, 5000, 5000, gold)).toBe(true);
      expect(AutomaticRankQualificationEngine.isRankQualified(500, 50000, 50000, platinum)).toBe(true);
      expect(AutomaticRankQualificationEngine.isRankQualified(1000, 60000, 60000, diamond)).toBe(true);
      expect(AutomaticRankQualificationEngine.isRankQualified(1000, 100000, 100000, ruby)).toBe(true);

      // Disqualifications
      expect(AutomaticRankQualificationEngine.isRankQualified(500, 50000, 40000, platinum)).toBe(false);
      expect(AutomaticRankQualificationEngine.isRankQualified(500, 40000, 50000, platinum)).toBe(false);
      expect(AutomaticRankQualificationEngine.isRankQualified(400, 50000, 50000, platinum)).toBe(false);
    });

    it('RankQualificationEngine alias behaves identically to AutomaticRankQualificationEngine', () => {
      expect(RankQualificationEngine).toBe(AutomaticRankQualificationEngine);
      expect(typeof RankQualificationEngine.calculateEligibleLevel).toBe('function');
      expect(typeof RankQualificationEngine.checkLevelQualification).toBe('function');
      expect(typeof RankQualificationEngine.promoteMember).toBe('function');
      expect(typeof RankQualificationEngine.recalculateMemberLevel).toBe('function');
      expect(typeof RankQualificationEngine.getMemberLevelProgress).toBe('function');
    });
  });
});
