import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  LevelPromotionEventService,
  ProcessBBEventInput,
  ProcessMatchingEventInput,
} from '../src/services/levelPromotionEvent.service';
import { LevelService, CANONICAL_LEVELS } from '../src/services/level.service';
import { BBService } from '../src/services/bb.service';
import { MatchingService } from '../src/services/matching.service';
import { BinaryVolumeService } from '../src/services/binaryVolume.service';
import { MLMSecurityService } from '../src/services/mlmSecurity.service';

/**
 * ============================================================================
 * PROMPT 8: CONNECT ALL VOLUME CHANGES TO RANK ENGINE TEST SUITE
 * ============================================================================
 * Verifies that:
 * 1. Qualifying BB updates trigger automatic rank evaluation and promotion.
 * 2. Qualifying LEFT matching changes trigger automatic rank evaluation and promotion.
 * 3. Qualifying RIGHT matching changes trigger automatic rank evaluation and promotion.
 * 4. A member may become eligible because of ANY ONE of the three values (BB, Left, Right).
 * 5. Strict 3-condition rule: ALL THREE mandatory independent requirements must be met.
 * 6. High volume jump directly promotes to the highest qualified level (e.g. RUBY) without manual admin action.
 * 7. Database transactions, idempotency, and concurrency protection are guaranteed.
 */
describe('PROMPT 8: CONNECT ALL VOLUME CHANGES TO RANK ENGINE', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    BinaryVolumeService.resetMockStore();

    // Mock interactive transactions so tests execute synchronously and fast
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Provide default resolved mocks for Prisma models
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
    vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({ userId: 'usr-001' } as any);
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.mLMNode, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.businessCenter, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.businessCenter, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.businessCenter, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.bVLedger, 'aggregate').mockResolvedValue({ _sum: { bv: 0 as any } } as any);
    vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).bBTransaction, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'bb-tx-100',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn((prisma as any).matchingTransaction, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).matchingTransaction, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'match-tx-100',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'hist-100',
      ...data,
      createdAt: new Date(),
    }));
  });

  // =========================================================================
  // TEST 1: PROMPT 8 EXAMPLE 1 — RIGHT MATCHING CHANGE TRIGGERS SILVER
  // =========================================================================
  describe('1. Prompt 8 Example 1: Right Matching Change Triggers Promotion', () => {
    it('promotes member to Silver when Right Matching reaches 2000 (BB=250, Left=2000, Right was 1900)', async () => {
      const memberId = 'dist-prompt8-ex1';

      // Setup member state: BB = 250, Left = 2000, Right = 1900 (not Silver)
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-EX1',
        distributorId: 'KV-EX1',
        currentBB: 250,
        currentMatching: 1900,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        highestRank: null,
        user: { firstName: 'Binary', lastName: 'Member' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      // In BinaryVolumeService mock store:
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-EX1',
        currentBB: 250,
        leftVolume: 2000,
        rightVolume: 1900,
        leftMatching: 2000,
        rightMatching: 1900,
      });

      // Right matching increases by 100 to 2000
      const result = await LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 100,
        source: 'MATCHING',
        referenceId: 'REF-RIGHT-2000',
        description: 'Right leg matching increase to 2000',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.currentLevel.code).toBe('SILVER');
      expect(result.volumeUpdated.bb).toBe(250);
      expect(result.volumeUpdated.leftMatching).toBe(2000);
      expect(result.volumeUpdated.rightMatching).toBe(2000);
    });
  });

  // =========================================================================
  // TEST 2: PROMPT 8 EXAMPLE 2 — RIGHT MATCHING CHANGE TRIGGERS GOLD
  // =========================================================================
  describe('2. Prompt 8 Example 2: Silver Member Promoted to Gold Automatically', () => {
    it('promotes Silver member to Gold when Right Matching reaches 5000 (BB=250, Left=5000, Right was 4999)', async () => {
      const memberId = 'dist-prompt8-ex2';

      // Current Silver member
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-EX2',
        distributorId: 'KV-EX2',
        currentBB: 250,
        currentMatching: 4999,
        currentLevelId: 'lvl-silver',
        currentRankId: 'rnk-silver',
        currentLevel: {
          id: 'lvl-silver',
          code: 'SILVER',
          name: 'Silver',
          order: 1,
          requiredBB: 250,
          requiredLeftMatching: 2000,
          requiredRightMatching: 2000,
        },
        currentRank: {
          id: 'rnk-silver',
          rankCode: 'RANK_SILVER',
          name: 'Silver',
          level: 1,
        },
        highestRank: null,
        user: { firstName: 'Gold', lastName: 'Candidate' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      // In BinaryVolumeService:
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-EX2',
        currentBB: 250,
        leftVolume: 5000,
        rightVolume: 4999,
        leftMatching: 5000,
        rightMatching: 4999,
        currentLevel: mockMember.currentLevel,
        currentRank: mockMember.currentRank,
      });

      // Right matching reaches 5000 (e.g. credit of 1)
      const result = await LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 1,
        source: 'MATCHING',
        referenceId: 'REF-RIGHT-5000',
        description: 'Right leg matching reaches 5000',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('SILVER');
      expect(result.currentLevel.code).toBe('GOLD');
      expect(result.volumeUpdated.bb).toBe(250);
      expect(result.volumeUpdated.leftMatching).toBe(5000);
      expect(result.volumeUpdated.rightMatching).toBe(5000);
    });
  });

  // =========================================================================
  // TEST 3: BB VOLUME CHANGE TRIGGERS PROMOTION
  // =========================================================================
  describe('3. BB Volume Change Triggers Promotion', () => {
    it('promotes member to Silver when BB reaches 250 (Left=2000, Right=2000, BB was 200)', async () => {
      const memberId = 'dist-prompt8-bb-promo';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-BB-01',
        distributorId: 'KV-BB-01',
        currentBB: 200,
        lifetimePV: 200,
        currentMatching: 2000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        highestRank: null,
        user: { firstName: 'BB', lastName: 'Member' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-BB-01',
        currentBB: 200,
        leftVolume: 2000,
        rightVolume: 2000,
        leftMatching: 2000,
        rightMatching: 2000,
      });

      // Member receives 50 BB from an Order
      const result = await LevelPromotionEventService.processBBEvent({
        memberId,
        amount: 50,
        source: 'ORDER',
        referenceId: 'ORD-BB-50',
        description: 'Qualifying order of 50 BB',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.currentLevel.code).toBe('SILVER');
      expect(result.volumeUpdated.bb).toBe(250);
      expect(result.volumeUpdated.leftMatching).toBe(2000);
      expect(result.volumeUpdated.rightMatching).toBe(2000);
    });
  });

  // =========================================================================
  // TEST 4: LEFT MATCHING CHANGE TRIGGERS PROMOTION
  // =========================================================================
  describe('4. LEFT Matching Change Triggers Promotion', () => {
    it('promotes member to Platinum when Left Matching reaches 50000 (BB=500, Right=50000, Left was 48000)', async () => {
      const memberId = 'dist-prompt8-left-promo';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-LEFT-01',
        distributorId: 'KV-LEFT-01',
        currentBB: 500,
        lifetimePV: 500,
        currentMatching: 48000,
        currentLevelId: 'lvl-gold',
        currentRankId: 'rnk-gold',
        currentLevel: {
          id: 'lvl-gold',
          code: 'GOLD',
          name: 'Gold',
          order: 2,
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        },
        currentRank: null,
        highestRank: null,
        user: { firstName: 'Platinum', lastName: 'Candidate' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-LEFT-01',
        currentBB: 500,
        leftVolume: 48000,
        rightVolume: 50000,
        leftMatching: 48000,
        rightMatching: 50000,
        currentLevel: mockMember.currentLevel,
        currentRank: mockMember.currentRank,
      });

      // Member receives 2000 Left matching volume credit
      const result = await LevelPromotionEventService.processLeftMatchingEvent({
        memberId,
        amount: 2000,
        source: 'MATCHING',
        referenceId: 'REF-LEFT-50000',
        description: 'Left leg credit reaching Platinum threshold',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('GOLD');
      expect(result.currentLevel.code).toBe('PLATINUM');
      expect(result.volumeUpdated.leftMatching).toBe(50000);
      expect(result.volumeUpdated.rightMatching).toBe(50000);
      expect(result.volumeUpdated.bb).toBe(500);
    });
  });

  // =========================================================================
  // TEST 5: DIRECT MULTI-TIER PROMOTION TO RUBY
  // =========================================================================
  describe('5. Direct Multi-Tier Jump to Ruby', () => {
    it('promotes directly to RUBY when all 3 criteria reach Ruby thresholds (BB=1000, Left=100000, Right reaches 100000)', async () => {
      const memberId = 'dist-prompt8-ruby';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-RUBY-01',
        distributorId: 'KV-RUBY-01',
        currentBB: 1000,
        currentMatching: 95000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        highestRank: null,
        user: { firstName: 'Top', lastName: 'Leader' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-RUBY-01',
        currentBB: 1000,
        leftVolume: 100000,
        rightVolume: 95000,
        leftMatching: 100000,
        rightMatching: 95000,
      });

      // Right leg increases by 5000 to 100000
      const result = await LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 5000,
        source: 'MATCHING',
        referenceId: 'REF-RUBY-RIGHT',
        description: 'Right matching increases to 100,000',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.currentLevel.code).toBe('RUBY');
      expect(result.currentLevel.order).toBe(5);
      expect(result.volumeUpdated.bb).toBe(1000);
      expect(result.volumeUpdated.leftMatching).toBe(100000);
      expect(result.volumeUpdated.rightMatching).toBe(100000);
    });
  });

  // =========================================================================
  // TEST 6: STRICT INDEPENDENCE: 2 OF 3 IS NOT ENOUGH
  // =========================================================================
  describe('6. Strict 3-Condition Independence (No Partial Qualifications)', () => {
    it('does NOT promote to Platinum if Right Matching is below 50,000 (BB=500, Left=50000, Right=40000)', async () => {
      const memberId = 'dist-prompt8-partial-1';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-PART-1',
        distributorId: 'KV-PART-1',
        currentBB: 500,
        currentMatching: 40000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        highestRank: null,
        user: { firstName: 'Unbalanced', lastName: 'Member' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-PART-1',
        currentBB: 500,
        leftVolume: 50000,
        rightVolume: 35000,
        leftMatching: 50000,
        rightMatching: 35000,
      });

      // Right leg receives +5000 to reach 40,000 (still below 50,000 Platinum threshold)
      const result = await LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 5000,
        source: 'MATCHING',
        referenceId: 'REF-PART-40K',
      });

      expect(result.success).toBe(true);
      expect(result.currentLevel.code).not.toBe('PLATINUM');
      // It qualifies for Gold (BB 250, Left 5000, Right 5000)
      expect(result.currentLevel.code).toBe('GOLD');
    });

    it('does NOT promote to Platinum if BB is below 500 (BB=400, Left=50000, Right=50000)', async () => {
      const memberId = 'dist-prompt8-partial-2';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-PART-2',
        distributorId: 'KV-PART-2',
        currentBB: 400,
        lifetimePV: 400,
        currentMatching: 50000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        highestRank: null,
        user: { firstName: 'LowBB', lastName: 'Member' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-PART-2',
        currentBB: 400,
        leftVolume: 50000,
        rightVolume: 49000,
        leftMatching: 50000,
        rightMatching: 49000,
      });

      // Right matching reaches 50000, but BB is only 400 (< 500 required for Platinum)
      const result = await LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 1000,
        source: 'MATCHING',
        referenceId: 'REF-PART-BB400',
      });

      expect(result.success).toBe(true);
      expect(result.currentLevel.code).not.toBe('PLATINUM');
      // Highest satisfied tier is Gold (BB 250, Left 5000, Right 5000)
      expect(result.currentLevel.code).toBe('GOLD');
    });
  });

  // =========================================================================
  // TEST 7: IDEMPOTENCY PROTECTION
  // =========================================================================
  describe('7. Idempotency Protection Across Volume Events', () => {
    it('prevents double volume crediting and duplicate promotions on duplicate BB reference', async () => {
      const memberId = 'dist-prompt8-idem-bb';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-IDEM-01',
        distributorId: 'KV-IDEM-01',
        currentBB: 250,
        lifetimePV: 250,
        currentMatching: 2000,
        currentLevel: null,
        currentRank: null,
        user: {},
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      // Simulate that this transaction already exists in the ledger
      const existingTx = {
        id: 'tx-existing-bb',
        memberId,
        source: 'ORDER',
        referenceId: 'ORD-DUPLICATE-001',
        amount: 50,
        balanceAfter: 250,
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(existingTx);

      const result = await LevelPromotionEventService.processBBEvent({
        memberId,
        amount: 50,
        source: 'ORDER',
        referenceId: 'ORD-DUPLICATE-001',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(false);
      expect(result.transaction.id).toBe('tx-existing-bb');
      expect(result.message).toContain('already processed');
    });

    it('prevents double matching volume crediting on duplicate matching reference', async () => {
      const memberId = 'dist-prompt8-idem-match';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-IDEM-02',
        distributorId: 'KV-IDEM-02',
        currentBB: 250,
        currentMatching: 2000,
        currentLevel: null,
        currentRank: null,
        user: {},
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      const existingTx = {
        id: 'tx-existing-match',
        memberId,
        source: 'MATCHING',
        referenceId: 'REF-MATCH-DUPE-01',
        amount: 100,
        balanceAfter: 2000,
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(existingTx);

      const result = await LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 100,
        source: 'MATCHING',
        referenceId: 'REF-MATCH-DUPE-01',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(false);
      expect(result.transaction.id).toBe('tx-existing-match');
      expect(result.message).toContain('already processed');
    });
  });

  // =========================================================================
  // TEST 8: CONCURRENCY PROTECTION
  // =========================================================================
  describe('8. Concurrency Protection (Per-Member Lock)', () => {
    it('serializes concurrent matching events for the same member without race conditions', async () => {
      const memberId = 'dist-prompt8-concurrency';

      const mockMember = {
        id: memberId,
        distributorCode: 'DST-CONC-01',
        distributorId: 'KV-CONC-01',
        currentBB: 250,
        currentMatching: 1800,
        currentLevel: null,
        currentRank: null,
        user: {},
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockMember as any);

      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-CONC-01',
        currentBB: 250,
        leftVolume: 2000,
        rightVolume: 1800,
        leftMatching: 2000,
        rightMatching: 1800,
      });

      // Launch two events concurrently for the same member
      const p1 = LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 100,
        source: 'MATCHING',
        referenceId: 'CONC-TX-1',
      });

      const p2 = LevelPromotionEventService.processRightMatchingEvent({
        memberId,
        amount: 100,
        source: 'MATCHING',
        referenceId: 'CONC-TX-2',
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      // The second one hits 2000 right matching and promotes to Silver
      expect(r2.currentLevel.code).toBe('SILVER');
    });
  });
});
