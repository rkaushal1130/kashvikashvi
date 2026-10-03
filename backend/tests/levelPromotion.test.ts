import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  LevelService,
  CANONICAL_LEVELS,
  LevelDefinition,
} from '../src/services/level.service';
import { BBService } from '../src/services/bb.service';
import { MatchingService } from '../src/services/matching.service';

describe('AUTOMATIC MLM LEVEL PROMOTION ENGINE TESTS (PROMPT 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests run synchronously and cleanly
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
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({ userId: 'usr-001' } as any);
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);
    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'hist-default',
      ...data,
    }));
  });

  const mockBaseDistributor = {
    id: 'dist-base-001',
    distributorCode: 'DST-50001',
    distributorId: 'KV-5001',
    currentBB: 0,
    currentMatching: 0,
    currentLevelId: null,
    currentRankId: null,
    currentLevel: null,
    currentRank: null,
    highestRank: null,
    user: { firstName: 'Alice', lastName: 'Member' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSilverDistributor = {
    id: 'dist-silver-001',
    distributorCode: 'DST-50002',
    distributorId: 'KV-5002',
    currentBB: 250,
    currentMatching: 2000,
    currentLevelId: 'lvl-silver-id',
    currentRankId: 'rank-silver-id',
    currentLevel: {
      id: 'lvl-silver-id',
      code: 'SILVER',
      name: 'Silver',
      order: 1,
      requiredBB: 250,
      requiredMatching: 2000,
    },
    currentRank: {
      id: 'rank-silver-id',
      rankCode: 'RANK_SILVER',
      name: 'Silver',
      level: 1,
    },
    highestRank: {
      id: 'rank-silver-id',
      rankCode: 'RANK_SILVER',
      name: 'Silver',
      level: 1,
    },
    user: { firstName: 'Bob', lastName: 'Leader' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRubyDistributor = {
    id: 'dist-ruby-001',
    distributorCode: 'DST-50003',
    distributorId: 'KV-5003',
    currentBB: 1000,
    currentMatching: 100000,
    currentLevelId: 'lvl-ruby-id',
    currentRankId: 'rank-ruby-id',
    currentLevel: {
      id: 'lvl-ruby-id',
      code: 'RUBY',
      name: 'Ruby',
      order: 5,
      requiredBB: 1000,
      requiredMatching: 100000,
    },
    currentRank: {
      id: 'rank-ruby-id',
      rankCode: 'RANK_RUBY',
      name: 'Ruby',
      level: 5,
    },
    highestRank: {
      id: 'rank-ruby-id',
      rankCode: 'RANK_RUBY',
      name: 'Ruby',
      level: 5,
    },
    user: { firstName: 'Carol', lastName: 'Executive' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // =========================================================================
  // 1. CANONICAL HIERARCHY & LEVELS DEFINITION
  // =========================================================================
  describe('1. Canonical Hierarchy & Level Specifications', () => {
    it('should define the 6 mandatory canonical tiers in exact rank order 0 to 5', () => {
      expect(CANONICAL_LEVELS).toHaveLength(6);

      const codes = CANONICAL_LEVELS.map((l) => l.code);
      expect(codes).toEqual(['BASE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'RUBY']);

      const orders = CANONICAL_LEVELS.map((l) => l.order);
      expect(orders).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should have exact mandatory BB and Matching thresholds per specification', () => {
      const silver = CANONICAL_LEVELS.find((l) => l.code === 'SILVER')!;
      expect(silver.requiredBB).toBe(250);
      expect(silver.requiredMatching).toBe(2000);

      const gold = CANONICAL_LEVELS.find((l) => l.code === 'GOLD')!;
      expect(gold.requiredBB).toBe(250);
      expect(gold.requiredMatching).toBe(5000);

      const platinum = CANONICAL_LEVELS.find((l) => l.code === 'PLATINUM')!;
      expect(platinum.requiredBB).toBe(500);
      expect(platinum.requiredMatching).toBe(50000);

      const diamond = CANONICAL_LEVELS.find((l) => l.code === 'DIAMOND')!;
      expect(diamond.requiredBB).toBe(1000);
      expect(diamond.requiredMatching).toBe(60000);

      const ruby = CANONICAL_LEVELS.find((l) => l.code === 'RUBY')!;
      expect(ruby.requiredBB).toBe(1000);
      expect(ruby.requiredMatching).toBe(100000);
    });
  });

  // =========================================================================
  // 2. MANDATORY DUAL QUALIFICATION (BB AND MATCHING BOTH REQUIRED)
  // =========================================================================
  describe('2. Mandatory Dual Qualification Rule', () => {
    it('Example 1: BB = 300, Matching = 1500 -> Result: NOT SILVER', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(300);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(1500);

      const qual = await LevelService.checkLevelQualification('dist-base-001', 'SILVER');

      expect(qual.bbSatisfied).toBe(true); // 300 >= 250
      expect(qual.matchingSatisfied).toBe(false); // 1500 < 2000
      expect(qual.isQualified).toBe(false); // NOT SILVER
      expect(qual.matchingGap).toBe(500); // 2000 - 1500
    });

    it('Example 2: BB = 250, Matching = 2000 -> Result: SILVER', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      const qual = await LevelService.checkLevelQualification('dist-base-001', 'SILVER');

      expect(qual.bbSatisfied).toBe(true);
      expect(qual.matchingSatisfied).toBe(true);
      expect(qual.isQualified).toBe(true); // SILVER
      expect(qual.bbGap).toBe(0);
      expect(qual.matchingGap).toBe(0);
    });

    it('Example 3: BB = 1000, Matching = 100000 -> Result: RUBY', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(100000);

      const qual = await LevelService.checkLevelQualification('dist-base-001', 'RUBY');

      expect(qual.bbSatisfied).toBe(true);
      expect(qual.matchingSatisfied).toBe(true);
      expect(qual.isQualified).toBe(true); // RUBY
    });

    it('should reject Ruby if BB is 999 even if Matching is 200,000', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(999);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(200000);

      const qual = await LevelService.checkLevelQualification('dist-base-001', 'RUBY');

      expect(qual.bbSatisfied).toBe(false);
      expect(qual.matchingSatisfied).toBe(true);
      expect(qual.isQualified).toBe(false);
      expect(qual.bbGap).toBe(1);
    });

    it('should reject Platinum if Matching is 49,999 even if BB is 5000', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(5000);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(49999);

      const qual = await LevelService.checkLevelQualification('dist-base-001', 'PLATINUM');

      expect(qual.bbSatisfied).toBe(true);
      expect(qual.matchingSatisfied).toBe(false);
      expect(qual.isQualified).toBe(false);
      expect(qual.matchingGap).toBe(1);
    });
  });

  // =========================================================================
  // 3. HIGHEST-TO-LOWEST MULTI-TIER EVALUATION (calculateEligibleLevel)
  // =========================================================================
  describe('3. Highest-to-Lowest Multi-Tier Evaluation', () => {
    it('Example: BB = 1200, Matching = 120000 -> Directly qualifies for RUBY (not merely Silver)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1200);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(120000);

      const evaluation = await LevelService.calculateEligibleLevel('dist-base-001');

      expect(evaluation.evaluatedFromHighest).toBe(true);
      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.eligibleLevel.order).toBe(5);
      expect(evaluation.isPromotionAvailable).toBe(true);
    });

    it('Direct Jump: Member at BASE with BB = 300, Matching = 6000 -> Qualifies for GOLD', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(300);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(6000);

      const evaluation = await LevelService.calculateEligibleLevel('dist-base-001');

      expect(evaluation.eligibleLevel.code).toBe('GOLD');
      expect(evaluation.eligibleLevel.order).toBe(2);
      expect(evaluation.isPromotionAvailable).toBe(true);
    });

    it('Direct Jump: Member at BASE with BB = 600, Matching = 55000 -> Qualifies for PLATINUM', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(600);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(55000);

      const evaluation = await LevelService.calculateEligibleLevel('dist-base-001');

      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');
      expect(evaluation.eligibleLevel.order).toBe(3);
    });

    it('Direct Jump: Member at BASE with BB = 1000, Matching = 65000 -> Qualifies for DIAMOND', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(65000);

      const evaluation = await LevelService.calculateEligibleLevel('dist-base-001');

      expect(evaluation.eligibleLevel.code).toBe('DIAMOND');
      expect(evaluation.eligibleLevel.order).toBe(4);
    });

    it('Partial Qualification: BB = 1200, Matching = 45000 -> Qualifies for GOLD (not Platinum or Diamond)', async () => {
      // BB satisfies up to Ruby (1000), but Matching (45,000) only satisfies Gold (5,000), not Platinum (50,000)
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1200);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(45000);

      const evaluation = await LevelService.calculateEligibleLevel('dist-base-001');

      expect(evaluation.eligibleLevel.code).toBe('GOLD');
      expect(evaluation.eligibleLevel.order).toBe(2);
    });
  });

  // =========================================================================
  // 4. PROMOTION RULE & MEMBER LEVEL HISTORY AUDITING (promoteMember)
  // =========================================================================
  describe('4. Promotion Rule & MemberLevelHistory Auditing', () => {
    it('should promote member and create immutable MemberLevelHistory when eligibleLevel.order > currentLevel.order', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      const mockDbLevel = {
        id: 'db-lvl-silver',
        code: 'SILVER',
        name: 'Silver',
        order: 1,
      };
      const mockDbRank = {
        id: 'db-rnk-silver',
        rankCode: 'RANK_SILVER',
        name: 'Silver',
        level: 1,
      };

      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue(mockDbLevel);
      vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue(mockDbRank as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);

      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create').mockResolvedValue({
        id: 'hist-001',
        memberId: 'dist-base-001',
        previousLevelId: null,
        newLevelId: 'db-lvl-silver',
        previousBB: 0,
        previousMatching: 0,
        qualifyingBB: 250,
        qualifyingMatching: 2000,
        reason: 'Order volume qualification',
        source: 'ORDER_ACCRUAL',
        createdAt: new Date(),
      });

      const result = await LevelService.promoteMember('dist-base-001', {
        source: 'ORDER_ACCRUAL',
        reason: 'Order volume qualification',
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.newLevel.code).toBe('SILVER');
      expect(result.snapshot.qualifiedBB).toBe(250);
      expect(result.snapshot.qualifiedMatching).toBe(2000);

      // Verify MemberLevelHistory audit record was created with exact specifications
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: 'dist-base-001',
            newLevelId: 'db-lvl-silver',
            reason: 'Order volume qualification',
            source: 'ORDER_ACCRUAL',
          }),
        })
      );
    });

    it('should promote directly from BASE to RUBY in a single atomic promotion', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(100000);

      const mockDbLevel = { id: 'db-lvl-ruby', code: 'RUBY', name: 'Ruby', order: 5 };
      const mockDbRank = { id: 'db-rnk-ruby', rankCode: 'RANK_RUBY', name: 'Ruby', level: 5 };

      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue(mockDbLevel);
      vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue(mockDbRank as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockResolvedValue({ id: 'hist-002' });

      const result = await LevelService.promoteMember('dist-base-001', {
        source: 'ADMIN_RECALC',
        reason: 'Direct rapid qualification',
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.newLevel.code).toBe('RUBY');
      expect(result.snapshot.qualifiedBB).toBe(1000);
      expect(result.snapshot.qualifiedMatching).toBe(100000);
    });
  });

  // =========================================================================
  // 5. NO AUTOMATIC DEMOTION RULE
  // =========================================================================
  describe('5. No Automatic Demotion Rule', () => {
    it('should NOT demote a member if their volume drops below current level threshold', async () => {
      // Member currently at SILVER (order 1), but volume is now 0 BB and 0 Matching
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(0);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(0);

      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');
      const profileUpdateSpy = vi.spyOn(prisma.distributorProfile, 'update');

      const result = await LevelService.promoteMember('dist-silver-001');

      expect(result.promoted).toBe(false);
      expect(result.previousLevel.code).toBe('SILVER');
      expect(result.newLevel.code).toBe('SILVER'); // Maintains Silver!
      expect(result.message).toContain('No promotion necessary');

      // Crucial: No level history record or profile downgrade created
      expect(historyCreateSpy).not.toHaveBeenCalled();
      expect(profileUpdateSpy).not.toHaveBeenCalled();
    });

    it('should maintain RUBY level even if volume drops to zero', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockRubyDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(50);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(500);

      const result = await LevelService.promoteMember('dist-ruby-001');

      expect(result.promoted).toBe(false);
      expect(result.previousLevel.code).toBe('RUBY');
      expect(result.newLevel.code).toBe('RUBY');
    });
  });

  // =========================================================================
  // 6. IDEMPOTENCY & CONCURRENCY SAFETY
  // =========================================================================
  describe('6. Idempotency & Concurrency Safety', () => {
    it('should NOT create duplicate history records when the exact same promotion is triggered multiple times', async () => {
      // Scenario A: Member already holds the target level (order <= currentOrder)
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');

      const result1 = await LevelService.promoteMember('dist-silver-001', {
        source: 'SYSTEM_AUTO',
      });

      expect(result1.promoted).toBe(false);
      expect(result1.message).toContain('No promotion necessary');
      expect(historyCreateSpy).not.toHaveBeenCalled();

      // Scenario B: Member was at BASE, but recent history indicates they already received promotion to Silver
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue({
        id: 'hist-existing-silver',
        memberId: 'dist-base-001',
        newLevelId: 'lvl-silver-id',
        createdAt: new Date(),
      });

      const result2 = await LevelService.promoteMember('dist-base-001', {
        source: 'SYSTEM_AUTO',
      });

      expect(result2.promoted).toBe(false);
      expect(result2.message).toContain('already');
      expect(historyCreateSpy).not.toHaveBeenCalled();
    });

    it('should safely execute concurrent promotion requests without race conditions', async () => {
      let isPromoted = false;
      let historyRecordsCreated = 0;
      const createdHistories: any[] = [];

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async () => {
        if (!isPromoted) {
          return mockBaseDistributor as any;
        }
        return mockSilverDistributor as any;
      });

      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockImplementation(async () => {
        return createdHistories[createdHistories.length - 1] || null;
      });

      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => {
        historyRecordsCreated++;
        isPromoted = true;
        const record = { id: `hist-${historyRecordsCreated}`, ...data, createdAt: new Date() };
        createdHistories.push(record);
        return record;
      });

      // Fire two concurrent promotion requests
      const [res1, res2] = await Promise.all([
        LevelService.promoteMember('dist-base-001', { source: 'CONCURRENT_1' }),
        LevelService.promoteMember('dist-base-001', { source: 'CONCURRENT_2' }),
      ]);

      // Exactly one promotion happens, the second one is a safe no-op
      const promotedCount = [res1.promoted, res2.promoted].filter(Boolean).length;
      expect(promotedCount).toBe(1);
      expect(historyRecordsCreated).toBe(1);
    });
  });

  // =========================================================================
  // 7. EVENT HOOKS: BB CHANGE & MATCHING CHANGE
  // =========================================================================
  describe('7. Event Hooks (processLevelAfterBBChange & processLevelAfterMatchingChange)', () => {
    it('processLevelAfterBBChange should trigger promotion when BB threshold is satisfied', async () => {
      // Member already has Matching = 2500, now BB increases to 250
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2500);

      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue({
        id: 'lvl-silver-id',
        code: 'SILVER',
        name: 'Silver',
        order: 1,
      });
      vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue({
        id: 'rank-silver-id',
        rankCode: 'RANK_SILVER',
        name: 'Silver',
        level: 1,
      } as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockResolvedValue({ id: 'hist-bb-change' });

      const result = await LevelService.processLevelAfterBBChange('dist-base-001', 250);

      expect(result).not.toBeNull();
      expect(result?.promoted).toBe(true);
      expect(result?.newLevel.code).toBe('SILVER');
      expect(result?.snapshot.qualifiedBB).toBe(250);
    });

    it('processLevelAfterMatchingChange should trigger promotion when Matching threshold is satisfied', async () => {
      // Member already has BB = 300, now Matching increases to 2000
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(300);

      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue({
        id: 'lvl-silver-id',
        code: 'SILVER',
        name: 'Silver',
        order: 1,
      });
      vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue({
        id: 'rank-silver-id',
        rankCode: 'RANK_SILVER',
        name: 'Silver',
        level: 1,
      } as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockResolvedValue({ id: 'hist-match-change' });

      const result = await LevelService.processLevelAfterMatchingChange('dist-base-001', 2000);

      expect(result).not.toBeNull();
      expect(result?.promoted).toBe(true);
      expect(result?.newLevel.code).toBe('SILVER');
      expect(result?.snapshot.qualifiedMatching).toBe(2000);
    });
  });

  // =========================================================================
  // 8. RECALCULATION SERVICE (recalculateMemberLevel)
  // =========================================================================
  describe('8. Recalculation Engine', () => {
    it('should audit BB and Matching from scratch, evaluate highest level, and promote if eligible', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(500);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(50000);

      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue({
        id: 'lvl-plat-id',
        code: 'PLATINUM',
        name: 'Platinum',
        order: 3,
      });
      vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue({
        id: 'rank-plat-id',
        rankCode: 'RANK_PLATINUM',
        name: 'Platinum',
        level: 3,
      } as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockResolvedValue({ id: 'hist-recalc' });

      const audit = await LevelService.recalculateMemberLevel('dist-base-001', {
        source: 'ADMIN_RECALC',
      });

      expect(audit.auditedBB).toBe(500);
      expect(audit.auditedMatching).toBe(50000);
      expect(audit.previousLevel.code).toBe('BASE');
      expect(audit.evaluatedEligibleLevel.code).toBe('PLATINUM');
      expect(audit.promoted).toBe(true);
      expect(audit.promotionResult?.newLevel.code).toBe('PLATINUM');
    });
  });

  // =========================================================================
  // 9. LEVEL STATUS & PROGRESS METRICS (getMemberLevel)
  // =========================================================================
  describe('9. Member Level Status & Progress Metrics', () => {
    it('should return member level details and calculate gaps toward next level', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(3000);

      const status = await LevelService.getMemberLevel('dist-silver-001');

      expect(status.currentLevel.code).toBe('SILVER');
      expect(status.nextLevel?.code).toBe('GOLD'); // Next is Gold (order 2)
      expect(status.nextLevel?.requiredBB).toBe(250);
      expect(status.nextLevel?.requiredMatching).toBe(5000);

      // Gold requires BB 250, Matching 5000
      // Member has BB 250, Matching 3000
      expect(status.progress.bbGap).toBe(0);
      expect(status.progress.matchingGap).toBe(2000); // 5000 - 3000
      expect(status.progress.isQualifiedForNext).toBe(false);
      expect(status.isMaxLevel).toBe(false);
    });

    it('should correctly flag isMaxLevel for a Ruby executive', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockRubyDistributor as any);
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1500);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(150000);

      const status = await LevelService.getMemberLevel('dist-ruby-001');

      expect(status.currentLevel.code).toBe('RUBY');
      expect(status.nextLevel).toBeNull();
      expect(status.isMaxLevel).toBe(true);
      expect(status.progress.bbGap).toBe(0);
      expect(status.progress.matchingGap).toBe(0);
    });
  });

  // =========================================================================
  // 10. MEMBER LEVEL HISTORY LEDGER (getLevelHistory)
  // =========================================================================
  describe('10. Level History Ledger', () => {
    it('should return paginated history records from MemberLevelHistory table', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);

      const mockHistoryRecords = [
        {
          id: 'hist-1',
          memberId: 'dist-silver-001',
          previousLevel: { name: 'Base', order: 0 },
          newLevel: { name: 'Silver', order: 1 },
          qualifyingBB: 250,
          qualifyingMatching: 2000,
          reason: 'Initial qualification',
          source: 'SYSTEM_AUTO',
          createdAt: new Date(),
        },
      ];

      vi.spyOn((prisma as any).memberLevelHistory, 'findMany').mockResolvedValue(mockHistoryRecords);
      vi.spyOn((prisma as any).memberLevelHistory, 'count').mockResolvedValue(1);

      const history = await LevelService.getLevelHistory('dist-silver-001', { page: 1, limit: 10 });

      expect(history.total).toBe(1);
      expect(history.data).toHaveLength(1);
      expect(history.data[0].newLevel).toBe('Silver');
      expect(history.data[0].qualifyingBB).toBe(250);
      expect(history.data[0].qualifyingMatching).toBe(2000);
      expect(history.data[0].source).toBe('SYSTEM_AUTO');
    });
  });
});
