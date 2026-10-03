import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { LevelService, CANONICAL_LEVELS } from '../src/services/level.service';
import { LevelQualificationService, DEFAULT_MLM_LEVELS } from '../src/services/level/levelQualification.service';
import { LevelPromotionService } from '../src/services/level/levelPromotion.service';
import { BinaryVolumeService } from '../src/services/binaryVolume.service';
import { BBService } from '../src/services/bb.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 5: FINAL MLM RANK REQUIREMENTS (3 INDEPENDENT CRITERIA)', () => {
  const memberToken = createTestToken({
    id: 'usr-member-p5-001',
    email: 'member.p5@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const adminToken = createAdminToken();
  const mockMemberId = 'dist-p5-001';

  const createMockDistributor = (overrides?: any) => ({
    id: mockMemberId,
    distributorCode: 'KV-P5-001',
    distributorId: 'KV-P5-001',
    currentBB: 0,
    currentMatching: 0,
    currentLevelId: null,
    currentRankId: null,
    currentLevel: null,
    currentRank: null,
    highestRank: null,
    user: { firstName: 'Prompt5', lastName: 'Distributor' },
    businessCenters: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async ({ where }: any) => {
      const id = where?.id || where?.OR?.[0]?.id || mockMemberId;
      return createMockDistributor({ id }) as any;
    });

    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async ({ where }: any) => {
      const id = where?.id || mockMemberId;
      return createMockDistributor({ id }) as any;
    });

    vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.distributorProfile, 'count').mockResolvedValue(5);
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);

    vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).level, 'upsert').mockImplementation(async ({ create }: any) => ({
      id: `lvl-${create.code}`,
      ...create,
    }));
    vi.spyOn((prisma as any).level, 'create').mockImplementation(async ({ data }: any) => ({
      id: `lvl-${data.code}`,
      ...data,
    }));
    vi.spyOn((prisma as any).level, 'update').mockImplementation(async ({ data }: any) => ({
      id: 'lvl-updated',
      ...data,
    }));

    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).memberLevelHistory, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'mlh-p5-001',
      ...data,
      createdAt: new Date(),
    }));

    vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.rank, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.rank, 'create').mockImplementation(async ({ data }: any) => ({
      id: `rnk-${data.rankCode}`,
      ...data,
    }));
  });

  // =========================================================================
  // 1. EXACT FIVE FINAL LEVELS THRESHOLDS VERIFICATION
  // =========================================================================
  describe('1. Exact Final MLM Rank Thresholds', () => {
    it('should have exact canonical thresholds for SILVER, GOLD, PLATINUM, DIAMOND, RUBY', () => {
      const silver = CANONICAL_LEVELS.find((l) => l.code === 'SILVER');
      const gold = CANONICAL_LEVELS.find((l) => l.code === 'GOLD');
      const platinum = CANONICAL_LEVELS.find((l) => l.code === 'PLATINUM');
      const diamond = CANONICAL_LEVELS.find((l) => l.code === 'DIAMOND');
      const ruby = CANONICAL_LEVELS.find((l) => l.code === 'RUBY');

      expect(silver).toBeDefined();
      expect(silver?.requiredBB).toBe(250);
      expect(silver?.requiredLeftMatching).toBe(2000);
      expect(silver?.requiredRightMatching).toBe(2000);

      expect(gold).toBeDefined();
      expect(gold?.requiredBB).toBe(250);
      expect(gold?.requiredLeftMatching).toBe(5000);
      expect(gold?.requiredRightMatching).toBe(5000);

      expect(platinum).toBeDefined();
      expect(platinum?.requiredBB).toBe(500);
      expect(platinum?.requiredLeftMatching).toBe(50000);
      expect(platinum?.requiredRightMatching).toBe(50000);

      expect(diamond).toBeDefined();
      expect(diamond?.requiredBB).toBe(1000);
      expect(diamond?.requiredLeftMatching).toBe(60000);
      expect(diamond?.requiredRightMatching).toBe(60000);

      expect(ruby).toBeDefined();
      expect(ruby?.requiredBB).toBe(1000);
      expect(ruby?.requiredLeftMatching).toBe(100000);
      expect(ruby?.requiredRightMatching).toBe(100000);
    });

    it('should have default MLM levels matching the same exact requirements', () => {
      const silver = DEFAULT_MLM_LEVELS.find((l) => l.code === 'RANK_SILVER' || l.name === 'Silver');
      const gold = DEFAULT_MLM_LEVELS.find((l) => l.code === 'RANK_GOLD' || l.name === 'Gold');
      const platinum = DEFAULT_MLM_LEVELS.find((l) => l.code === 'RANK_PLATINUM' || l.name === 'Platinum');
      const diamond = DEFAULT_MLM_LEVELS.find((l) => l.code === 'RANK_DIAMOND' || l.name === 'Diamond');
      const ruby = DEFAULT_MLM_LEVELS.find((l) => l.code === 'RANK_RUBY' || l.name === 'Ruby');

      expect(silver?.requiredBB).toBe(250);
      expect(silver?.requiredLeftMatching).toBe(2000);
      expect(silver?.requiredRightMatching).toBe(2000);

      expect(gold?.requiredBB).toBe(250);
      expect(gold?.requiredLeftMatching).toBe(5000);
      expect(gold?.requiredRightMatching).toBe(5000);

      expect(platinum?.requiredBB).toBe(500);
      expect(platinum?.requiredLeftMatching).toBe(50000);
      expect(platinum?.requiredRightMatching).toBe(50000);

      expect(diamond?.requiredBB).toBe(1000);
      expect(diamond?.requiredLeftMatching).toBe(60000);
      expect(diamond?.requiredRightMatching).toBe(60000);

      expect(ruby?.requiredBB).toBe(1000);
      expect(ruby?.requiredLeftMatching).toBe(100000);
      expect(ruby?.requiredRightMatching).toBe(100000);
    });
  });

  // =========================================================================
  // 2. INDEPENDENT LEG REQUIREMENT ENFORCEMENT (NO COMBINING LEGS)
  // =========================================================================
  describe('2. Independent Leg Requirements & Disqualification', () => {
    const silverLevel = CANONICAL_LEVELS.find((l) => l.code === 'SILVER')!;
    const goldLevel = CANONICAL_LEVELS.find((l) => l.code === 'GOLD')!;
    const rubyLevel = CANONICAL_LEVELS.find((l) => l.code === 'RUBY')!;

    it('should NOT qualify for Silver if only left matching meets threshold (right matching = 0)', () => {
      // BB = 250, Left = 2000, Right = 0
      const qualified = LevelQualificationService.isQualifiedForLevel(250, 2000, 0, silverLevel);
      expect(qualified).toBe(false);
    });

    it('should NOT qualify for Silver if only right matching meets threshold (left matching = 0)', () => {
      // BB = 250, Left = 0, Right = 2000
      const qualified = LevelQualificationService.isQualifiedForLevel(250, 0, 2000, silverLevel);
      expect(qualified).toBe(false);
    });

    it('should NOT qualify if total combined volume is 4000 but legs are unbalanced (e.g. Left = 3500, Right = 500)', () => {
      // DO NOT use single total matching: 3500 + 500 = 4000 >= 2000, but Right is only 500 < 2000!
      const qualified = LevelQualificationService.isQualifiedForLevel(250, 3500, 500, silverLevel);
      expect(qualified).toBe(false);
    });

    it('should NOT qualify for Silver if matching conditions are met but BB is insufficient', () => {
      // BB = 249, Left = 2000, Right = 2000
      const qualified = LevelQualificationService.isQualifiedForLevel(249, 2000, 2000, silverLevel);
      expect(qualified).toBe(false);
    });

    it('should qualify for Silver when ALL THREE independent requirements are satisfied', () => {
      // BB = 250, Left = 2000, Right = 2000
      const qualified = LevelQualificationService.isQualifiedForLevel(250, 2000, 2000, silverLevel);
      expect(qualified).toBe(true);
    });

    it('should strictly limit member with Ruby-level Left leg to Gold if Right leg only satisfies Gold', () => {
      // BB = 1000, Left = 100000 (Ruby), Right = 5000 (Gold)
      const qualifiesRuby = LevelQualificationService.isQualifiedForLevel(1000, 100000, 5000, rubyLevel);
      expect(qualifiesRuby).toBe(false);

      const qualifiesGold = LevelQualificationService.isQualifiedForLevel(1000, 100000, 5000, goldLevel);
      expect(qualifiesGold).toBe(true);
    });
  });

  // =========================================================================
  // 3. LEVEL SERVICE HIGHEST-TO-LOWEST EVALUATION & PROMOTION
  // =========================================================================
  describe('3. LevelService Highest-to-Lowest Evaluation & Promotion', () => {
    it('should evaluate member with BB=1000, Left=100000, Right=100000 directly as RUBY', async () => {
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(100000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(100000);

      const result = await LevelService.calculateEligibleLevel(mockMemberId);

      expect(result.eligibleLevel.code).toBe('RUBY');
      expect(result.currentBB).toBe(1000);
      expect(result.currentLeftMatching).toBe(100000);
      expect(result.currentRightMatching).toBe(100000);
      expect(result.isPromotionAvailable).toBe(true);
    });

    it('should evaluate member with BB=1000, Left=100000, Right=60000 as DIAMOND (limited by right leg)', async () => {
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(1000);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(100000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(60000);

      const result = await LevelService.calculateEligibleLevel(mockMemberId);

      expect(result.eligibleLevel.code).toBe('DIAMOND');
    });

    it('should evaluate member with BB=500, Left=50000, Right=50000 as PLATINUM', async () => {
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(500);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(50000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(50000);

      const result = await LevelService.calculateEligibleLevel(mockMemberId);

      expect(result.eligibleLevel.code).toBe('PLATINUM');
    });

    it('should evaluate member with BB=250, Left=5000, Right=5000 as GOLD', async () => {
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(250);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(5000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(5000);

      const result = await LevelService.calculateEligibleLevel(mockMemberId);

      expect(result.eligibleLevel.code).toBe('GOLD');
    });

    it('should promote member and record independent left and right matching in snapshot', async () => {
      const promoResult = await LevelService.promoteMember(mockMemberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
        source: 'TEST_AUTO',
      });

      expect(promoResult.promoted).toBe(true);
      expect(promoResult.newLevel.code).toBe('SILVER');
      expect(promoResult.snapshot.qualifiedBB).toBe(250);
      expect(promoResult.snapshot.qualifiedLeftMatching).toBe(2000);
      expect(promoResult.snapshot.qualifiedRightMatching).toBe(2000);
    });

    it('should audit BB, Left Matching, and Right Matching upon member recalculation', async () => {
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(500);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(50000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(50000);

      const audit = await LevelService.recalculateMemberLevel(mockMemberId);

      expect(audit.auditedBB).toBe(500);
      expect(audit.auditedLeftMatching).toBe(50000);
      expect(audit.auditedRightMatching).toBe(50000);
      expect(audit.evaluatedEligibleLevel.code).toBe('PLATINUM');
    });
  });

  // =========================================================================
  // 4. DYNAMIC DATABASE CONFIGURABILITY (NO HARDCODING)
  // =========================================================================
  describe('4. Dynamic Database Level Configuration', () => {
    it('should load custom level thresholds from database if present', async () => {
      const mockDbLevels = [
        {
          id: 'lvl-silver-db',
          name: 'Silver Custom',
          code: 'SILVER',
          order: 1,
          requiredBB: '300.00',
          requiredLeftMatching: '2500.00',
          requiredRightMatching: '2500.00',
          requiredMatching: '2500.00',
          isActive: true,
        },
      ];

      vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue(mockDbLevels);

      const levels = await LevelService.getAllLevels();
      const silver = levels.find((l) => l.code === 'SILVER');

      expect(silver).toBeDefined();
      expect(silver?.requiredBB).toBe(300);
      expect(silver?.requiredLeftMatching).toBe(2500);
      expect(silver?.requiredRightMatching).toBe(2500);
    });

    it('should allow dynamic update of level thresholds in database via LevelService.updateLevel', async () => {
      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue({
        id: 'lvl-gold-db',
        code: 'GOLD',
        name: 'Gold',
        order: 2,
        requiredBB: 250,
        requiredLeftMatching: 5000,
        requiredRightMatching: 5000,
      });

      vi.spyOn((prisma as any).level, 'update').mockResolvedValue({
        id: 'lvl-gold-db',
        code: 'GOLD',
        name: 'Gold Executive',
        order: 2,
        requiredBB: 300,
        requiredLeftMatching: 6000,
        requiredRightMatching: 6000,
        requiredMatching: 6000,
        isActive: true,
      });

      const updated = await LevelService.updateLevel('GOLD', {
        name: 'Gold Executive',
        requiredBB: 300,
        requiredLeftMatching: 6000,
        requiredRightMatching: 6000,
      });

      expect(updated.name).toBe('Gold Executive');
      expect(updated.requiredBB).toBe(300);
      expect(updated.requiredLeftMatching).toBe(6000);
      expect(updated.requiredRightMatching).toBe(6000);
    });
  });

  // =========================================================================
  // 5. REST API ENDPOINTS & ZERO-HARDCODING CONTROLLER CHECKS
  // =========================================================================
  describe('5. REST API Endpoints & Zero-Hardcoding', () => {
    it('GET /api/v1/levels/config should return 3 independent requirements for all tiers', async () => {
      const res = await request(app).get('/api/v1/levels/config');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const silver = res.body.data.find((l: any) => l.name === 'Silver' || l.code === 'RANK_SILVER' || l.code === 'SILVER');
      expect(silver).toBeDefined();
      expect(silver.requiredBB).toBe(250);
      expect(silver.requiredLeftMatching).toBe(2000);
      expect(silver.requiredRightMatching).toBe(2000);
    });

    it('GET /api/v1/levels/me should report independent leftMatching and rightMatching gaps', async () => {
      vi.spyOn(BBService, 'calculateCurrentBB').mockResolvedValue(100);
      vi.spyOn(BinaryVolumeService, 'getLeftMatching').mockResolvedValue(1000);
      vi.spyOn(BinaryVolumeService, 'getRightMatching').mockResolvedValue(500);
      vi.spyOn(BinaryVolumeService, 'getLeftVolume').mockResolvedValue(1500);
      vi.spyOn(BinaryVolumeService, 'getRightVolume').mockResolvedValue(800);

      const res = await request(app)
        .get('/api/v1/levels/me')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.currentBB).toBe(100);
      expect(data.leftMatching).toBe(1000);
      expect(data.rightMatching).toBe(500);
      expect(data.progress.leftMatchingGap).toBe(1000); // 2000 - 1000
      expect(data.progress.rightMatchingGap).toBe(1500); // 2000 - 500
      expect(data.progress.bbGap).toBe(150); // 250 - 100
      expect(data.progress.isQualifiedForNext).toBe(false);
    });

    it('PUT /api/v1/levels/admin/config/:idOrCode should allow admin to update database requirements', async () => {
      vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue({
        id: 'lvl-silver-id',
        code: 'SILVER',
        name: 'Silver',
        order: 1,
      });

      vi.spyOn((prisma as any).level, 'update').mockResolvedValue({
        id: 'lvl-silver-id',
        code: 'SILVER',
        name: 'Silver Premier',
        order: 1,
        requiredBB: 280,
        requiredLeftMatching: 2200,
        requiredRightMatching: 2200,
        requiredMatching: 2200,
        isActive: true,
      });

      const res = await request(app)
        .put('/api/v1/levels/admin/config/SILVER')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Silver Premier',
          requiredBB: 280,
          requiredLeftMatching: 2200,
          requiredRightMatching: 2200,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Silver Premier');
      expect(res.body.data.requiredBB).toBe(280);
      expect(res.body.data.requiredLeftMatching).toBe(2200);
      expect(res.body.data.requiredRightMatching).toBe(2200);
    });
  });
});
