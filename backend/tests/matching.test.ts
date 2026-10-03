import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  MatchingService,
  MATCHING_ENGINE_CONFIG,
  RecordMatchingTransactionInput,
  BinaryPropagationInput,
} from '../src/services/matching.service';
import { LevelPromotionService } from '../src/services/level/levelPromotion.service';
import { DEFAULT_MLM_LEVELS } from '../src/services/level/levelQualification.service';

describe('BINARY MATCHING VOLUME ENGINE TESTS (PROMPT 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MatchingService.resetMatchingFormula();

    // Mock interactive transactions so tests run cleanly in both offline & online DB environments
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  const mockDistributor = {
    id: 'dist-match-001',
    distributorCode: 'DST-70001',
    distributorId: 'KV-7001',
    currentMatching: 35000,
    currentRankId: 'rank-silver-id',
    businessCenters: [
      {
        id: 'bc-match-001',
        centerNumber: 1,
        centerCode: 'BC-001',
        leftVolume: 40000,
        rightVolume: 35000,
        accumulatedLeftVolume: 40000,
        accumulatedRightVolume: 35000,
      },
    ],
  };

  // =========================================================================
  // 1. LEFT-LEG VOLUME TESTS
  // =========================================================================
  describe('1. Left-Leg Volume Calculation', () => {
    it('should accurately retrieve accumulated left-leg volume for member', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const leftVol = await MatchingService.getLeftVolume('dist-match-001');

      expect(leftVol).toBe(40000);
    });

    it('should aggregate left-leg volume from BVLedger when date/period filter is provided', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);
      vi.spyOn(prisma.bVLedger, 'aggregate').mockResolvedValue({
        _sum: { bv: 18500 as any },
      } as any);

      const leftVol = await MatchingService.getLeftVolume('dist-match-001', {
        periodId: 'PERIOD-2026-W39',
      });

      expect(leftVol).toBe(18500);
      expect(prisma.bVLedger.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorId: 'dist-match-001',
            position: 'LEFT',
            commissionPeriodId: 'PERIOD-2026-W39',
          }),
        })
      );
    });

    it('should reject non-existing member with 404', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      await expect(MatchingService.getLeftVolume('NON_EXISTING')).rejects.toThrow(
        /not found/i
      );
    });
  });

  // =========================================================================
  // 2. RIGHT-LEG VOLUME TESTS
  // =========================================================================
  describe('2. Right-Leg Volume Calculation', () => {
    it('should accurately retrieve accumulated right-leg volume for member', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const rightVol = await MatchingService.getRightVolume('dist-match-001');

      expect(rightVol).toBe(35000);
    });

    it('should aggregate right-leg volume from BVLedger when date/period filter is provided', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);
      vi.spyOn(prisma.bVLedger, 'aggregate').mockResolvedValue({
        _sum: { bv: 14200 as any },
      } as any);

      const rightVol = await MatchingService.getRightVolume('dist-match-001', {
        periodId: 'PERIOD-2026-W39',
      });

      expect(rightVol).toBe(14200);
      expect(prisma.bVLedger.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            distributorId: 'dist-match-001',
            position: 'RIGHT',
            commissionPeriodId: 'PERIOD-2026-W39',
          }),
        })
      );
    });
  });

  // =========================================================================
  // 3. MATCHING VOLUME & CONFIGURABLE FORMULA TESTS
  // =========================================================================
  describe('3. Matching Volume & Configurable Formula Engine', () => {
    it('should calculate matching volume strictly as min(left, right) under default project rule', async () => {
      // Concept Example: LEFT = 40,000; RIGHT = 35,000 -> Matched = 35,000
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const matchingVolume = await MatchingService.getMatchingVolume('dist-match-001');

      expect(matchingVolume).toBe(35000);
    });

    it('should return complete eligible matching breakdown including strong/weak legs and surplus', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const result = await MatchingService.calculateEligibleMatching('dist-match-001');

      expect(result.leftVolume).toBe(40000);
      expect(result.rightVolume).toBe(35000);
      expect(result.matchedVolume).toBe(35000);
      expect(result.strongLeg).toBe('LEFT');
      expect(result.weakLeg).toBe('RIGHT');
      expect(result.unmatchedVolume).toBe(5000);
      expect(result.carryForwardLeft).toBe(5000);
      expect(result.carryForwardRight).toBe(0);
      expect(result.isEligible).toBe(true);
      expect(result.ruleApplied).toBe('MINIMUM_LEG');
    });

    it('should return 0 matched volume when one leg has 0 volume', async () => {
      const unbalancedDistributor = {
        ...mockDistributor,
        businessCenters: [
          {
            ...mockDistributor.businessCenters[0],
            leftVolume: 50000,
            rightVolume: 0,
            accumulatedLeftVolume: 50000,
            accumulatedRightVolume: 0,
          },
        ],
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(unbalancedDistributor as any);

      const result = await MatchingService.calculateEligibleMatching('dist-match-001');

      expect(result.leftVolume).toBe(50000);
      expect(result.rightVolume).toBe(0);
      expect(result.matchedVolume).toBe(0);
      expect(result.isEligible).toBe(false);
      expect(result.carryForwardLeft).toBe(50000);
    });

    it('should support configurable PAIR_MATCHING rule with step units', () => {
      // Left = 40,000, Right = 35,500; pairUnit = 1,000 -> Min is 35,500 -> Floored to 35,000
      MatchingService.setMatchingFormula('PAIR_MATCHING', { pairUnit: 1000 });

      const matched = MatchingService.calculateMatchingByRule(40000, 35500);
      expect(matched).toBe(35000);

      // Left = 2,450, Right = 1,980; pairUnit = 500 -> Min is 1,980 -> Floored to 1,500
      const matched2 = MatchingService.calculateMatchingByRule(2450, 1980, 'PAIR_MATCHING', { pairUnit: 500 });
      expect(matched2).toBe(1500);
    });

    it('should support configurable DAILY_MATCHING rule with daily volume caps', () => {
      MatchingService.setMatchingFormula('DAILY_MATCHING', { dailyCap: 25000 });

      // Left = 40,000, Right = 35,000 -> Min is 35,000 -> Capped at 25,000
      const matched = MatchingService.calculateMatchingByRule(40000, 35000);
      expect(matched).toBe(25000);

      // Volume below cap -> 15,000
      const matchedBelow = MatchingService.calculateMatchingByRule(15000, 20000);
      expect(matchedBelow).toBe(15000);
    });

    it('should support pluggable CUSTOM matching formula function', () => {
      // Custom rule: 60% of weaker leg + 10% of stronger leg
      MatchingService.setMatchingFormula('CUSTOM', {
        customFormula: (left, right) => {
          const min = Math.min(left, right);
          const max = Math.max(left, right);
          return min * 0.6 + max * 0.1;
        },
      });

      const matched = MatchingService.calculateMatchingByRule(40000, 30000);
      // min = 30,000 * 0.6 = 18,000; max = 40,000 * 0.1 = 4,000 -> Total = 22,000
      expect(matched).toBe(22000);
    });

    it('should reset configurable formula back to project default (MINIMUM_LEG)', () => {
      MatchingService.setMatchingFormula('DAILY_MATCHING', { dailyCap: 1000 });
      expect(MatchingService.getMatchingFormula().rule).toBe('DAILY_MATCHING');

      MatchingService.resetMatchingFormula();

      const config = MatchingService.getMatchingFormula();
      expect(config.rule).toBe('MINIMUM_LEG');
      expect(config.dailyCap).toBeNull();
      expect(MatchingService.calculateMatchingByRule(40000, 35000)).toBe(35000);
    });
  });

  // =========================================================================
  // 4. DUPLICATE TRANSACTION PREVENTION (IDEMPOTENCY)
  // =========================================================================
  describe('4. Duplicate Transaction Prevention & Traceability', () => {
    it('should record a matching transaction and update running balance', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);
      vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(null);
      vi.spyOn((prisma as any).matchingTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 35000,
      } as any);

      const createdTx = {
        id: 'match-tx-101',
        memberId: 'dist-match-001',
        amount: 5000,
        balanceAfter: 40000,
        type: 'MATCH_CYCLE',
        source: 'COMMISSION_CYCLE',
        referenceId: 'CYCLE-2026-W39',
        description: 'Binary matching credit for cycle W39',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).matchingTransaction, 'create').mockResolvedValue(createdTx as any);
      vi.spyOn((prisma as any).distributorProfile, 'update').mockResolvedValue(mockDistributor as any);

      const input: RecordMatchingTransactionInput = {
        memberId: 'dist-match-001',
        amount: 5000,
        type: 'MATCH_CYCLE',
        source: 'COMMISSION_CYCLE',
        referenceId: 'CYCLE-2026-W39',
        description: 'Binary matching credit for cycle W39',
      };

      const result = await MatchingService.recordMatchingTransaction(input);

      expect(result.isDuplicate).toBe(false);
      expect(result.currentMatching).toBe(40000);
      expect(result.transaction).toBeDefined();
      expect(Number(result.transaction.amount)).toBe(5000);
      expect(Number(result.transaction.balanceAfter)).toBe(40000);
      expect(result.transaction.referenceId).toBe('CYCLE-2026-W39');
    });

    it('should prevent duplicate matching credit when same source + referenceId is processed twice', async () => {
      const existingTx = {
        id: 'match-tx-existing-99',
        memberId: 'dist-match-001',
        amount: 5000,
        balanceAfter: 35000,
        type: 'MATCH_CYCLE',
        source: 'COMMISSION_CYCLE',
        referenceId: 'CYCLE-DUPLICATE-CHECK',
        description: 'First processing attempt',
        createdAt: new Date(),
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);
      // Return existing record on unique lookup
      vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(existingTx as any);
      const createSpy = vi.spyOn((prisma as any).matchingTransaction, 'create');

      const input: RecordMatchingTransactionInput = {
        memberId: 'dist-match-001',
        amount: 5000,
        source: 'COMMISSION_CYCLE',
        referenceId: 'CYCLE-DUPLICATE-CHECK',
      };

      const result = await MatchingService.recordMatchingTransaction(input);

      expect(result.isDuplicate).toBe(true);
      expect(result.transaction.id).toBe('match-tx-existing-99');
      expect(result.message).toContain('already recorded');
      // Verify no create call was made
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('should retrieve traceable matching transaction history with pagination', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const mockHistory = [
        {
          id: 'tx-1',
          memberId: 'dist-match-001',
          amount: 20000,
          balanceAfter: 20000,
          type: 'MATCH_CYCLE',
          source: 'COMMISSION_CYCLE',
          referenceId: 'CYCLE-01',
          description: 'Cycle 1 matching',
          createdAt: new Date('2026-09-01'),
        },
        {
          id: 'tx-2',
          memberId: 'dist-match-001',
          amount: 15000,
          balanceAfter: 35000,
          type: 'MATCH_CYCLE',
          source: 'COMMISSION_CYCLE',
          referenceId: 'CYCLE-02',
          description: 'Cycle 2 matching',
          createdAt: new Date('2026-09-15'),
        },
      ];

      vi.spyOn((prisma as any).matchingTransaction, 'findMany').mockResolvedValue(mockHistory as any);
      vi.spyOn((prisma as any).matchingTransaction, 'count').mockResolvedValue(2);

      const history = await MatchingService.getMatchingHistory('dist-match-001', {
        page: 1,
        limit: 10,
      });

      expect(history.total).toBe(2);
      expect(history.data.length).toBe(2);
      expect(history.data[0].amount).toBe(20000);
      expect(history.data[1].balanceAfter).toBe(35000);
      expect(history.currentBalance).toBe(35000);
    });
  });

  // =========================================================================
  // 5. RECALCULATION & DISCREPANCY AUDIT TESTS
  // =========================================================================
  describe('5. Recalculation & Audit Engine', () => {
    it('should detect volume discrepancy, record audit transaction, and synchronize currentMatching', async () => {
      // Member currently cached at 20,000 Matching, but actual leg volumes are Left=40,000, Right=35,000 -> Recalculated=35,000 (discrepancy: +15,000)
      const distWithLag = {
        ...mockDistributor,
        currentMatching: 20000,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(distWithLag as any);
      vi.spyOn(MatchingService, 'getLeftVolume').mockResolvedValue(40000);
      vi.spyOn(MatchingService, 'getRightVolume').mockResolvedValue(35000);

      vi.spyOn(MatchingService, 'recordMatchingTransaction').mockResolvedValue({
        transaction: { id: 'audit-tx-001', amount: 15000, source: 'RECALCULATION' },
        currentMatching: 35000,
        isDuplicate: false,
        message: 'Recalculation audit recorded',
      });

      vi.spyOn((prisma as any).distributorProfile, 'update').mockResolvedValue({
        ...distWithLag,
        currentMatching: 35000,
      } as any);

      // Level promotion check handoff
      vi.spyOn(LevelPromotionService, 'evaluateAndPromote').mockResolvedValue({
        distributorId: 'dist-match-001',
        distributorCode: 'DST-70001',
        promoted: true,
        previousLevel: DEFAULT_MLM_LEVELS[1], // Silver
        newLevel: DEFAULT_MLM_LEVELS[2],      // Gold
        snapshot: { qualifiedBB: 250, qualifiedMatching: 35000, timestamp: new Date() },
        message: 'Promoted to Gold upon matching recalculation',
      });

      const audit = await MatchingService.recalculateMatching('dist-match-001');

      expect(audit.previousMatching).toBe(20000);
      expect(audit.recalculatedMatching).toBe(35000);
      expect(audit.discrepancy).toBe(15000);
      expect(audit.updated).toBe(true);
      expect(audit.promotionResult).toBeDefined();
      expect(audit.promotionResult.promoted).toBe(true);
      expect(audit.promotionResult.newLevel.name).toBe('Gold');
    });

    it('should report zero discrepancy when cached volume perfectly matches audited leg volume', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);
      vi.spyOn(MatchingService, 'getLeftVolume').mockResolvedValue(40000);
      vi.spyOn(MatchingService, 'getRightVolume').mockResolvedValue(35000);

      const audit = await MatchingService.recalculateMatching('dist-match-001');

      expect(audit.previousMatching).toBe(35000);
      expect(audit.recalculatedMatching).toBe(35000);
      expect(audit.discrepancy).toBe(0);
      expect(audit.updated).toBe(false);
    });
  });

  // =========================================================================
  // 6. BINARY-TREE PROPAGATION TESTS
  // =========================================================================
  describe('6. Binary-Tree Volume Propagation', () => {
    it('should propagate volume up the binary tree to all ancestors on correct legs', async () => {
      // Tree: Source D (LEFT child of B) -> B (LEFT child of Root A)
      const sourceDistributor = {
        id: 'dist-d',
        distributorCode: 'DST-D',
      };

      const sourceNode = {
        id: 'node-d',
        distributorId: 'dist-d',
        placementParentId: 'node-b',
        placementPosition: 'LEFT',
      };

      const parentNodeB = {
        id: 'node-b',
        distributorId: 'dist-b',
        businessCenterId: 'bc-b',
        placementParentId: 'node-a',
        placementPosition: 'RIGHT', // B is on Root A's RIGHT leg
      };

      const rootNodeA = {
        id: 'node-a',
        distributorId: 'dist-a',
        businessCenterId: 'bc-a',
        placementParentId: null,
        placementPosition: null,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(sourceDistributor as any);
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue(sourceNode as any);

      // Mock ancestor lookups
      vi.spyOn(prisma.mLMNode, 'findUnique').mockImplementation(async (args: any) => {
        if (args.where.id === 'node-b') return parentNodeB as any;
        if (args.where.id === 'node-a') return rootNodeA as any;
        return null;
      });

      // Mock business center volume increments
      vi.spyOn(prisma.businessCenter, 'update').mockImplementation(async (args: any) => {
        if (args.where.id === 'bc-b') {
          return { id: 'bc-b', leftVolume: 5000, rightVolume: 0 } as any;
        }
        if (args.where.id === 'bc-a') {
          return { id: 'bc-a', leftVolume: 0, rightVolume: 5000 } as any;
        }
        return {} as any;
      });

      vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);

      const input: BinaryPropagationInput = {
        sourceDistributorId: 'dist-d',
        amount: 5000,
        orderId: 'ORD-PROP-999',
        description: 'New product order',
        autoRecordMatching: false,
      };

      const propagation = await MatchingService.propagateBinaryVolume(input);

      expect(propagation.volumeCredited).toBe(5000);
      expect(propagation.totalAncestorsAffected).toBe(2);

      // Ancestor 1: Parent B (Volume rolls up on LEFT leg)
      expect(propagation.ancestorsUpdated[0].distributorId).toBe('dist-b');
      expect(propagation.ancestorsUpdated[0].leg).toBe('LEFT');
      expect(propagation.ancestorsUpdated[0].newLeftVolume).toBe(5000);

      // Ancestor 2: Root A (Volume rolls up on RIGHT leg because B is on A's RIGHT)
      expect(propagation.ancestorsUpdated[1].distributorId).toBe('dist-a');
      expect(propagation.ancestorsUpdated[1].leg).toBe('RIGHT');
      expect(propagation.ancestorsUpdated[1].newRightVolume).toBe(5000);

      // Verify BVLedger was called for each ancestor
      expect(prisma.bVLedger.create).toHaveBeenCalledTimes(2);
    });

    it('should handle leaf node or tree root without parent gracefully', async () => {
      const rootDistributor = { id: 'dist-root', distributorCode: 'DST-ROOT' };
      const rootNode = {
        id: 'node-root',
        distributorId: 'dist-root',
        placementParentId: null, // Root node has no parent
        placementPosition: null,
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(rootDistributor as any);
      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue(rootNode as any);

      const propagation = await MatchingService.propagateBinaryVolume({
        sourceDistributorId: 'dist-root',
        amount: 1000,
      });

      expect(propagation.totalAncestorsAffected).toBe(0);
      expect(propagation.ancestorsUpdated).toEqual([]);
    });
  });

  // =========================================================================
  // 7. LEVEL SYSTEM INTEGRATION (HANDOFF WITHOUT DUPLICATION)
  // =========================================================================
  describe('7. Rank & Level System Single Qualifying Value Handoff', () => {
    it('should provide single qualifying matching volume value without duplicating calculations in rank service', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const matchingVolume = await MatchingService.getMatchingVolume('dist-match-001');

      // Rank service receives this single value
      expect(matchingVolume).toBe(35000);
      expect(typeof matchingVolume).toBe('number');
    });

    it('calculateTotalMatching legacy adapter should return full MatchingVolumeResult for existing consumers', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockDistributor as any);

      const legacyResult = await MatchingService.calculateTotalMatching('dist-match-001');

      expect(legacyResult.distributorId).toBe('dist-match-001');
      expect(legacyResult.totalMatching).toBe(35000);
      expect(legacyResult.accumulatedLeftVolume).toBe(40000);
      expect(legacyResult.accumulatedRightVolume).toBe(35000);
      expect(legacyResult.ruleApplied).toBe('MINIMUM_LEG');
    });
  });
});
