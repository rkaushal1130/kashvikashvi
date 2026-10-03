import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/database';
import {
  BBService,
  BB_ENGINE_CONFIG,
  AddBBInput,
  RemoveBBInput,
} from '../src/services/bb.service';
import { LevelPromotionService } from '../src/services/level/levelPromotion.service';
import { LevelQualificationService } from '../src/services/level/levelQualification.service';
import { DEFAULT_MLM_LEVELS } from '../src/services/level/levelQualification.service';

describe('BB LEDGER & BB SERVICE TESTS (PROMPT 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests run cleanly in both offline & online DB environments
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  const mockDistributor = {
    id: 'dist-bb-001',
    distributorCode: 'DST-90001',
    currentBB: 100,
    lifetimePV: 100,
    currentRankId: 'rank-starter-id',
    currentRank: {
      id: 'rank-starter-id',
      level: 0,
      name: 'Starter',
      rankCode: 'RANK_STARTER',
    },
  };

  describe('1. Adding BB to Member Ledger', () => {
    it('should successfully add BB credit, update balance, and create ledger entry', async () => {
      // Mock distributor lookup
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockDistributor as any);

      // Mock transaction queries
      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 100,
      } as any);

      const createdTx = {
        id: 'bb-tx-101',
        memberId: 'dist-bb-001',
        amount: 150,
        balanceAfter: 250,
        type: 'CREDIT',
        source: 'ORDER',
        referenceId: 'ORD-55441',
        description: 'Order personal BB credit',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).bBTransaction, 'create').mockResolvedValue(createdTx as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue(mockDistributor as any);
      vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);

      // Level check returns non-promoted for now
      vi.spyOn(LevelPromotionService, 'evaluateAndPromote').mockResolvedValue({
        distributorId: 'dist-bb-001',
        distributorCode: 'DST-90001',
        promoted: false,
        previousLevel: DEFAULT_MLM_LEVELS[0],
        newLevel: DEFAULT_MLM_LEVELS[0],
        snapshot: { qualifiedBB: 250, qualifiedMatching: 500, timestamp: new Date() },
        message: 'Maintains current level',
      });

      const input: AddBBInput = {
        memberId: 'dist-bb-001',
        amount: 150,
        source: 'ORDER',
        referenceId: 'ORD-55441',
        description: 'Order personal BB credit',
      };

      const result = await BBService.addBB(input);

      expect(result.isDuplicate).toBe(false);
      expect(result.currentBB).toBe(250);
      expect(result.transaction).toBeDefined();
      expect(Number(result.transaction.amount)).toBe(150);
      expect(Number(result.transaction.balanceAfter)).toBe(250);
      expect(result.transaction.source).toBe('ORDER');
      expect(result.transaction.referenceId).toBe('ORD-55441');
      expect(result.message).toContain('Successfully credited 150 BB');
    });
  });

  describe('2. Idempotency & Duplicate Transaction Prevention', () => {
    it('should prevent duplicate crediting when same source + referenceId is processed twice', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockDistributor as any);

      const existingTx = {
        id: 'bb-tx-existing-1',
        memberId: 'dist-bb-001',
        amount: 100,
        balanceAfter: 200,
        type: 'CREDIT',
        source: 'ORDER',
        referenceId: 'ORD-DUPLICATE-999',
        description: 'First processing attempt',
        createdAt: new Date(),
      };

      // Mock idempotency collision: findUnique finds existing record
      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(existingTx as any);
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 200,
      } as any);

      // Also mock aggregate and count in case getBBBalance is queried
      vi.spyOn((prisma as any).bBTransaction, 'aggregate')
        .mockResolvedValueOnce({ _sum: { amount: 200 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });
      vi.spyOn((prisma as any).bBTransaction, 'count').mockResolvedValue(1);

      const input: AddBBInput = {
        memberId: 'dist-bb-001',
        amount: 100,
        source: 'ORDER',
        referenceId: 'ORD-DUPLICATE-999',
        description: 'Duplicate processing attempt',
      };

      const result = await BBService.addBB(input);

      // Verification: Returned as duplicate, no new credit applied
      expect(result.isDuplicate).toBe(true);
      expect(result.transaction.id).toBe('bb-tx-existing-1');
      expect(result.message).toContain("already processed for source 'ORDER'");
    });

    it('should validate and detect duplicate transactions via validateBBTransaction', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockDistributor as any);

      const existingTx = {
        id: 'bb-tx-existing-2',
        memberId: 'dist-bb-001',
        source: 'BONUS',
        referenceId: 'BONUS-2026-09',
      };

      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(existingTx as any);

      const validation = await BBService.validateBBTransaction({
        memberId: 'dist-bb-001',
        amount: 50,
        source: 'BONUS',
        referenceId: 'BONUS-2026-09',
      });

      expect(validation.isValid).toBe(true);
      expect(validation.isDuplicate).toBe(true);
      expect(validation.existingTransaction).toBeDefined();
    });
  });

  describe('3. Validation of BB Transactions & Invalid Amounts', () => {
    it('should reject non-positive amounts (negative and zero)', async () => {
      const negativeResult = await BBService.validateBBTransaction({
        memberId: 'dist-bb-001',
        amount: -50,
        source: 'ORDER',
        referenceId: 'ORD-NEG',
      });

      expect(negativeResult.isValid).toBe(false);
      expect(negativeResult.errors).toContain('amount must be a positive number greater than 0');

      const zeroResult = await BBService.validateBBTransaction({
        memberId: 'dist-bb-001',
        amount: 0,
        source: 'ORDER',
        referenceId: 'ORD-ZERO',
      });

      expect(zeroResult.isValid).toBe(false);
      expect(zeroResult.errors).toContain('amount must be a positive number greater than 0');
    });

    it('should reject NaN or invalid non-numeric amounts', async () => {
      const nanResult = await BBService.validateBBTransaction({
        memberId: 'dist-bb-001',
        amount: NaN,
        source: 'ORDER',
        referenceId: 'ORD-NAN',
      });

      expect(nanResult.isValid).toBe(false);
      expect(nanResult.errors).toContain('amount must be a positive number greater than 0');
    });

    it('should reject missing required fields (memberId, source, referenceId)', async () => {
      const missingFields = await BBService.validateBBTransaction({
        memberId: '',
        amount: 100,
        source: '',
        referenceId: '',
      });

      expect(missingFields.isValid).toBe(false);
      expect(missingFields.errors).toEqual(
        expect.arrayContaining([
          'memberId is required',
          'source is required',
          'referenceId is required',
        ])
      );
    });

    it('should throw AppError.badRequest when addBB receives invalid parameters', async () => {
      await expect(
        BBService.addBB({
          memberId: 'dist-bb-001',
          amount: -100,
          source: 'ORDER',
          referenceId: 'REF-INVALID',
        })
      ).rejects.toThrow('amount must be a positive number greater than 0');
    });
  });

  describe('4. BB Balance Calculation & Ledger Recalculation', () => {
    it('should accurately calculate currentBB and lifetimeBB from ledger history', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockDistributor as any);

      vi.spyOn((prisma as any).bBTransaction, 'aggregate')
        .mockResolvedValueOnce({ _sum: { amount: 350 } })  // credits
        .mockResolvedValueOnce({ _sum: { amount: -50 } }); // debits

      vi.spyOn((prisma as any).bBTransaction, 'count').mockResolvedValue(4);

      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 300,
        createdAt: new Date('2026-09-30T10:00:00Z'),
      } as any);

      const balance = await BBService.getBBBalance('dist-bb-001');

      expect(balance.memberId).toBe('dist-bb-001');
      expect(balance.distributorCode).toBe('DST-90001');
      expect(balance.currentBB).toBe(300);
      expect(balance.totalCredits).toBe(350);
      expect(balance.totalDebits).toBe(50);
      expect(balance.transactionCount).toBe(4);
      expect(balance.lastTransactionAt).toEqual(new Date('2026-09-30T10:00:00Z'));
    });

    it('should recalculate BB from ledger, audit discrepancies, and update profile', async () => {
      const profile = {
        id: 'dist-bb-001',
        distributorCode: 'DST-90001',
        currentBB: 150,
        lifetimePV: 150,
      };

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(profile as any);

      // Ledger sum actually totals 250
      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 250 },
        _count: { id: 3 },
      });

      const updateSpy = vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
      vi.spyOn(LevelPromotionService, 'evaluateAndPromote').mockResolvedValue(null as any);

      const recalc = await BBService.recalculateBBFromLedger('dist-bb-001');

      expect(recalc.previousBB).toBe(150);
      expect(recalc.recalculatedBB).toBe(250);
      expect(recalc.discrepancy).toBe(100);
      expect(recalc.transactionCount).toBe(3);
      expect(updateSpy).toHaveBeenCalled();
    });

    it('should accurately handle BB removal / debit and prevent negative balance without override', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockDistributor as any);
      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 100,
      } as any);

      // Attempting to remove 150 BB when balance is only 100
      await expect(
        BBService.removeBB({
          memberId: 'dist-bb-001',
          amount: 150,
          source: 'REFUND',
          referenceId: 'REF-FAIL',
        })
      ).rejects.toThrow('Insufficient BB balance for removal');

      // Valid removal of 40 BB
      const debitTx = {
        id: 'bb-tx-debit-1',
        memberId: 'dist-bb-001',
        amount: -40,
        balanceAfter: 60,
        type: 'DEBIT',
        source: 'REFUND',
        referenceId: 'REF-PASS',
        description: 'Partial order refund',
        createdAt: new Date(),
      };

      vi.spyOn((prisma as any).bBTransaction, 'create').mockResolvedValue(debitTx as any);
      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue(mockDistributor as any);
      vi.spyOn(LevelPromotionService, 'evaluateAndPromote').mockResolvedValue(null as any);

      const debitResult = await BBService.removeBB({
        memberId: 'dist-bb-001',
        amount: 40,
        source: 'REFUND',
        referenceId: 'REF-PASS',
      });

      expect(debitResult.currentBB).toBe(60);
      expect(debitResult.message).toContain('Successfully removed 40 BB');
    });
  });

  describe('5. Automatic Level Promotion Trigger & Demotion Suppression', () => {
    it('should trigger level qualification service and promote to Silver upon achieving 250 BB with >= 2000 Matching', async () => {
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(mockDistributor as any);
      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 100,
      } as any);

      vi.spyOn((prisma as any).bBTransaction, 'create').mockResolvedValue({
        id: 'bb-tx-silver',
        memberId: 'dist-bb-001',
        amount: 150,
        balanceAfter: 250,
        type: 'CREDIT',
        source: 'ORDER',
        referenceId: 'ORD-SILVER',
        description: 'Qualifying order',
        createdAt: new Date(),
      } as any);

      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue(mockDistributor as any);
      vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);

      // Mock LevelPromotionService returning a successful promotion to Silver
      const promotionResult = {
        distributorId: 'dist-bb-001',
        distributorCode: 'DST-90001',
        promoted: true,
        previousLevel: DEFAULT_MLM_LEVELS[0], // Starter
        newLevel: DEFAULT_MLM_LEVELS[1],      // Silver (250 BB, 2000 Matching)
        snapshot: {
          qualifiedBB: 250,
          qualifiedMatching: 2500,
          timestamp: new Date(),
        },
        message: "Distributor successfully promoted from 'Starter' to 'Silver'!",
      };

      const promoSpy = vi.spyOn(LevelPromotionService, 'evaluateAndPromote').mockResolvedValue(promotionResult);

      const result = await BBService.addBB({
        memberId: 'dist-bb-001',
        amount: 150,
        source: 'ORDER',
        referenceId: 'ORD-SILVER',
      });

      expect(promoSpy).toHaveBeenCalledWith('dist-bb-001', expect.anything());
      expect(result.promotionResult).toBeDefined();
      expect(result.promotionResult?.promoted).toBe(true);
      expect(result.promotionResult?.previousLevel.name).toBe('Starter');
      expect(result.promotionResult?.newLevel.name).toBe('Silver');
      expect(result.promotionResult?.snapshot.qualifiedBB).toBe(250);
    });

    it('should NEVER demote a member when BB decreases (DEMOTION = disabled by default)', async () => {
      expect(BB_ENGINE_CONFIG.allowDemotion).toBe(false);

      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({
        ...mockDistributor,
        currentBB: 300,
        currentRankId: 'rank-silver-id',
        currentRank: {
          id: 'rank-silver-id',
          level: 1,
          name: 'Silver',
          rankCode: 'RANK_SILVER',
        },
      } as any);

      vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
      vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue({
        balanceAfter: 300,
      } as any);

      vi.spyOn((prisma as any).bBTransaction, 'create').mockResolvedValue({
        id: 'bb-tx-refund',
        memberId: 'dist-bb-001',
        amount: -100,
        balanceAfter: 200, // BB dropped below Silver's 250 requirement
        type: 'DEBIT',
        source: 'REFUND',
        referenceId: 'REF-RETENTION',
        description: 'Refund after Silver rank achieved',
        createdAt: new Date(),
      } as any);

      vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue(mockDistributor as any);

      // Promotion service evaluates and preserves Silver tier (no demotion)
      const demotionSuppressedResult = {
        distributorId: 'dist-bb-001',
        distributorCode: 'DST-90001',
        promoted: false,
        previousLevel: DEFAULT_MLM_LEVELS[1], // Silver
        newLevel: DEFAULT_MLM_LEVELS[1],      // Remains Silver
        snapshot: {
          qualifiedBB: 200,
          qualifiedMatching: 3000,
          timestamp: new Date(),
        },
        message: "Distributor maintains current level 'Silver'.",
      };

      vi.spyOn(LevelPromotionService, 'evaluateAndPromote').mockResolvedValue(demotionSuppressedResult);

      const debitResult = await BBService.removeBB({
        memberId: 'dist-bb-001',
        amount: 100,
        source: 'REFUND',
        referenceId: 'REF-RETENTION',
      });

      expect(debitResult.currentBB).toBe(200);
      expect(debitResult.promotionResult?.promoted).toBe(false);
      expect(debitResult.promotionResult?.newLevel.name).toBe('Silver');
    });
  });
});
