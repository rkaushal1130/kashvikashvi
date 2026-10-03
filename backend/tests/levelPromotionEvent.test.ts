import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  LevelPromotionEventService,
  ProcessBBEventInput,
  ProcessMatchingEventInput,
} from '../src/services/levelPromotionEvent.service';
import { LevelService } from '../src/services/level.service';
import { BBService } from '../src/services/bb.service';
import { MatchingService } from '../src/services/matching.service';
import { AppError } from '../src/utils/appError';

describe('CONNECT BB/MATCHING EVENTS TO AUTOMATIC LEVEL PROMOTION (PROMPT 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests run synchronously and cleanly
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Default resolved mocks for Prisma models to ensure offline fast execution (<50ms)
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
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);
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

  const mockBaseDistributor = {
    id: 'dist-base-001',
    distributorCode: 'DST-90001',
    distributorId: 'KV-9001',
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
    distributorCode: 'DST-90002',
    distributorId: 'KV-9002',
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
    highestRank: null,
    user: { firstName: 'Bob', lastName: 'Leader' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // =========================================================================
  // 1. BB EVENT -> AUTOMATIC PROMOTION PIPELINE
  // =========================================================================
  describe('1. BB Event to Automatic Level Promotion Pipeline', () => {
    it('should execute the required atomic flow when member receives valid BB: validate -> ledger -> update volume -> evaluate -> promote -> history -> commit', async () => {
      // Member at BASE with existing Matching volume of 2000, receives 250 BB from an ORDER
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        ...mockBaseDistributor,
        currentMatching: 2000,
      } as any);

      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      const bbCreateSpy = vi.spyOn((prisma as any).bBTransaction, 'create');
      const profileUpdateSpy = vi.spyOn(prisma.distributorProfile, 'update');
      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');

      const eventInput: ProcessBBEventInput = {
        memberId: 'dist-base-001',
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-2026-001',
        description: 'Customer order BB accrual',
      };

      const result = await LevelPromotionEventService.processBBEvent(eventInput);

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.currentLevel.code).toBe('SILVER');
      expect(result.volumeUpdated.bb).toBe(250);
      expect(result.volumeUpdated.matching).toBe(2000);

      // Verify Step 2: Ledger transaction created
      expect(bbCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: 'dist-base-001',
            source: 'ORDER',
            referenceId: 'ORD-2026-001',
          }),
        })
      );

      // Verify Step 3: Profile updated with new BB
      expect(profileUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dist-base-001' },
          data: expect.objectContaining({
            currentBB: expect.any(Object),
          }),
        })
      );

      // Verify Step 6: MemberLevelHistory created with exact source
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: 'dist-base-001',
            source: 'ORDER',
            reason: expect.stringMatching(/order/i),
          }),
        })
      );
    });

    it('should NOT promote member if BB is added but dual condition is unmet (Matching < required)', async () => {
      // Member receives 500 BB, but has 0 matching volume -> NOT Silver
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(0);

      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');

      const result = await LevelPromotionEventService.processBBEvent({
        memberId: 'dist-base-001',
        amount: 500,
        source: 'ORDER',
        referenceId: 'ORD-2026-002',
      });

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(false);
      expect(result.currentLevel.code).toBe('BASE');
      expect(result.volumeUpdated.bb).toBe(500);
      expect(historyCreateSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. MATCHING EVENT -> AUTOMATIC PROMOTION PIPELINE
  // =========================================================================
  describe('2. Matching Event to Automatic Level Promotion Pipeline', () => {
    it('should execute the required atomic flow when matching volume changes: validate -> ledger -> update volume -> evaluate -> promote -> history -> commit', async () => {
      // Member at BASE already has 300 BB, now receives 2000 Matching volume from binary rollup
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        ...mockBaseDistributor,
        currentBB: 300,
      } as any);

      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(300);

      const matchCreateSpy = vi.spyOn((prisma as any).matchingTransaction, 'create');
      const profileUpdateSpy = vi.spyOn(prisma.distributorProfile, 'update');
      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');

      const eventInput: ProcessMatchingEventInput = {
        memberId: 'dist-base-001',
        amount: 2000,
        source: 'MATCHING',
        referenceId: 'CYCLE-2026-W39',
        description: 'Binary matching cycle credit',
      };

      const result = await LevelPromotionEventService.processMatchingEvent(eventInput);

      expect(result.success).toBe(true);
      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.currentLevel.code).toBe('SILVER');
      expect(result.volumeUpdated.matching).toBe(2000);
      expect(result.volumeUpdated.bb).toBe(300);

      // Verify Step 2: Ledger transaction created
      expect(matchCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: 'dist-base-001',
            source: 'MATCHING',
            referenceId: 'CYCLE-2026-W39',
          }),
        })
      );

      // Verify Step 3: Member volume updated
      expect(profileUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dist-base-001' },
          data: expect.objectContaining({
            currentMatching: expect.any(Object),
          }),
        })
      );

      // Verify Step 6: MemberLevelHistory created with exact source
      expect(historyCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: 'dist-base-001',
            source: 'MATCHING',
          }),
        })
      );
    });
  });

  // =========================================================================
  // 3. MULTI-TIER PROMOTION DIRECT JUMP (BASE -> RUBY)
  // =========================================================================
  describe('3. Multi-Tier Jumps via Events', () => {
    it('should promote directly from BASE to RUBY when matching event satisfies Ruby requirements', async () => {
      // Member already has 1000 BB, receives massive 100,000 Matching event
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        ...mockBaseDistributor,
        currentBB: 1000,
      } as any);

      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);

      const result = await LevelPromotionEventService.processMatchingEvent({
        memberId: 'dist-base-001',
        amount: 100000,
        source: 'MATCHING',
        referenceId: 'MASSIVE-ROLLUP-001',
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.currentLevel.code).toBe('RUBY');
      expect(result.volumeUpdated.matching).toBe(100000);
    });

    it('should promote directly from BASE to GOLD when BB event satisfies Gold requirements', async () => {
      // Member already has 5000 Matching, receives 250 BB from an ORDER
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        ...mockBaseDistributor,
        currentMatching: 5000,
      } as any);

      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(5000);

      const result = await LevelPromotionEventService.processBBEvent({
        memberId: 'dist-base-001',
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-GOLD-QUAL',
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('BASE');
      expect(result.currentLevel.code).toBe('GOLD');
      expect(result.volumeUpdated.bb).toBe(250);
      expect(result.volumeUpdated.matching).toBe(5000);
    });
  });

  // =========================================================================
  // 4. ATOMIC ROLLBACK ON CRITICAL STEP FAILURE
  // =========================================================================
  describe('4. Transactional Rollback on Critical Failure', () => {
    it('should abort and rollback entire transaction if level promotion evaluation fails', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        ...mockBaseDistributor,
        currentMatching: 2000,
      } as any);

      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      // Simulate a critical error occurring during level promotion evaluation
      vi.spyOn(LevelService, 'promoteMember').mockRejectedValue(
        new Error('Database deadlock during level promotion lock')
      );

      await expect(
        LevelPromotionEventService.processBBEvent({
          memberId: 'dist-base-001',
          amount: 250,
          source: 'ORDER',
          referenceId: 'ORD-FAIL-TEST',
        })
      ).rejects.toThrow();
    });

    it('should not expose internal database error details to the frontend', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockBaseDistributor as any);

      // Simulate internal database query failure
      vi.spyOn((prisma as any).bBTransaction, 'create').mockRejectedValue(
        new Error('FATAL: connection to server on "localhost:5432" failed: connection refused (0x0000274D)')
      );

      try {
        await LevelPromotionEventService.processBBEvent({
          memberId: 'dist-base-001',
          amount: 100,
          source: 'ORDER',
          referenceId: 'ORD-INTERNAL-ERR',
        });
        expect.unreachable('Should have thrown an error');
      } catch (err: any) {
        // Must be an AppError and must not contain raw postgres connection string
        expect(err).toBeInstanceOf(AppError);
        expect(err.message).not.toContain('0x0000274D');
        expect(err.message).toBe('Unable to record BB ledger transaction.');
      }
    });
  });

  // =========================================================================
  // 5. PROMOTION SOURCE TRACEABILITY
  // =========================================================================
  describe('5. Promotion Source Traceability', () => {
    const sources = ['ORDER', 'REFERRAL', 'MATCHING', 'ADMIN', 'RECALCULATION', 'SYSTEM'];

    for (const src of sources) {
      it(`should record exact promotion source '${src}' in MemberLevelHistory`, async () => {
        vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
          ...mockBaseDistributor,
          currentMatching: 2000,
        } as any);

        vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

        const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');

        const result = await LevelPromotionEventService.processBBEvent({
          memberId: 'dist-base-001',
          amount: 250,
          source: src,
          referenceId: `REF-${src}-001`,
        });

        expect(result.source).toBe(src);
        expect(result.promoted).toBe(true);

        expect(historyCreateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              source: src,
            }),
          })
        );
      });
    }
  });

  // =========================================================================
  // 6. IDEMPOTENCY PRESERVATION
  // =========================================================================
  describe('6. Idempotency Preservation', () => {
    it('should return existing transaction without creating duplicate credits or promotions when identical BB event is received', async () => {
      const existingBBTx = {
        id: 'bb-tx-existing-1',
        memberId: 'dist-silver-001',
        amount: 250,
        balanceAfter: 250,
        type: 'CREDIT',
        source: 'ORDER',
        referenceId: 'ORD-DUP-001',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(existingBBTx);
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);

      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');
      const bbCreateSpy = vi.spyOn((prisma as any).bBTransaction, 'create');

      const result = await LevelPromotionEventService.processBBEvent({
        memberId: 'dist-silver-001',
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-DUP-001',
      });

      expect(result.promoted).toBe(false);
      expect(result.transaction.id).toBe('bb-tx-existing-1');
      expect(result.message).toContain('already processed');

      // Neither duplicate transaction nor duplicate level history created
      expect(bbCreateSpy).not.toHaveBeenCalled();
      expect(historyCreateSpy).not.toHaveBeenCalled();
    });

    it('should return existing transaction without creating duplicate credits when identical Matching event is received', async () => {
      const existingMatchTx = {
        id: 'match-tx-existing-1',
        memberId: 'dist-silver-001',
        amount: 2000,
        balanceAfter: 2000,
        type: 'CREDIT',
        source: 'MATCHING',
        referenceId: 'CYCLE-DUP-001',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(existingMatchTx);
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverDistributor as any);

      const historyCreateSpy = vi.spyOn((prisma as any).memberLevelHistory, 'create');
      const matchCreateSpy = vi.spyOn((prisma as any).matchingTransaction, 'create');

      const result = await LevelPromotionEventService.processMatchingEvent({
        memberId: 'dist-silver-001',
        amount: 2000,
        source: 'MATCHING',
        referenceId: 'CYCLE-DUP-001',
      });

      expect(result.promoted).toBe(false);
      expect(result.transaction.id).toBe('match-tx-existing-1');
      expect(result.message).toContain('already processed');

      expect(matchCreateSpy).not.toHaveBeenCalled();
      expect(historyCreateSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. ORDER COMPLETION EVENT END-TO-END
  // =========================================================================
  describe('7. Order Completion Event End-to-End Orchestration', () => {
    it('should credit purchaser BB, propagate to binary upline, and evaluate promotions in single transaction', async () => {
      const mockOrder = {
        id: 'ord-101',
        orderNumber: 'ORD-10101',
        distributorId: 'dist-base-001',
        totalBV: 250,
      };

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        ...mockBaseDistributor,
        currentMatching: 2000,
      } as any);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      vi.spyOn(MatchingService, 'propagateBinaryVolume').mockResolvedValue({
        sourceDistributorId: 'dist-base-001',
        volumeCredited: 250,
        ancestorsUpdated: [
          {
            distributorId: 'dist-ancestor-1',
            nodeId: 'node-1',
            leg: 'LEFT',
            newLeftVolume: 2000,
            newRightVolume: 2000,
            matchingVolume: 2000,
          },
        ],
        totalAncestorsAffected: 1,
      });

      const orderResult = await LevelPromotionEventService.processOrderCompletionEvent('ord-101');

      expect(orderResult.purchaserPromotion).not.toBeNull();
      expect(orderResult.purchaserPromotion?.promoted).toBe(true);
      expect(orderResult.purchaserPromotion?.currentLevel.code).toBe('SILVER');
      expect(orderResult.ancestorPromotions).toHaveLength(1);
    });
  });
});
