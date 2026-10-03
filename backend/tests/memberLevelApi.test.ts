import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { LevelService } from '../src/services/level.service';
import { BBService } from '../src/services/bb.service';
import { MatchingService } from '../src/services/matching.service';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 7: MLM LEVEL AND VOLUME REST APIs (/api/members & /api/admin/members)', () => {
  const memberToken = createTestToken({
    id: 'usr-member-001',
    email: 'member@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const customerToken = createCustomerToken();
  const adminToken = createAdminToken();

  const mockMemberId = 'dist-mem-001';

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock for LevelService.getMemberLevel
    vi.spyOn(LevelService, 'getMemberLevel').mockResolvedValue({
      memberId: mockMemberId,
      distributorCode: 'KV-1001',
      displayName: 'Alice Sharma',
      currentBB: 250,
      currentMatching: 2000,
      currentLevel: {
        order: 1,
        code: 'SILVER',
        name: 'Silver',
        requiredBB: 250,
        requiredMatching: 2000,
        binaryWeeklyCap: 3000,
        description: 'Silver tier',
      },
      highestLevel: {
        order: 1,
        code: 'SILVER',
        name: 'Silver',
        requiredBB: 250,
        requiredMatching: 2000,
        binaryWeeklyCap: 3000,
        description: 'Silver tier',
      },
      nextLevel: {
        order: 2,
        code: 'GOLD',
        name: 'Gold',
        requiredBB: 250,
        requiredMatching: 5000,
        binaryWeeklyCap: 10000,
        description: 'Gold tier',
      },
      isMaxLevel: false,
      progress: {
        bbGap: 0,
        matchingGap: 3000,
        bbProgressPercentage: 100,
        matchingProgressPercentage: 40,
        isQualifiedForNext: false,
      },
      achievedAt: new Date('2026-09-01T10:00:00Z'),
    } as any);

    // Default mock for LevelService.getLevelHistory
    vi.spyOn(LevelService, 'getLevelHistory').mockResolvedValue({
      data: [
        {
          id: 'mlh-1',
          memberId: mockMemberId,
          previousLevel: 'Base',
          newLevel: 'Silver',
          previousOrder: 0,
          newOrder: 1,
          qualifyingBB: 250,
          qualifyingMatching: 2000,
          reason: 'BB & Matching qualification met',
          source: 'SYSTEM_AUTO',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as any);

    // Default mock for BBService.getBBBalance
    vi.spyOn(BBService, 'getBBBalance').mockResolvedValue({
      memberId: mockMemberId,
      distributorCode: 'KV-1001',
      currentBB: 250,
      lifetimeBB: 250,
      totalCredits: 250,
      totalDebits: 0,
      transactionCount: 2,
      lastTransactionAt: new Date('2026-09-01T10:00:00Z'),
    } as any);

    // Default mock for BBService.getBBHistory
    vi.spyOn(BBService, 'getBBHistory').mockResolvedValue({
      transactions: [
        {
          id: 'bb-tx-1',
          memberId: mockMemberId,
          amount: 250,
          balanceAfter: 250,
          type: 'CREDIT',
          source: 'ORDER',
          referenceId: 'ORD-999',
          description: 'Product order BB',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    } as any);

    // Default mock for MatchingService.calculateEligibleMatching
    vi.spyOn(MatchingService, 'calculateEligibleMatching').mockResolvedValue({
      memberId: mockMemberId,
      distributorCode: 'KV-1001',
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
      calculatedAt: new Date('2026-09-01T10:00:00Z'),
    } as any);

    // Default mock for MatchingService.getMatchingVolume
    vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(35000);

    // Default mock for MatchingService.getMatchingHistory
    vi.spyOn(MatchingService, 'getMatchingHistory').mockResolvedValue({
      data: [
        {
          id: 'mtx-1',
          memberId: mockMemberId,
          amount: 35000,
          type: 'MATCH_CYCLE',
          source: 'BINARY_MATCH',
          referenceId: 'MATCH-001',
          description: 'Matched 35000 BV on weak leg',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      currentBalance: 35000,
    } as any);

    // Default mock for recalculations
    vi.spyOn(LevelService, 'recalculateMemberLevel').mockResolvedValue({
      memberId: mockMemberId,
      distributorCode: 'KV-1001',
      auditedBB: 250,
      auditedMatching: 35000,
      previousLevel: { order: 1, code: 'SILVER', name: 'Silver' } as any,
      evaluatedEligibleLevel: { order: 1, code: 'SILVER', name: 'Silver' } as any,
      promoted: false,
      auditAt: new Date(),
    } as any);

    vi.spyOn(BBService, 'recalculateBBFromLedger').mockResolvedValue({
      memberId: mockMemberId,
      distributorCode: 'KV-1001',
      previousBB: 250,
      recalculatedBB: 250,
      discrepancy: 0,
      transactionCount: 2,
    } as any);

    vi.spyOn(MatchingService, 'recalculateMatching').mockResolvedValue({
      memberId: mockMemberId,
      distributorCode: 'KV-1001',
      previousMatching: 35000,
      recalculatedMatching: 35000,
      discrepancy: 0,
      leftVolume: 40000,
      rightVolume: 35000,
      updated: false,
      ruleApplied: 'MINIMUM_LEG',
      auditAt: new Date(),
    } as any);
  });

  // =========================================================================
  // 1. GET /api/members/:memberId/level
  // =========================================================================
  describe('GET /api/members/:memberId/level', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authorization token is missing or malformed');
    });

    it('should return member level details with required schema', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const data = res.body.data;
      expect(data.memberId).toBe(mockMemberId);
      expect(data.currentLevel).toBe('Silver');
      expect(data.bb).toBe(250);
      expect(data.matching).toBe(2000);
      expect(data.nextLevel).toBe('Gold');
      expect(data.nextLevelRequirements).toEqual({
        bb: 250,
        matching: 5000,
        requiredBB: 250,
        requiredMatching: 5000,
      });
      expect(data.progress).toBeDefined();
      expect(data.progress.bbGap).toBe(0);
      expect(data.progress.matchingGap).toBe(3000);
      expect(data.progress.bbProgressPercentage).toBe(100);
      expect(data.progress.matchingProgressPercentage).toBe(40);
    });

    it('should also work on /api/v1/members/:memberId/level alias', async () => {
      const res = await request(app)
        .get(`/api/v1/members/${mockMemberId}/level`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.currentLevel).toBe('Silver');
    });
  });

  // =========================================================================
  // 2. GET /api/members/:memberId/level/progress
  // =========================================================================
  describe('GET /api/members/:memberId/level/progress', () => {
    it('should reject unauthenticated request with 401', async () => {
      await request(app)
        .get(`/api/members/${mockMemberId}/level/progress`)
        .expect(401);
    });

    it('should return full progress metrics toward next level', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level/progress`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.currentLevel).toEqual({ name: 'Silver', code: 'SILVER' });
      expect(data.currentBB).toBe(250);
      expect(data.nextLevel).toEqual({
        name: 'Gold',
        requiredBB: 250,
        requiredLeftMatching: 5000,
        requiredRightMatching: 5000,
      });
      expect(data.progress.bb.current).toBe(250);
      expect(data.progress.bb.required).toBe(250);
      expect(data.progress.bb.remaining).toBe(0);
      expect(data.progress.bb.percentage).toBe(100);
      expect(data.progress.leftMatching.remaining).toBe(3000);
      expect(data.progress.rightMatching.remaining).toBe(3000);
      expect(data.qualifiedForNextLevel).toBe(false);
    });
  });

  // =========================================================================
  // 3. GET /api/members/:memberId/level/history
  // =========================================================================
  describe('GET /api/members/:memberId/level/history', () => {
    it('should reject unauthenticated request with 401', async () => {
      await request(app)
        .get(`/api/members/${mockMemberId}/level/history`)
        .expect(401);
    });

    it('should return chronological promotion history with pagination', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level/history`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].previousLevel).toBe('Base');
      expect(res.body.data[0].newLevel).toBe('Silver');
      expect(res.body.data[0].qualifyingBB).toBe(250);
      expect(res.body.data[0].qualifyingMatching).toBe(2000);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
    });
  });

  // =========================================================================
  // 4. GET /api/members/:memberId/bb & GET /api/members/:memberId/bb/history
  // =========================================================================
  describe('GET /api/members/:memberId/bb endpoints', () => {
    it('should return BB balance and stats', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/bb`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.currentBB).toBe(250);
      expect(res.body.data.lifetimeBB).toBe(250);
      expect(res.body.data.transactionCount).toBe(2);
    });

    it('should return BB transaction ledger history', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/bb/history?page=1&limit=10`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].amount).toBe(250);
      expect(res.body.data[0].source).toBe('ORDER');
      expect(res.body.meta.total).toBe(1);
    });
  });

  // =========================================================================
  // 5. GET /api/members/:memberId/matching & GET /api/members/:memberId/matching/history
  // =========================================================================
  describe('GET /api/members/:memberId/matching endpoints', () => {
    it('should return matching metrics including left/right leg volumes', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/matching`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.leftVolume).toBe(40000);
      expect(res.body.data.rightVolume).toBe(35000);
      expect(res.body.data.matching).toBe(35000);
      expect(res.body.data.strongLeg).toBe('LEFT');
      expect(res.body.data.weakLeg).toBe('RIGHT');
      expect(res.body.data.carryForwardLeft).toBe(5000);
    });

    it('should return matching transaction history', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/matching/history`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].amount).toBe(35000);
      expect(res.body.data[0].source).toBe('BINARY_MATCH');
    });
  });

  // =========================================================================
  // 6. ADMIN RECALCULATION ENDPOINTS (RBAC & SECURITY GUARDS)
  // =========================================================================
  describe('ADMIN RECALCULATION ENDPOINTS: RBAC & ZERO-TRUST VOLUME GUARDS', () => {
    it('should reject unauthenticated recalculation requests with 401', async () => {
      await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .expect(401);

      await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-bb`)
        .expect(401);

      await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-matching`)
        .expect(401);
    });

    it('should reject DISTRIBUTOR role access to admin endpoints with 403 Forbidden', async () => {
      const res1 = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
      expect(res1.body.message).toContain('Forbidden');

      const res2 = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-bb`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
      expect(res2.body.message).toContain('Forbidden');

      const res3 = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-matching`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
      expect(res3.body.message).toContain('Forbidden');
    });

    it('should reject CUSTOMER role access to admin endpoints with 403 Forbidden', async () => {
      await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('should allow ADMIN role to trigger level recalculation', async () => {
      const res = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Annual system audit' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Member level recalculation completed');
      expect(LevelService.recalculateMemberLevel).toHaveBeenCalledWith(
        mockMemberId,
        expect.objectContaining({
          reason: 'Annual system audit',
        })
      );
    });

    it('should allow ADMIN role to trigger BB recalculation', async () => {
      const res = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-bb`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(BBService.recalculateBBFromLedger).toHaveBeenCalledWith(mockMemberId);
    });

    it('should allow ADMIN role to trigger matching recalculation', async () => {
      const res = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-matching`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ forceUpdate: true })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(MatchingService.recalculateMatching).toHaveBeenCalledWith(
        mockMemberId,
        expect.objectContaining({ forceUpdate: true })
      );
    });

    it('SECURITY: should REJECT arbitrary client-supplied BB or matching amounts with 400 Bad Request', async () => {
      // Attacker attempts to inject unauthorized volume directly into recalculate body
      const res1 = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-level`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bb: 50000, // Unauthorized volume injection
          matching: 1000000,
        })
        .expect(400);

      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post(`/api/admin/members/${mockMemberId}/recalculate-bb`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newBB: 99999, // Unauthorized injection
        })
        .expect(400);

      expect(res2.body.success).toBe(false);
    });
  });
});
