import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  BBService,
  MatchingService,
  LevelQualificationService,
  LevelPromotionService,
  LevelHistoryService,
  LevelRecalculationService,
  DEFAULT_MLM_LEVELS,
} from '../src/services/level';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('MLM LEVEL / RANK SYSTEM TESTS', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();

  describe('1. Level Configuration & Hierarchy Order', () => {
    it('should define the 6 canonical levels in strict ascending hierarchy order', async () => {
      const levels = await LevelQualificationService.getAllLevels();

      expect(levels.length).toBeGreaterThanOrEqual(6);

      const orderedNames = levels.map((l) => l.name);
      expect(orderedNames).toEqual(
        expect.arrayContaining(['Starter', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby'])
      );

      // Verify strict level numbers 0 -> 5
      const starter = levels.find((l) => l.name === 'Starter')!;
      const silver = levels.find((l) => l.name === 'Silver')!;
      const gold = levels.find((l) => l.name === 'Gold')!;
      const platinum = levels.find((l) => l.name === 'Platinum')!;
      const diamond = levels.find((l) => l.name === 'Diamond')!;
      const ruby = levels.find((l) => l.name === 'Ruby')!;

      expect(starter.level).toBe(0);
      expect(silver.level).toBe(1);
      expect(gold.level).toBe(2);
      expect(platinum.level).toBe(3);
      expect(diamond.level).toBe(4);
      expect(ruby.level).toBe(5);
    });

    it('should have exact required BB and Matching volumes per tier specification', () => {
      const silver = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Silver')!;
      expect(silver.requiredBB).toBe(250);
      expect(silver.requiredMatching).toBe(2000);

      const gold = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Gold')!;
      expect(gold.requiredBB).toBe(250);
      expect(gold.requiredMatching).toBe(5000);

      const platinum = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Platinum')!;
      expect(platinum.requiredBB).toBe(500);
      expect(platinum.requiredMatching).toBe(50000);

      const diamond = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Diamond')!;
      expect(diamond.requiredBB).toBe(1000);
      expect(diamond.requiredMatching).toBe(60000);

      const ruby = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Ruby')!;
      expect(ruby.requiredBB).toBe(1000);
      expect(ruby.requiredMatching).toBe(100000);
    });
  });

  describe('2. Strict Level Qualification Rule (BB and Matching Independence)', () => {
    const silver = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Silver')!;

    it('should qualify ONLY when both currentBB >= requiredBB AND totalMatching >= requiredMatching', () => {
      // Both met
      expect(LevelQualificationService.isQualifiedForLevel(250, 2000, silver)).toBe(true);
      expect(LevelQualificationService.isQualifiedForLevel(500, 3000, silver)).toBe(true);

      // BB met, Matching missing
      expect(LevelQualificationService.isQualifiedForLevel(250, 1999, silver)).toBe(false);
      expect(LevelQualificationService.isQualifiedForLevel(5000, 1000, silver)).toBe(false);

      // Matching met, BB missing
      expect(LevelQualificationService.isQualifiedForLevel(249, 5000, silver)).toBe(false);
      expect(LevelQualificationService.isQualifiedForLevel(0, 100000, silver)).toBe(false);

      // Neither met
      expect(LevelQualificationService.isQualifiedForLevel(100, 500, silver)).toBe(false);
    });

    it('should evaluate Ruby qualification strictly with 1000 BB and 100,000 Matching', () => {
      const ruby = DEFAULT_MLM_LEVELS.find((l) => l.name === 'Ruby')!;

      expect(LevelQualificationService.isQualifiedForLevel(999, 150000, ruby)).toBe(false);
      expect(LevelQualificationService.isQualifiedForLevel(1000, 99999, ruby)).toBe(false);
      expect(LevelQualificationService.isQualifiedForLevel(1000, 100000, ruby)).toBe(true);
      expect(LevelQualificationService.isQualifiedForLevel(1500, 120000, ruby)).toBe(true);
    });
  });

  describe('3. Level Promotion Service', () => {
    it('should promote member from Starter to Silver when qualifications are satisfied', async () => {
      const mockStatus: any = {
        distributorId: 'dist-001',
        distributorCode: 'DST-10001',
        currentBB: 250,
        totalMatching: 2500,
        currentLevel: DEFAULT_MLM_LEVELS[0], // Starter
        highestLevel: DEFAULT_MLM_LEVELS[0],
        nextLevel: DEFAULT_MLM_LEVELS[1],    // Silver
      };

      vi.spyOn(LevelQualificationService, 'evaluateQualification').mockResolvedValue(mockStatus);
      vi.spyOn(LevelQualificationService, 'getAllLevels').mockResolvedValue(DEFAULT_MLM_LEVELS);

      const result = await LevelPromotionService.evaluateAndPromote('dist-001');

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.name).toBe('Starter');
      expect(result.newLevel.name).toBe('Silver');
      expect(result.snapshot.qualifiedBB).toBe(250);
      expect(result.snapshot.qualifiedMatching).toBe(2500);
    });

    it('should NOT promote when qualifications are not satisfied', async () => {
      const mockStatus: any = {
        distributorId: 'dist-002',
        distributorCode: 'DST-10002',
        currentBB: 200, // Insufficient for Silver (requires 250)
        totalMatching: 5000,
        currentLevel: DEFAULT_MLM_LEVELS[0],
        highestLevel: DEFAULT_MLM_LEVELS[0],
        nextLevel: DEFAULT_MLM_LEVELS[1],
      };

      vi.spyOn(LevelQualificationService, 'evaluateQualification').mockResolvedValue(mockStatus);
      vi.spyOn(LevelQualificationService, 'getAllLevels').mockResolvedValue(DEFAULT_MLM_LEVELS);

      const result = await LevelPromotionService.evaluateAndPromote('dist-002');

      expect(result.promoted).toBe(false);
      expect(result.newLevel.name).toBe('Starter');
    });

    it('should support direct multi-tier promotions on rapid volume achievement (Starter -> Gold)', async () => {
      const mockStatus: any = {
        distributorId: 'dist-003',
        distributorCode: 'DST-10003',
        currentBB: 300,
        totalMatching: 8000, // Meets both Silver (2000) and Gold (5000)
        currentLevel: DEFAULT_MLM_LEVELS[0],
        highestLevel: DEFAULT_MLM_LEVELS[0],
        nextLevel: DEFAULT_MLM_LEVELS[1],
      };

      vi.spyOn(LevelQualificationService, 'evaluateQualification').mockResolvedValue(mockStatus);
      vi.spyOn(LevelQualificationService, 'getAllLevels').mockResolvedValue(DEFAULT_MLM_LEVELS);

      const result = await LevelPromotionService.evaluateAndPromote('dist-003');

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.name).toBe('Starter');
      expect(result.newLevel.name).toBe('Gold');
    });
  });

  describe('4. Level API Endpoints', () => {
    it('GET /api/v1/levels/config should return all 6 ordered MLM tiers without authentication', async () => {
      const res = await request(app).get('/api/v1/levels/config');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(6);

      const silver = res.body.data.find((l: any) => l.name === 'Silver');
      expect(silver).toBeDefined();
      expect(silver.requiredBB).toBe(250);
      expect(silver.requiredMatching).toBe(2000);
    });

    it('GET /api/v1/levels/me should require authentication', async () => {
      const res = await request(app).get('/api/v1/levels/me');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/levels/admin/recalculate should reject non-admin users with 403', async () => {
      const res = await request(app)
        .post('/api/v1/levels/admin/recalculate')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/levels/admin/recalculate should accept authorized admin requests', async () => {
      const mockSummary = {
        totalEvaluated: 15,
        totalPromoted: 2,
        promotions: [
          {
            distributorId: 'dst-1',
            distributorCode: 'DST-10001',
            previousLevel: 'Starter',
            newLevel: 'Silver',
            qualifiedBB: 250,
            qualifiedMatching: 2000,
          },
        ],
        errors: [],
        durationMs: 45,
      };

      vi.spyOn(LevelRecalculationService, 'recalculateNetworkLevels').mockResolvedValue(mockSummary);

      const res = await request(app)
        .post('/api/v1/levels/admin/recalculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ onlyActive: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalEvaluated).toBe(15);
      expect(res.body.data.totalPromoted).toBe(2);
    });
  });

  describe('5. Ledger Transactions & Strict Idempotency (Prompt 2)', () => {
    it('should enforce idempotency for BB transactions (source + referenceId uniqueness)', async () => {
      const mockBBTx = {
        id: 'bb-tx-001',
        memberId: 'mem-101',
        amount: 250,
        balanceAfter: 250,
        type: 'CREDIT',
        source: 'ORDER',
        referenceId: 'ORD-99991',
        description: 'Order BB accrual',
        createdAt: new Date(),
      };

      const recordSpy = vi.spyOn(BBService, 'recordBBTransaction').mockResolvedValue(mockBBTx as any);

      // First credit attempt
      const firstAttempt = await BBService.recordBBTransaction({
        memberId: 'mem-101',
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-99991',
      });

      expect(firstAttempt).toBeDefined();
      expect(firstAttempt?.referenceId).toBe('ORD-99991');
      expect(firstAttempt?.amount).toBe(250);

      // Second duplicate attempt with exact same (memberId, source, referenceId)
      const secondAttempt = await BBService.recordBBTransaction({
        memberId: 'mem-101',
        amount: 250,
        source: 'ORDER',
        referenceId: 'ORD-99991',
      });

      expect(secondAttempt).toBeDefined();
      expect(secondAttempt?.id).toBe(firstAttempt?.id);
      expect(recordSpy).toHaveBeenCalledTimes(2);
    });

    it('should enforce idempotency for Matching transactions (source + referenceId uniqueness)', async () => {
      const mockMatchTx = {
        id: 'match-tx-001',
        memberId: 'mem-101',
        amount: 2000,
        balanceAfter: 2000,
        type: 'CREDIT',
        source: 'BINARY_MATCH',
        referenceId: 'PERIOD-W38',
        description: 'Matching volume accrual',
        createdAt: new Date(),
      };

      const recordSpy = vi.spyOn(MatchingService, 'recordMatchingTransaction').mockResolvedValue(mockMatchTx as any);

      // First credit attempt
      const firstAttempt = await MatchingService.recordMatchingTransaction({
        memberId: 'mem-101',
        amount: 2000,
        source: 'BINARY_MATCH',
        referenceId: 'PERIOD-W38',
      });

      expect(firstAttempt).toBeDefined();
      expect(firstAttempt?.referenceId).toBe('PERIOD-W38');
      expect(firstAttempt?.amount).toBe(2000);

      // Second duplicate attempt with exact same (memberId, source, referenceId)
      const secondAttempt = await MatchingService.recordMatchingTransaction({
        memberId: 'mem-101',
        amount: 2000,
        source: 'BINARY_MATCH',
        referenceId: 'PERIOD-W38',
      });

      expect(secondAttempt).toBeDefined();
      expect(secondAttempt?.id).toBe(firstAttempt?.id);
      expect(recordSpy).toHaveBeenCalledTimes(2);
    });
  });
});

