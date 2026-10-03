import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { LevelService, CANONICAL_LEVELS } from '../src/services/level.service';
import { BBService } from '../src/services/bb.service';
import { MatchingService } from '../src/services/matching.service';
import { LevelPromotionEventService } from '../src/services/levelPromotionEvent.service';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 9: COMPLETE MLM LEVEL ENGINE & REST API TEST SUITE', () => {
  const memberToken = createTestToken({
    id: 'usr-member-master-001',
    email: 'master.member@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const customerToken = createCustomerToken();
  const adminToken = createAdminToken();

  const mockMemberId = 'dist-master-001';

  const createMockDistributor = (overrides?: any) => ({
    id: mockMemberId,
    distributorCode: 'KV-MASTER-001',
    distributorId: 'KV-MASTER-001',
    currentBB: 0,
    currentMatching: 0,
    currentLevelId: null,
    currentRankId: null,
    currentLevel: null,
    currentRank: null,
    highestRank: null,
    user: { firstName: 'Master', lastName: 'Tester' },
    businessCenters: [],
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
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async ({ where }: any) => {
      const id = where?.id || where?.OR?.[0]?.id || mockMemberId;
      return createMockDistributor({ id }) as any;
    });
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async ({ where }: any) => {
      const id = where?.id || mockMemberId;
      return createMockDistributor({ id }) as any;
    });
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);

    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).memberLevelHistory, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'hist-master-001',
      ...data,
    }));

    // Mock BB and Matching transaction ledger calls
    vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn((prisma as any).bBTransaction, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).bBTransaction, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'bb-tx-mock',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).bBTransaction, 'count').mockResolvedValue(0);
    vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    vi.spyOn((prisma as any).matchingTransaction, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn((prisma as any).matchingTransaction, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).matchingTransaction, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'matching-tx-mock',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).matchingTransaction, 'count').mockResolvedValue(0);
    vi.spyOn((prisma as any).matchingTransaction, 'aggregate').mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    vi.spyOn(prisma.commission, 'aggregate').mockResolvedValue({
      _sum: { leftVolumeMatched: null },
    } as any);

    // Mock aggregate and create on BVLedger to prevent 4s timeout
    vi.spyOn(prisma.bVLedger, 'aggregate').mockResolvedValue({
      _sum: { bv: null },
    } as any);
    vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);
  });

  // =========================================================================
  // 1. TEST LEVEL QUALIFICATION (CASES 1 TO 9)
  // =========================================================================
  describe('1. TEST LEVEL QUALIFICATION (Exact Specification Cases 1-9)', () => {
    // 1. BB 249, Matching 2000 -> Expected: No Silver
    it('Case 1: BB 249, Matching 2000 -> Expected: No Silver', async () => {
      const dist = createMockDistributor({ currentBB: 249, currentMatching: 2000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 249, matching: 2000 });
      expect(evaluation.eligibleLevel.code).not.toBe('SILVER');
      expect(evaluation.eligibleLevel.code).toBe('BASE');

      const check = await LevelService.checkLevelQualification(dist.id, 'SILVER');
      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(false);
      expect(check.matchingSatisfied).toBe(true);
      expect(check.bbGap).toBe(1);
    });

    // 2. BB 250, Matching 1999 -> Expected: No Silver
    it('Case 2: BB 250, Matching 1999 -> Expected: No Silver', async () => {
      const dist = createMockDistributor({ currentBB: 250, currentMatching: 1999 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 250, matching: 1999 });
      expect(evaluation.eligibleLevel.code).not.toBe('SILVER');
      expect(evaluation.eligibleLevel.code).toBe('BASE');

      const check = await LevelService.checkLevelQualification(dist.id, 'SILVER');
      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.matchingSatisfied).toBe(false);
      expect(check.matchingGap).toBe(1);
    });

    // 3. BB 250, Matching 2000 -> Expected: Silver
    it('Case 3: BB 250, Matching 2000 -> Expected: Silver', async () => {
      const dist = createMockDistributor({ currentBB: 250, currentMatching: 2000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 250, matching: 2000 });
      expect(evaluation.eligibleLevel.code).toBe('SILVER');
      expect(evaluation.eligibleLevel.name).toBe('Silver');

      const check = await LevelService.checkLevelQualification(dist.id, 'SILVER');
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.matchingSatisfied).toBe(true);
    });

    // 4. BB 250, Matching 5000 -> Expected: Gold
    it('Case 4: BB 250, Matching 5000 -> Expected: Gold', async () => {
      const dist = createMockDistributor({ currentBB: 250, currentMatching: 5000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 250, matching: 5000 });
      expect(evaluation.eligibleLevel.code).toBe('GOLD');
      expect(evaluation.eligibleLevel.name).toBe('Gold');

      const check = await LevelService.checkLevelQualification(dist.id, 'GOLD');
      expect(check.isQualified).toBe(true);
    });

    // 5. BB 499, Matching 50000 -> Expected: Not Platinum
    it('Case 5: BB 499, Matching 50000 -> Expected: Not Platinum (Qualifies for Gold)', async () => {
      const dist = createMockDistributor({ currentBB: 499, currentMatching: 50000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 499, matching: 50000 });
      expect(evaluation.eligibleLevel.code).not.toBe('PLATINUM');
      expect(evaluation.eligibleLevel.code).toBe('GOLD'); // Holds Gold (BB 250, Matching 5000)

      const check = await LevelService.checkLevelQualification(dist.id, 'PLATINUM');
      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(false);
      expect(check.matchingSatisfied).toBe(true);
      expect(check.bbGap).toBe(1);
    });

    // 6. BB 500, Matching 50000 -> Expected: Platinum
    it('Case 6: BB 500, Matching 50000 -> Expected: Platinum', async () => {
      const dist = createMockDistributor({ currentBB: 500, currentMatching: 50000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 500, matching: 50000 });
      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');
      expect(evaluation.eligibleLevel.name).toBe('Platinum');

      const check = await LevelService.checkLevelQualification(dist.id, 'PLATINUM');
      expect(check.isQualified).toBe(true);
    });

    // 7. BB 1000, Matching 60000 -> Expected: Diamond
    it('Case 7: BB 1000, Matching 60000 -> Expected: Diamond', async () => {
      const dist = createMockDistributor({ currentBB: 1000, currentMatching: 60000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 1000, matching: 60000 });
      expect(evaluation.eligibleLevel.code).toBe('DIAMOND');
      expect(evaluation.eligibleLevel.name).toBe('Diamond');

      const check = await LevelService.checkLevelQualification(dist.id, 'DIAMOND');
      expect(check.isQualified).toBe(true);
    });

    // 8. BB 1000, Matching 99999 -> Expected: Not Ruby (Qualifies for Diamond)
    it('Case 8: BB 1000, Matching 99999 -> Expected: Not Ruby (Holds Diamond)', async () => {
      const dist = createMockDistributor({ currentBB: 1000, currentMatching: 99999 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 1000, matching: 99999 });
      expect(evaluation.eligibleLevel.code).not.toBe('RUBY');
      expect(evaluation.eligibleLevel.code).toBe('DIAMOND');

      const check = await LevelService.checkLevelQualification(dist.id, 'RUBY');
      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.matchingSatisfied).toBe(false);
      expect(check.matchingGap).toBe(1);
    });

    // 9. BB 1000, Matching 100000 -> Expected: Ruby
    it('Case 9: BB 1000, Matching 100000 -> Expected: Ruby', async () => {
      const dist = createMockDistributor({ currentBB: 1000, currentMatching: 100000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, { bb: 1000, matching: 100000 });
      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.eligibleLevel.name).toBe('Ruby');

      const check = await LevelService.checkLevelQualification(dist.id, 'RUBY');
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.matchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 2. TEST JUMP
  // =========================================================================
  describe('2. TEST JUMP (Direct Multi-Tier Jump to Ruby)', () => {
    it('BB = 1200, Matching = 120000 should directly qualify for Ruby without intermediate levels', async () => {
      // Distributor starts at Base tier
      const dist = createMockDistributor({
        currentBB: 1200,
        currentMatching: 120000,
        currentLevel: null,
      });

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, {
        bb: 1200,
        matching: 120000,
      });

      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.eligibleLevel.order).toBe(5);
      expect(evaluation.isPromotionAvailable).toBe(true);
      expect(evaluation.evaluatedFromHighest).toBe(true);

      // Perform promotion directly to Ruby
      const result = await LevelService.promoteMember(dist.id, {
        overrideBB: 1200,
        overrideMatching: 120000,
        source: 'ORDER_JUMP',
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.newLevel.code).toBe('RUBY');
      expect(result.message).toContain("Successfully promoted from 'Base' to 'Ruby'");
    });
  });

  // =========================================================================
  // 3. TEST PARTIAL QUALIFICATION
  // =========================================================================
  describe('3. TEST PARTIAL QUALIFICATION', () => {
    it('High BB + low matching = not qualified', async () => {
      // BB = 50,000 (qualifies for Platinum/Ruby BB), but Matching is only 1,000 (Silver requires 2000)
      const dist = createMockDistributor({ currentBB: 50000, currentMatching: 1000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, {
        bb: 50000,
        matching: 1000,
      });

      // Does not qualify for Silver, Gold, Platinum, Diamond, or Ruby
      expect(evaluation.eligibleLevel.code).toBe('BASE');
      expect(evaluation.isPromotionAvailable).toBe(false);
    });

    it('Low BB + high matching = not qualified', async () => {
      // BB = 100 (below Silver requirement of 250), Matching = 500,000 (well above Ruby)
      const dist = createMockDistributor({ currentBB: 100, currentMatching: 500000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const evaluation = await LevelService.calculateEligibleLevel(dist, {
        bb: 100,
        matching: 500000,
      });

      // Both conditions are mandatory; neither Silver nor higher is qualified
      expect(evaluation.eligibleLevel.code).toBe('BASE');
      expect(evaluation.isPromotionAvailable).toBe(false);
    });
  });

  // =========================================================================
  // 4. TEST PROMOTION: SEQUENTIAL PROGRESSION
  // =========================================================================
  describe('4. TEST PROMOTION (Sequential Level Advancements)', () => {
    it('Base -> Silver promotion', async () => {
      const dist = createMockDistributor({ currentLevel: null });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const res = await LevelService.promoteMember(dist.id, {
        overrideBB: 250,
        overrideMatching: 2000,
      });

      expect(res.promoted).toBe(true);
      expect(res.previousLevel.code).toBe('BASE');
      expect(res.newLevel.code).toBe('SILVER');
    });

    it('Silver -> Gold promotion', async () => {
      const dist = createMockDistributor({
        currentLevel: { code: 'SILVER', order: 1, name: 'Silver' },
        currentLevelId: 'lvl-silver',
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const res = await LevelService.promoteMember(dist.id, {
        overrideBB: 250,
        overrideMatching: 5000,
      });

      expect(res.promoted).toBe(true);
      expect(res.previousLevel.code).toBe('SILVER');
      expect(res.newLevel.code).toBe('GOLD');
    });

    it('Gold -> Platinum promotion', async () => {
      const dist = createMockDistributor({
        currentLevel: { code: 'GOLD', order: 2, name: 'Gold' },
        currentLevelId: 'lvl-gold',
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const res = await LevelService.promoteMember(dist.id, {
        overrideBB: 500,
        overrideMatching: 50000,
      });

      expect(res.promoted).toBe(true);
      expect(res.previousLevel.code).toBe('GOLD');
      expect(res.newLevel.code).toBe('PLATINUM');
    });

    it('Platinum -> Diamond promotion', async () => {
      const dist = createMockDistributor({
        currentLevel: { code: 'PLATINUM', order: 3, name: 'Platinum' },
        currentLevelId: 'lvl-plat',
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const res = await LevelService.promoteMember(dist.id, {
        overrideBB: 1000,
        overrideMatching: 60000,
      });

      expect(res.promoted).toBe(true);
      expect(res.previousLevel.code).toBe('PLATINUM');
      expect(res.newLevel.code).toBe('DIAMOND');
    });

    it('Diamond -> Ruby promotion', async () => {
      const dist = createMockDistributor({
        currentLevel: { code: 'DIAMOND', order: 4, name: 'Diamond' },
        currentLevelId: 'lvl-diam',
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      const res = await LevelService.promoteMember(dist.id, {
        overrideBB: 1000,
        overrideMatching: 100000,
      });

      expect(res.promoted).toBe(true);
      expect(res.previousLevel.code).toBe('DIAMOND');
      expect(res.newLevel.code).toBe('RUBY');
    });
  });

  // =========================================================================
  // 5. TEST NO DOWNGRADE
  // =========================================================================
  describe('5. TEST NO DOWNGRADE (Demotion Disabled by Default)', () => {
    it('If a Ruby members calculated volume decreases, do NOT automatically downgrade', async () => {
      // Member achieved Ruby (order 5)
      const dist = createMockDistributor({
        currentLevel: { code: 'RUBY', order: 5, name: 'Ruby' },
        currentLevelId: 'lvl-ruby',
        currentBB: 1000,
        currentMatching: 100000,
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      // Volume decreases dramatically (e.g. refund / cycle flush)
      const evaluation = await LevelService.calculateEligibleLevel(dist, {
        bb: 50,
        matching: 100,
      });

      // Eligible level by raw volume is BASE
      expect(evaluation.eligibleLevel.code).toBe('BASE');
      expect(evaluation.eligibleLevel.order).toBe(0);

      // Promotion rule: eligibleLevel.order (0) <= currentLevel.order (5) -> DO NOT CHANGE LEVEL
      const result = await LevelService.promoteMember(dist.id, {
        overrideBB: 50,
        overrideMatching: 100,
      });

      expect(result.promoted).toBe(false);
      expect(result.newLevel.code).toBe('RUBY');
      expect(result.newLevel.name).toBe('Ruby');
      expect(result.message).toContain("Member maintains current level 'Ruby'. No promotion necessary.");
    });
  });

  // =========================================================================
  // 6. TEST DUPLICATES & IDEMPOTENCY
  // =========================================================================
  describe('6. TEST DUPLICATES & IDEMPOTENCY', () => {
    it('Process the same BB event twice -> Only one ledger transaction', async () => {
      const dist = createMockDistributor({ currentBB: 100 });
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      let storedTx: any = null;
      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockImplementation(async () => storedTx);
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockImplementation(async () => storedTx);
      vi.spyOn((prisma as any).bBTransaction, 'create').mockImplementation(async ({ data }: any) => {
        storedTx = { id: 'bb-tx-master-1', ...data, createdAt: new Date() };
        return storedTx;
      });

      // Process Event 1
      const res1 = await BBService.addBB({
        memberId: dist.id,
        amount: 150,
        source: 'ORDER',
        referenceId: 'ORD-DUP-001',
      });
      expect(res1.isDuplicate).toBe(false);
      expect(res1.currentBB).toBe(250);

      // Process Event 2 (identical duplicate event)
      const res2 = await BBService.addBB({
        memberId: dist.id,
        amount: 150,
        source: 'ORDER',
        referenceId: 'ORD-DUP-001',
      });
      expect(res2.isDuplicate).toBe(true);
      expect(res2.currentBB).toBe(250); // Balance NOT increased again!
    });

    it('Process the same matching event twice -> Only one matching transaction', async () => {
      const dist = createMockDistributor({ currentMatching: 5000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      let storedMatchTx: any = null;
      vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockImplementation(async () => storedMatchTx);
      vi.spyOn((prisma as any).matchingTransaction, 'findFirst').mockImplementation(async () => storedMatchTx);
      vi.spyOn((prisma as any).matchingTransaction, 'create').mockImplementation(async ({ data }: any) => {
        storedMatchTx = { id: 'match-tx-master-1', ...data, createdAt: new Date() };
        return storedMatchTx;
      });

      // Event 1
      const res1 = await MatchingService.recordMatchingTransaction({
        memberId: dist.id,
        amount: 2000,
        source: 'BINARY_MATCH',
        referenceId: 'MATCH-DUP-001',
      });
      expect(res1.isDuplicate).toBe(false);

      // Event 2 (identical duplicate)
      const res2 = await MatchingService.recordMatchingTransaction({
        memberId: dist.id,
        amount: 2000,
        source: 'BINARY_MATCH',
        referenceId: 'MATCH-DUP-001',
      });
      expect(res2.isDuplicate).toBe(true);
    });

    it('Process the same promotion event twice -> Only one level history entry', async () => {
      const dist = createMockDistributor({
        currentBB: 250,
        currentMatching: 2000,
        currentLevel: null,
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      let historyEntries: any[] = [];
      vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockImplementation(async ({ where }: any) => {
        return historyEntries.find(
          (h) => h.memberId === where.memberId && h.newLevel.code === where.newLevel.code
        ) || null;
      });
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => {
        const entry = { id: `hist-${historyEntries.length + 1}`, ...data, newLevel: { code: 'SILVER' } };
        historyEntries.push(entry);
        return entry;
      });

      // Promotion trigger 1
      const res1 = await LevelService.promoteMember(dist.id, {
        overrideBB: 250,
        overrideMatching: 2000,
      });
      expect(res1.promoted).toBe(true);
      expect(historyEntries.length).toBe(1);

      // Promotion trigger 2 (replayed promotion event)
      const res2 = await LevelService.promoteMember(dist.id, {
        overrideBB: 250,
        overrideMatching: 2000,
      });
      expect(res2.promoted).toBe(false); // Idempotency preserved!
      expect(historyEntries.length).toBe(1); // No second history record created!
    });
  });

  // =========================================================================
  // 7. TEST CONCURRENCY
  // =========================================================================
  describe('7. TEST CONCURRENCY', () => {
    it('Simulate two simultaneous qualification events -> Only one valid promotion', async () => {
      const dist = createMockDistributor({
        currentBB: 250,
        currentMatching: 2000,
        currentLevel: null,
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);

      let historyCount = 0;
      vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockImplementation(async () => {
        return historyCount > 0 ? ({ id: 'hist-first', newLevel: { code: 'SILVER' } } as any) : null;
      });
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => {
        historyCount++;
        return { id: `hist-${historyCount}`, ...data };
      });

      // Trigger two simultaneous promotion calls for the same member
      const [res1, res2] = await Promise.all([
        LevelService.promoteMember(dist.id, { overrideBB: 250, overrideMatching: 2000 }),
        LevelService.promoteMember(dist.id, { overrideBB: 250, overrideMatching: 2000 }),
      ]);

      const promotions = [res1, res2].filter((r) => r.promoted);
      expect(promotions.length).toBe(1); // Exactly one promotion succeeded
      expect(historyCount).toBe(1); // Exactly one history entry created
    });
  });

  // =========================================================================
  // 8. TEST TRANSACTION FAILURE & ROLLBACK
  // =========================================================================
  describe('8. TEST TRANSACTION FAILURE & ROLLBACK', () => {
    it('Force a failure during promotion -> Database transaction rolls back', async () => {
      const dist = createMockDistributor({ currentBB: 250, currentMatching: 2000 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      // Force an error during memberLevelHistory creation
      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockRejectedValue(
        new Error('Database disk write failure on MemberLevelHistory')
      );

      // Mock transaction that checks rollback
      let rolledBack = false;
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        try {
          return await callback(prisma);
        } catch (err) {
          rolledBack = true;
          throw err;
        }
      });

      await expect(
        LevelPromotionEventService.processBBEvent({
          memberId: dist.id,
          amount: 250,
          source: 'ORDER',
          referenceId: 'ORD-FAIL-001',
        })
      ).rejects.toThrow();

      expect(rolledBack).toBe(true);
    });
  });

  // =========================================================================
  // 9. TEST RECALCULATION
  // =========================================================================
  describe('9. TEST RECALCULATION', () => {
    it('Delete/rebuild derived totals from ledger and verify same results', async () => {
      const dist = createMockDistributor({ currentBB: 0 });
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      // Mock aggregate calculation from all past ledger transactions: 3 credits = 750 BB
      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 750 },
        _count: { id: 3 },
      });

      const recalculation = await BBService.recalculateBBFromLedger(dist.id);
      expect(recalculation.recalculatedBB).toBe(750);
      expect(recalculation.transactionCount).toBe(3);
    });
  });

  // =========================================================================
  // 10. INTEGRATION TESTS FOR THE APIS
  // =========================================================================
  describe('10. INTEGRATION TESTS FOR THE APIS', () => {
    beforeEach(() => {
      vi.spyOn(LevelService, 'getMemberLevel').mockResolvedValue({
        memberId: mockMemberId,
        distributorCode: 'KV-MASTER-001',
        displayName: 'Master Tester',
        currentBB: 250,
        currentMatching: 2000,
        currentLevel: { order: 1, code: 'SILVER', name: 'Silver', requiredBB: 250, requiredMatching: 2000 } as any,
        highestLevel: { order: 1, code: 'SILVER', name: 'Silver' } as any,
        nextLevel: { order: 2, code: 'GOLD', name: 'Gold', requiredBB: 250, requiredMatching: 5000 } as any,
        isMaxLevel: false,
        progress: {
          bbGap: 0,
          matchingGap: 3000,
          bbProgressPercentage: 100,
          matchingProgressPercentage: 40,
          isQualifiedForNext: false,
        },
        achievedAt: new Date(),
      } as any);

      vi.spyOn(BBService, 'getBBBalance').mockResolvedValue({
        memberId: mockMemberId,
        distributorCode: 'KV-MASTER-001',
        currentBB: 250,
        lifetimeBB: 250,
        totalCredits: 250,
        totalDebits: 0,
        transactionCount: 1,
        lastTransactionAt: new Date(),
      } as any);

      vi.spyOn(MatchingService, 'calculateEligibleMatching').mockResolvedValue({
        memberId: mockMemberId,
        distributorCode: 'KV-MASTER-001',
        leftVolume: 40000,
        rightVolume: 35000,
        matchedVolume: 35000,
        unmatchedVolume: 5000,
        strongLeg: 'LEFT',
        weakLeg: 'RIGHT',
        carryForwardLeft: 5000,
        carryForwardRight: 0,
        isEligible: true,
        ruleApplied: 'MINIMUM_LEG',
        calculatedAt: new Date(),
      } as any);

      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(35000);
    });

    it('GET /api/members/:memberId/level -> 200 with level details', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.currentLevel).toBe('Silver');
      expect(res.body.data.bb).toBe(250);
      expect(res.body.data.matching).toBe(2000);
      expect(res.body.data.nextLevel).toBe('Gold');
    });

    it('GET /api/members/:memberId/level/progress -> 200 with progression breakdown', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level/progress`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.currentLevel).toEqual({ name: 'Silver', code: 'SILVER' });
      expect(res.body.data.currentBB).toBe(250);
      expect(res.body.data.nextLevel.name).toBe('Gold');
      expect(res.body.data.progress.bb.remaining).toBe(0);
      expect(res.body.data.progress.bb.percentage).toBe(100);
      expect(res.body.data.qualifiedForNextLevel).toBe(false);
    });

    it('POST /api/admin/members/:memberId/recalculate-level -> 403 Forbidden for normal member', async () => {
      await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('POST /api/admin/members/:memberId/recalculate-level -> 200 OK for Admin', async () => {
      vi.spyOn(LevelService, 'recalculateMemberLevel').mockResolvedValue({
        memberId: mockMemberId,
        distributorCode: 'KV-MASTER-001',
        auditedBB: 250,
        auditedMatching: 35000,
        previousLevel: { order: 1, name: 'Silver' } as any,
        evaluatedEligibleLevel: { order: 1, name: 'Silver' } as any,
        promoted: false,
        auditAt: new Date(),
      } as any);

      const res = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Audit test' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Member level recalculation completed');
    });

    it('SECURITY: Rejection of client-supplied volume injection with 400 Bad Request', async () => {
      await request(app)
        .patch('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          bb: 100000,
          matching: 1000000,
          level: 'RUBY',
        })
        .expect(400);
    });
  });
});
