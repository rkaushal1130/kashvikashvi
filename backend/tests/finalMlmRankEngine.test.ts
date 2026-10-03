import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import { AutomaticRankQualificationEngine } from '../src/services/rankQualificationEngine.service';
import { LevelService, CANONICAL_LEVELS } from '../src/services/level.service';
import {
  LevelPromotionEventService,
  ProcessBBEventInput,
  ProcessMatchingEventInput,
} from '../src/services/levelPromotionEvent.service';
import { BinaryVolumeService } from '../src/services/binaryVolume.service';

/**
 * ============================================================================
 * PROMPT 10: TEST FINAL MLM RANK ENGINE (COMPREHENSIVE AUTOMATED TEST SUITE)
 * ============================================================================
 * Covers:
 * 1. SILVER TESTS (Tests 1 - 4)
 * 2. GOLD TESTS (Tests 5 - 6)
 * 3. PLATINUM TESTS (Tests 7 - 9)
 * 4. DIAMOND TESTS (Tests 10 - 11)
 * 5. RUBY TESTS (Tests 12 - 13)
 * 6. DIRECT JUMP (Test 14: Direct qualification without intermediate ranks)
 * 7. ASYMMETRIC TESTS (Tests 15 - 16: Volume skew prevents rank qualification)
 * 8. DUPLICATE EVENT TESTS (Idempotency on BB, Left matching, Right matching, Promotion)
 * 9. CONCURRENCY TESTS (Simultaneous events result in exactly 1 promotion & 1 history record)
 */
describe('PROMPT 10 — FINAL MLM RANK ENGINE TEST SUITE', () => {
  const memberId = 'dist-p10-member-001';

  let mockMember: any = null;
  let mockBBTransactions: any[] = [];
  let mockMatchingTransactions: any[] = [];
  let mockMemberLevelHistories: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    BinaryVolumeService.resetMockStore();

    mockBBTransactions = [];
    mockMatchingTransactions = [];
    mockMemberLevelHistories = [];

    mockMember = {
      id: memberId,
      distributorCode: 'DST-P10-001',
      distributorId: 'KV-P10-001',
      currentBB: 0,
      currentMatching: 0,
      leftMatching: 0,
      rightMatching: 0,
      currentLevelId: null,
      currentRankId: null,
      currentLevel: null,
      currentRank: null,
      highestRank: null,
      user: { firstName: 'Tester', lastName: 'Member' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Synchronous mock transaction wrapper
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock member lookup
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async () => mockMember);
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async () => mockMember);
    vi.spyOn(prisma.distributorProfile, 'update').mockImplementation(async ({ data }: any) => {
      if (data.currentLevelId !== undefined) mockMember.currentLevelId = data.currentLevelId;
      if (data.currentRankId !== undefined) mockMember.currentRankId = data.currentRankId;
      if (data.currentBB !== undefined) mockMember.currentBB = Number(data.currentBB);
      if (data.currentMatching !== undefined) mockMember.currentMatching = Number(data.currentMatching);
      return mockMember;
    });

    // Mock Levels
    vi.spyOn((prisma as any).level, 'findFirst').mockImplementation(async ({ where }: any) => {
      const code = where?.code || (where?.OR ? where.OR[1]?.code : null);
      if (!code) return null;
      const found = CANONICAL_LEVELS.find((l) => l.code === code);
      if (!found) return null;
      return {
        id: `lvl-${found.code}`,
        ...found,
      };
    });

    vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue(
      CANONICAL_LEVELS.map((lvl) => ({
        id: `lvl-${lvl.code}`,
        ...lvl,
      }))
    );

    // Mock Ranks & Notifications
    vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue({ id: 'rnk-001', rankCode: 'RANK_SILVER', name: 'Silver', level: 1 } as any);
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);

    // Mock tree / nodes / business center / ledger queries for instant in-memory responses
    vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.businessCenter, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.businessCenter, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.businessCenter, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.bVLedger, 'aggregate').mockResolvedValue({ _sum: { bv: 0 as any } } as any);

    // Mock BB Transactions (with unique constraint on [memberId, source, referenceId])
    vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockImplementation(async ({ where }: any) => {
      const key = where?.memberId_source_referenceId;
      if (!key) return null;
      return mockBBTransactions.find(
        (t) => t.memberId === key.memberId && t.source === key.source && t.referenceId === key.referenceId
      ) || null;
    });

    vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockImplementation(async ({ where }: any) => {
      const txs = mockBBTransactions.filter((t) => t.memberId === where.memberId);
      return txs[txs.length - 1] || null;
    });

    vi.spyOn((prisma as any).bBTransaction, 'create').mockImplementation(async ({ data }: any) => {
      const existing = mockBBTransactions.find(
        (t) => t.memberId === data.memberId && t.source === data.source && t.referenceId === data.referenceId
      );
      if (existing) {
        const error: any = new Error('Unique constraint failed on the fields: (`memberId`,`source`,`referenceId`)');
        error.code = 'P2002';
        throw error;
      }
      const record = {
        id: `bb-tx-${mockBBTransactions.length + 1}`,
        ...data,
        balanceAfter: data.balanceAfter || data.amount,
        createdAt: new Date(),
      };
      mockBBTransactions.push(record);
      return record;
    });

    // Mock Matching Transactions (with unique constraint on [memberId, source, referenceId])
    vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockImplementation(async ({ where }: any) => {
      const key = where?.memberId_source_referenceId;
      if (!key) return null;
      return mockMatchingTransactions.find(
        (t) => t.memberId === key.memberId && t.source === key.source && t.referenceId === key.referenceId
      ) || null;
    });

    vi.spyOn((prisma as any).matchingTransaction, 'findFirst').mockImplementation(async ({ where }: any) => {
      const txs = mockMatchingTransactions.filter((t) => t.memberId === where.memberId);
      return txs[txs.length - 1] || null;
    });

    vi.spyOn((prisma as any).matchingTransaction, 'create').mockImplementation(async ({ data }: any) => {
      const existing = mockMatchingTransactions.find(
        (t) => t.memberId === data.memberId && t.source === data.source && t.referenceId === data.referenceId
      );
      if (existing) {
        const error: any = new Error('Unique constraint failed on the fields: (`memberId`,`source`,`referenceId`)');
        error.code = 'P2002';
        throw error;
      }
      const record = {
        id: `match-tx-${mockMatchingTransactions.length + 1}`,
        ...data,
        balanceAfter: data.balanceAfter || data.amount,
        createdAt: new Date(),
      };
      mockMatchingTransactions.push(record);
      return record;
    });

    // Mock MemberLevelHistory (with unique constraint on [memberId, newLevelId])
    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockImplementation(async ({ where }: any) => {
      return (
        mockMemberLevelHistories.find((h) => {
          if (h.memberId !== where?.memberId) return false;
          if (where?.newLevelId && h.newLevelId === where.newLevelId) return true;
          if (where?.newLevelCode && h.newLevelCode === where.newLevelCode) return true;
          if (where?.OR) {
            return where.OR.some((cond: any) => {
              if (cond.newLevelId && h.newLevelId === cond.newLevelId) return true;
              if (cond.newLevelCode && h.newLevelCode === cond.newLevelCode) return true;
              return false;
            });
          }
          return false;
        }) || null
      );
    });

    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => {
      const existing = mockMemberLevelHistories.find(
        (h) => h.memberId === data.memberId && h.newLevelId === data.newLevelId
      );
      if (existing) {
        const error: any = new Error('Unique constraint failed on the fields: (`memberId`,`newLevelId`)');
        error.code = 'P2002';
        throw error;
      }
      const record = {
        id: `hist-${mockMemberLevelHistories.length + 1}`,
        ...data,
        createdAt: new Date(),
      };
      mockMemberLevelHistories.push(record);
      return record;
    });
  });

  // =========================================================================
  // 1. SILVER TESTS (Tests 1 - 4)
  // Requirements: BB >= 250, Left >= 2000, Right >= 2000
  // =========================================================================
  describe('SILVER TESTS', () => {
    it('1. BB = 250, Left = 2000, Right = 2000 => Expected: SILVER', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 250, leftMatching: 2000, rightMatching: 2000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('SILVER');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'SILVER',
        { bb: 250, leftMatching: 2000, rightMatching: 2000 }
      );
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('2. BB = 249, Left = 2000, Right = 2000 => Expected: NOT SILVER', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 249, leftMatching: 2000, rightMatching: 2000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('SILVER');
      expect(evaluation.eligibleLevel.order).toBeLessThan(1);

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'SILVER',
        { bb: 249, leftMatching: 2000, rightMatching: 2000 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(false);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('3. BB = 250, Left = 1999, Right = 2000 => Expected: NOT SILVER', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 250, leftMatching: 1999, rightMatching: 2000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('SILVER');
      expect(evaluation.eligibleLevel.order).toBeLessThan(1);

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'SILVER',
        { bb: 250, leftMatching: 1999, rightMatching: 2000 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.leftMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('4. BB = 250, Left = 2000, Right = 1999 => Expected: NOT SILVER', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 250, leftMatching: 2000, rightMatching: 1999 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('SILVER');
      expect(evaluation.eligibleLevel.order).toBeLessThan(1);

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'SILVER',
        { bb: 250, leftMatching: 2000, rightMatching: 1999 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.rightMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 2. GOLD TESTS (Tests 5 - 6)
  // Requirements: BB >= 250, Left >= 5000, Right >= 5000
  // =========================================================================
  describe('GOLD TESTS', () => {
    it('5. BB = 250, Left = 5000, Right = 5000 => Expected: GOLD', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 250, leftMatching: 5000, rightMatching: 5000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('GOLD');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'GOLD',
        { bb: 250, leftMatching: 5000, rightMatching: 5000 }
      );
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('6. BB = 250, Left = 5000, Right = 4999 => Expected: NOT GOLD', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 250, leftMatching: 5000, rightMatching: 4999 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('GOLD');
      expect(evaluation.eligibleLevel.code).toBe('SILVER'); // Qualifies for Silver, but NOT Gold

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'GOLD',
        { bb: 250, leftMatching: 5000, rightMatching: 4999 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.rightMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 3. PLATINUM TESTS (Tests 7 - 9)
  // Requirements: BB >= 500, Left >= 50000, Right >= 50000
  // =========================================================================
  describe('PLATINUM TESTS', () => {
    it('7. BB = 500, Left = 50000, Right = 50000 => Expected: PLATINUM', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 500, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'PLATINUM',
        { bb: 500, leftMatching: 50000, rightMatching: 50000 }
      );
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('8. BB = 500, Left = 49999, Right = 50000 => Expected: NOT PLATINUM', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 500, leftMatching: 49999, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('PLATINUM');
      expect(evaluation.eligibleLevel.code).toBe('GOLD'); // Qualifies for Gold, but NOT Platinum

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'PLATINUM',
        { bb: 500, leftMatching: 49999, rightMatching: 50000 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.leftMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('9. BB = 499, Left = 50000, Right = 50000 => Expected: NOT PLATINUM', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 499, leftMatching: 50000, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('PLATINUM');
      expect(evaluation.eligibleLevel.code).toBe('GOLD'); // Qualifies for Gold, but NOT Platinum

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'PLATINUM',
        { bb: 499, leftMatching: 50000, rightMatching: 50000 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.bbSatisfied).toBe(false);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 4. DIAMOND TESTS (Tests 10 - 11)
  // Requirements: BB >= 1000, Left >= 60000, Right >= 60000
  // =========================================================================
  describe('DIAMOND TESTS', () => {
    it('10. BB = 1000, Left = 60000, Right = 60000 => Expected: DIAMOND', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1000, leftMatching: 60000, rightMatching: 60000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('DIAMOND');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'DIAMOND',
        { bb: 1000, leftMatching: 60000, rightMatching: 60000 }
      );
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('11. BB = 1000, Left = 60000, Right = 59999 => Expected: NOT DIAMOND', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1000, leftMatching: 60000, rightMatching: 59999 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('DIAMOND');
      expect(evaluation.eligibleLevel.code).toBe('PLATINUM'); // Qualifies for Platinum, but NOT Diamond

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'DIAMOND',
        { bb: 1000, leftMatching: 60000, rightMatching: 59999 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.rightMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 5. RUBY TESTS (Tests 12 - 13)
  // Requirements: BB >= 1000, Left >= 100000, Right >= 100000
  // =========================================================================
  describe('RUBY TESTS', () => {
    it('12. BB = 1000, Left = 100000, Right = 100000 => Expected: RUBY', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1000, leftMatching: 100000, rightMatching: 100000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('RUBY');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'RUBY',
        { bb: 1000, leftMatching: 100000, rightMatching: 100000 }
      );
      expect(check.isQualified).toBe(true);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });

    it('13. BB = 1000, Left = 100000, Right = 99999 => Expected: NOT RUBY', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1000, leftMatching: 100000, rightMatching: 99999 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('RUBY');
      expect(evaluation.eligibleLevel.code).toBe('DIAMOND'); // Qualifies for Diamond, but NOT Ruby

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'RUBY',
        { bb: 1000, leftMatching: 100000, rightMatching: 99999 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.rightMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 6. DIRECT JUMP (Test 14)
  // =========================================================================
  describe('DIRECT JUMP', () => {
    it('14. BB = 1500, Left = 150000, Right = 150000 => Expected: RUBY (Direct qualification without manual intermediate promotions)', async () => {
      // Member is currently at Base (order 0)
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1500, leftMatching: 150000, rightMatching: 150000 }
      );

      expect(evaluation.eligibleLevel.code).toBe('RUBY');
      expect(evaluation.eligibleLevel.order).toBe(5);

      // Perform promotion directly
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P10-001',
        currentBB: 1500,
        leftMatching: 150000,
        rightMatching: 150000,
      });

      const promoResult = await AutomaticRankQualificationEngine.promoteMember(memberId, {
        overrideBB: 1500,
        overrideLeftMatching: 150000,
        overrideRightMatching: 150000,
      });

      expect(promoResult.promoted).toBe(true);
      expect(promoResult.previousLevel.code).toBe('BASE');
      expect(promoResult.newLevel.code).toBe('RUBY');
      expect(promoResult.historyRecord.previousLevel).toBe('STARTER');
      expect(promoResult.historyRecord.newLevel).toBe('RUBY');

      // Exactly ONE history record created for direct promotion
      expect(mockMemberLevelHistories).toHaveLength(1);
    });
  });

  // =========================================================================
  // 7. ASYMMETRIC TESTS (Tests 15 - 16)
  // Volume skew in binary tree prevents rank qualification
  // =========================================================================
  describe('ASYMMETRIC TESTS', () => {
    it('15. BB = 1000, Left = 100000, Right = 50000 => Expected: NOT RUBY', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1000, leftMatching: 100000, rightMatching: 50000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('RUBY');
      // Right is 50,000, so it satisfies Platinum (50k/50k) but fails Diamond (60k) and Ruby (100k)
      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'RUBY',
        { bb: 1000, leftMatching: 100000, rightMatching: 50000 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.rightMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.leftMatchingSatisfied).toBe(true);
    });

    it('16. BB = 1000, Left = 50000, Right = 100000 => Expected: NOT RUBY', async () => {
      const evaluation = await AutomaticRankQualificationEngine.calculateEligibleLevel(
        memberId,
        { bb: 1000, leftMatching: 50000, rightMatching: 100000 }
      );

      expect(evaluation.eligibleLevel.code).not.toBe('RUBY');
      // Left is 50,000, so it satisfies Platinum (50k/50k) but fails Diamond (60k) and Ruby (100k)
      expect(evaluation.eligibleLevel.code).toBe('PLATINUM');

      const check = await AutomaticRankQualificationEngine.checkLevelQualification(
        memberId,
        'RUBY',
        { bb: 1000, leftMatching: 50000, rightMatching: 100000 }
      );
      expect(check.isQualified).toBe(false);
      expect(check.leftMatchingSatisfied).toBe(false);
      expect(check.bbSatisfied).toBe(true);
      expect(check.rightMatchingSatisfied).toBe(true);
    });
  });

  // =========================================================================
  // 8. DUPLICATE EVENT TESTS
  // =========================================================================
  describe('DUPLICATE EVENT TESTS', () => {
    it('Process the same BB transaction twice => Expected: one transaction', async () => {
      const bbInput: ProcessBBEventInput = {
        memberId,
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-DUP-001',
        description: 'Qualifying order BB',
      };

      // 1st processing
      const firstResult = await LevelPromotionEventService.processBBEvent(bbInput);
      expect(firstResult.success).toBe(true);
      expect(mockBBTransactions).toHaveLength(1);

      // 2nd processing with the EXACT same event (same memberId, source, referenceId)
      const secondResult = await LevelPromotionEventService.processBBEvent(bbInput);
      expect(secondResult.success).toBe(true);

      // Ledger has strictly ONE transaction
      expect(mockBBTransactions).toHaveLength(1);
      expect(secondResult.message).toMatch(/already processed/i);
    });

    it('Process the same left matching event twice => Expected: one transaction', async () => {
      const leftInput: ProcessMatchingEventInput = {
        memberId,
        amount: 2000,
        source: 'BINARY_MATCH',
        referenceId: 'MATCH-LEFT-DUP-001',
        description: 'Left matching credit',
      };

      // 1st processing
      const firstResult = await LevelPromotionEventService.processLeftMatchingEvent(leftInput);
      expect(firstResult.success).toBe(true);
      expect(mockMatchingTransactions).toHaveLength(1);

      // 2nd processing with exact same event
      const secondResult = await LevelPromotionEventService.processLeftMatchingEvent(leftInput);
      expect(secondResult.success).toBe(true);

      // Ledger has strictly ONE transaction
      expect(mockMatchingTransactions).toHaveLength(1);
      expect(secondResult.message).toMatch(/already processed/i);
    });

    it('Process the same right matching event twice => Expected: one transaction', async () => {
      const rightInput: ProcessMatchingEventInput = {
        memberId,
        amount: 2000,
        source: 'BINARY_MATCH',
        referenceId: 'MATCH-RIGHT-DUP-001',
        description: 'Right matching credit',
      };

      // 1st processing
      const firstResult = await LevelPromotionEventService.processRightMatchingEvent(rightInput);
      expect(firstResult.success).toBe(true);
      expect(mockMatchingTransactions).toHaveLength(1);

      // 2nd processing with exact same event
      const secondResult = await LevelPromotionEventService.processRightMatchingEvent(rightInput);
      expect(secondResult.success).toBe(true);

      // Ledger has strictly ONE transaction
      expect(mockMatchingTransactions).toHaveLength(1);
      expect(secondResult.message).toMatch(/already processed/i);
    });

    it('Process promotion twice => Expected: one promotion', async () => {
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P10-001',
        currentBB: 250,
        leftMatching: 2000,
        rightMatching: 2000,
      });

      // 1st promotion execution
      const promo1 = await LevelService.promoteMember(memberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
      });
      expect(promo1.promoted).toBe(true);
      expect(promo1.newLevel.code).toBe('SILVER');
      expect(mockMemberLevelHistories).toHaveLength(1);

      // Update member state to reflect achieved Silver level
      mockMember.currentLevelId = 'lvl-SILVER';
      mockMember.currentLevel = { id: 'lvl-SILVER', code: 'SILVER', order: 1, name: 'Silver' };
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P10-001',
        currentBB: 250,
        leftMatching: 2000,
        rightMatching: 2000,
        currentLevel: mockMember.currentLevel,
      });

      // 2nd promotion execution with the same volume
      const promo2 = await LevelService.promoteMember(memberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
      });

      // Exactly ONE promotion took place
      expect(promo2.promoted).toBe(false);
      expect(mockMemberLevelHistories).toHaveLength(1);
    });
  });

  // =========================================================================
  // 9. CONCURRENCY TESTS
  // =========================================================================
  describe('CONCURRENCY TESTS', () => {
    it('Trigger two simultaneous qualification events => Expected: one valid promotion, one rank history record, no duplicate promotion, no inconsistent member state', async () => {
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P10-001',
        currentBB: 500,
        leftMatching: 50000,
        rightMatching: 50000,
      });

      // Fire two promotion events concurrently using Promise.all
      const [result1, result2] = await Promise.all([
        LevelService.promoteMember(memberId, {
          overrideBB: 500,
          overrideLeftMatching: 50000,
          overrideRightMatching: 50000,
          source: 'EVENT_A',
        }),
        LevelService.promoteMember(memberId, {
          overrideBB: 500,
          overrideLeftMatching: 50000,
          overrideRightMatching: 50000,
          source: 'EVENT_B',
        }),
      ]);

      // Exactly one of the simultaneous calls must succeed in promotion
      const promotions = [result1, result2].filter((r) => r.promoted);
      expect(promotions).toHaveLength(1);

      // Both returned records point to the valid qualified level
      expect(result1.newLevel.code).toBe('PLATINUM');
      expect(result2.newLevel.code).toBe('PLATINUM');

      // Exactly ONE rank history record is created
      expect(mockMemberLevelHistories).toHaveLength(1);
      expect(mockMemberLevelHistories[0].newLevelCode).toBe('PLATINUM');

      // State consistency: Member level is updated correctly and not corrupted
      expect(mockMember.currentLevelId).toBe('lvl-PLATINUM');
    });

    it('Concurrent BB and matching events that together cross the threshold promote cleanly once', async () => {
      // Setup member initial state: BB=200, Left=2000, Right=2000 (missing 50 BB for Silver)
      mockMember.currentBB = 200;
      mockMember.leftMatching = 2000;
      mockMember.rightMatching = 2000;

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P10-001',
        currentBB: 200,
        leftMatching: 2000,
        rightMatching: 2000,
      });

      // Dispatch 2 concurrent BB events (each 50 BB)
      const [res1, res2] = await Promise.all([
        LevelPromotionEventService.processBBEvent({
          memberId,
          amount: 50,
          source: 'ORDER',
          referenceId: 'ORD-CONC-001',
        }),
        LevelPromotionEventService.processBBEvent({
          memberId,
          amount: 50,
          source: 'ORDER',
          referenceId: 'ORD-CONC-002',
        }),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      // Ledger recorded both distinct transactions
      expect(mockBBTransactions).toHaveLength(2);

      // But member was promoted to SILVER exactly once
      const promoEvents = [res1, res2].filter((r) => r.promoted);
      expect(promoEvents).toHaveLength(1);
      expect(mockMemberLevelHistories).toHaveLength(1);
      expect(mockMemberLevelHistories[0].newLevelCode).toBe('SILVER');
    });
  });
});
