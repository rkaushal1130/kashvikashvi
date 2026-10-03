import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { LevelService } from '../src/services/level.service';
import { BinaryVolumeService } from '../src/services/binaryVolume.service';
import { createTestToken } from './helpers/testHelpers';

/**
 * ============================================================================
 * PROMPT 9: IMMUTABLE RANK PROMOTION HISTORY TEST SUITE
 * ============================================================================
 * Verifies:
 * 1. Automatic promotion creates exactly one immutable history record.
 * 2. STARTER -> SILVER record matches exact Prompt 9 format:
 *    - memberId
 *    - previousLevel: "STARTER"
 *    - newLevel: "SILVER"
 *    - qualifyingBB: 250
 *    - qualifyingLeftMatching: 2000
 *    - qualifyingRightMatching: 2000
 *    - reason: "LEVEL_REQUIREMENTS_MET"
 *    - source: "SYSTEM"
 *    - createdAt
 * 3. Next promotion SILVER -> GOLD records:
 *    - previousLevel: "SILVER"
 *    - newLevel: "GOLD"
 *    - qualifyingBB: 300
 *    - qualifyingLeftMatching: 5000
 *    - qualifyingRightMatching: 5000
 * 4. Duplicate prevention: If the same event is processed twice:
 *    - Only one promotion happens.
 *    - Only one history record is created.
 * 5. Database constraint @@unique([memberId, newLevelId]) guarantees idempotency under race conditions.
 * 6. Immutability guard: Modifying (POST/PUT/PATCH) or deleting (DELETE) history records via API is strictly 403 Forbidden.
 * 7. Querying history via API and service returns correct chronological audit trail.
 */
describe('PROMPT 9: COMPLETE RANK PROMOTION HISTORY', () => {
  const adminToken = createTestToken({
    id: 'usr-admin-001',
    email: 'admin@kashvimlm.com',
    role: 'ADMIN',
  });

  const memberToken = createTestToken({
    id: 'usr-member-001',
    email: 'distributor@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const memberId = 'dist-prompt9-001';

  let mockHistoryStore: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    BinaryVolumeService.resetMockStore();
    mockHistoryStore = [];

    // Mock interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock levels lookup
    vi.spyOn((prisma as any).level, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where?.code === 'SILVER' || where?.id === 'lvl-SILVER') {
        return {
          id: 'lvl-SILVER',
          code: 'SILVER',
          name: 'Silver',
          order: 1,
          requiredBB: 250,
          requiredLeftMatching: 2000,
          requiredRightMatching: 2000,
          requiredMatching: 2000,
          isActive: true,
        };
      }
      if (where?.code === 'GOLD' || where?.id === 'lvl-GOLD') {
        return {
          id: 'lvl-GOLD',
          code: 'GOLD',
          name: 'Gold',
          order: 2,
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
          requiredMatching: 5000,
          isActive: true,
        };
      }
      if (where?.code === 'RUBY' || where?.id === 'lvl-RUBY') {
        return {
          id: 'lvl-RUBY',
          code: 'RUBY',
          name: 'Ruby',
          order: 5,
          requiredBB: 1000,
          requiredLeftMatching: 100000,
          requiredRightMatching: 100000,
          requiredMatching: 100000,
          isActive: true,
        };
      }
      return null;
    });

    vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue([
      { id: 'lvl-SILVER', code: 'SILVER', name: 'Silver', order: 1, requiredBB: 250, requiredLeftMatching: 2000, requiredRightMatching: 2000, isActive: true },
      { id: 'lvl-GOLD', code: 'GOLD', name: 'Gold', order: 2, requiredBB: 250, requiredLeftMatching: 5000, requiredRightMatching: 5000, isActive: true },
      { id: 'lvl-PLATINUM', code: 'PLATINUM', name: 'Platinum', order: 3, requiredBB: 500, requiredLeftMatching: 50000, requiredRightMatching: 50000, isActive: true },
      { id: 'lvl-DIAMOND', code: 'DIAMOND', name: 'Diamond', order: 4, requiredBB: 1000, requiredLeftMatching: 60000, requiredRightMatching: 60000, isActive: true },
      { id: 'lvl-RUBY', code: 'RUBY', name: 'Ruby', order: 5, requiredBB: 1000, requiredLeftMatching: 100000, requiredRightMatching: 100000, isActive: true },
    ]);

    vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue({ id: 'rnk-001', rankCode: 'RANK_SILVER', name: 'Silver', level: 1 } as any);
    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue({ id: memberId, userId: 'usr-member-001' } as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);

    // Mock memberLevelHistory create & find
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => {
      // Check unique constraint @@unique([memberId, newLevelId])
      const existing = mockHistoryStore.find(
        (h) => h.memberId === data.memberId && h.newLevelId === data.newLevelId
      );
      if (existing) {
        const error: any = new Error('Unique constraint failed on the fields: (`memberId`,`newLevelId`)');
        error.code = 'P2002';
        throw error;
      }
      const record = {
        id: `hist-${mockHistoryStore.length + 1}`,
        ...data,
        createdAt: data.createdAt || new Date(),
      };
      mockHistoryStore.push(record);
      return record;
    });

    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockImplementation(async ({ where }: any) => {
      return (
        mockHistoryStore.find((h) => {
          if (h.memberId !== where?.memberId) return false;
          if (where?.newLevelId && h.newLevelId === where.newLevelId) return true;
          if (where?.newLevelCode && h.newLevelCode === where.newLevelCode) return true;
          if (where?.OR) {
            return where.OR.some((cond: any) => {
              if (cond.newLevelId && h.newLevelId === cond.newLevelId) return true;
              if (cond.newLevelCode && h.newLevelCode === cond.newLevelCode) return true;
              if (cond.newLevel?.code && h.newLevelCode === cond.newLevel.code) return true;
              return false;
            });
          }
          return false;
        }) || null
      );
    });

    vi.spyOn((prisma as any).memberLevelHistory, 'findMany').mockImplementation(async ({ where }: any) => {
      return mockHistoryStore.filter((h) => !where?.memberId || h.memberId === where.memberId);
    });

    vi.spyOn((prisma as any).memberLevelHistory, 'count').mockImplementation(async ({ where }: any) => {
      return mockHistoryStore.filter((h) => !where?.memberId || h.memberId === where.memberId).length;
    });
  });

  // =========================================================================
  // 1. PROMPT 9 SPECIFICATION: STARTER -> SILVER PROMOTION RECORD
  // =========================================================================
  describe('1. Prompt 9 Example 1: STARTER -> SILVER Automatic Promotion', () => {
    it('creates exactly one immutable history record with exact required fields for STARTER -> SILVER', async () => {
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 250,
        currentMatching: 2000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        user: { firstName: 'Alice', lastName: 'Distributor' },
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 250,
        leftMatching: 2000,
        rightMatching: 2000,
      });

      const result = await LevelService.promoteMember(memberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
        source: 'SYSTEM',
        reason: 'LEVEL_REQUIREMENTS_MET',
      });

      expect(result.promoted).toBe(true);
      expect(result.newLevel.code).toBe('SILVER');
      expect(result.historyRecord).toBeDefined();

      // Check fields of the created history record
      expect(result.historyRecord.memberId).toBe(memberId);
      expect(result.historyRecord.previousLevel).toBe('STARTER');
      expect(result.historyRecord.newLevel).toBe('SILVER');
      expect(Number(result.historyRecord.qualifyingBB)).toBe(250);
      expect(Number(result.historyRecord.qualifyingLeftMatching)).toBe(2000);
      expect(Number(result.historyRecord.qualifyingRightMatching)).toBe(2000);
      expect(result.historyRecord.reason).toBe('LEVEL_REQUIREMENTS_MET');
      expect(result.historyRecord.source).toBe('SYSTEM');
      expect(result.historyRecord.createdAt).toBeInstanceOf(Date);

      // Verify exactly one record in the history store
      expect(mockHistoryStore).toHaveLength(1);
    });
  });

  // =========================================================================
  // 2. PROMPT 9 SPECIFICATION: SILVER -> GOLD PROMOTION RECORD
  // =========================================================================
  describe('2. Prompt 9 Example 2: SILVER -> GOLD Automatic Promotion', () => {
    it('creates second history record with previousLevel=SILVER, newLevel=GOLD', async () => {
      // First, simulate existing Silver rank history
      mockHistoryStore.push({
        id: 'hist-1',
        memberId,
        previousLevelId: null,
        newLevelId: 'lvl-SILVER',
        previousLevelCode: 'STARTER',
        newLevelCode: 'SILVER',
        previousLevel: 'STARTER',
        newLevel: 'SILVER',
        qualifyingBB: 250,
        qualifyingLeftMatching: 2000,
        qualifyingRightMatching: 2000,
        qualifyingMatching: 2000,
        reason: 'LEVEL_REQUIREMENTS_MET',
        source: 'SYSTEM',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      });

      // Member is currently Silver, achieves BB = 300, Left = 5000, Right = 5000
      const mockSilverMember = {
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 300,
        currentMatching: 5000,
        currentLevelId: 'lvl-SILVER',
        currentLevel: {
          id: 'lvl-SILVER',
          code: 'SILVER',
          name: 'Silver',
          order: 1,
        },
        currentRankId: 'rnk-001',
        user: { firstName: 'Alice', lastName: 'Distributor' },
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockSilverMember as any);
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 300,
        leftMatching: 5000,
        rightMatching: 5000,
        currentLevel: {
          id: 'lvl-SILVER',
          code: 'SILVER',
          name: 'Silver',
          order: 1,
        },
      });

      const result = await LevelService.promoteMember(memberId, {
        overrideBB: 300,
        overrideLeftMatching: 5000,
        overrideRightMatching: 5000,
        source: 'SYSTEM',
        reason: 'LEVEL_REQUIREMENTS_MET',
      });

      expect(result.promoted).toBe(true);
      expect(result.previousLevel.code).toBe('SILVER');
      expect(result.newLevel.code).toBe('GOLD');

      // Check fields of second history record
      expect(result.historyRecord.memberId).toBe(memberId);
      expect(result.historyRecord.previousLevel).toBe('SILVER');
      expect(result.historyRecord.newLevel).toBe('GOLD');
      expect(Number(result.historyRecord.qualifyingBB)).toBe(300);
      expect(Number(result.historyRecord.qualifyingLeftMatching)).toBe(5000);
      expect(Number(result.historyRecord.qualifyingRightMatching)).toBe(5000);
      expect(result.historyRecord.reason).toBe('LEVEL_REQUIREMENTS_MET');
      expect(result.historyRecord.source).toBe('SYSTEM');

      // Total records should now be 2
      expect(mockHistoryStore).toHaveLength(2);
      expect(mockHistoryStore[0].newLevelCode).toBe('SILVER');
      expect(mockHistoryStore[1].newLevelCode).toBe('GOLD');
    });
  });

  // =========================================================================
  // 3. DUPLICATE PREVENTION & IDEMPOTENCY
  // =========================================================================
  describe('3. Duplicate Prevention & Idempotency', () => {
    it('only promotes once and creates only one history record when the same event is processed twice', async () => {
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 250,
        currentMatching: 2000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        user: { firstName: 'Alice', lastName: 'Distributor' },
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 250,
        leftMatching: 2000,
        rightMatching: 2000,
      });

      // First run: Promotes to Silver, creates history record
      const firstResult = await LevelService.promoteMember(memberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
      });

      expect(firstResult.promoted).toBe(true);
      expect(firstResult.newLevel.code).toBe('SILVER');
      expect(mockHistoryStore).toHaveLength(1);

      // Update mock member state to reflect silver promotion in database
      const silverMember = {
        ...mockMember,
        currentLevelId: 'lvl-SILVER',
        currentLevel: {
          id: 'lvl-SILVER',
          code: 'SILVER',
          name: 'Silver',
          order: 1,
        },
      };
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(silverMember as any);

      // Second run with the same volume event:
      const secondResult = await LevelService.promoteMember(memberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
      });

      // No second promotion
      expect(secondResult.promoted).toBe(false);
      // History store remains exactly 1 record!
      expect(mockHistoryStore).toHaveLength(1);
    });

    it('gracefully catches P2002 unique constraint violation and returns existing record without error', async () => {
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 250,
        currentMatching: 2000,
        currentLevelId: null,
        currentRankId: null,
        currentLevel: null,
        currentRank: null,
        user: { firstName: 'Alice', lastName: 'Distributor' },
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 250,
        leftMatching: 2000,
        rightMatching: 2000,
      });

      const existingRecord = {
        id: 'hist-existing-1',
        memberId,
        newLevelId: 'lvl-SILVER',
        previousLevelCode: 'STARTER',
        newLevelCode: 'SILVER',
        qualifyingBB: 250,
        qualifyingLeftMatching: 2000,
        qualifyingRightMatching: 2000,
        reason: 'LEVEL_REQUIREMENTS_MET',
        source: 'SYSTEM',
        createdAt: new Date(),
      };

      // In a concurrent race condition, step 3 findFirst returns null, then create throws P2002,
      // and the catch block calls findFirst which returns existingRecord.
      const findFirstSpy = vi.spyOn((prisma as any).memberLevelHistory, 'findFirst');
      findFirstSpy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingRecord);

      vi.spyOn((prisma as any).memberLevelHistory, 'create').mockRejectedValueOnce({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`memberId`,`newLevelId`)',
      });

      // promoteMember should catch P2002, retrieve existingRecord, and return without crashing
      const result = await LevelService.promoteMember(memberId, {
        overrideBB: 250,
        overrideLeftMatching: 2000,
        overrideRightMatching: 2000,
      });

      expect(result.promoted).toBe(true);
      expect(result.historyRecord).toBeDefined();
      expect(result.historyRecord.id).toBe('hist-existing-1');
    });
  });

  // =========================================================================
  // 4. DIRECT HIGH RANK PROMOTION RECORD (e.g. STARTER -> RUBY)
  // =========================================================================
  describe('4. Direct High Rank Promotion (STARTER -> RUBY)', () => {
    it('creates single history record directly for RUBY without intermediate records', async () => {
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 1500,
        currentMatching: 150000,
        currentLevelId: null,
        currentLevel: null,
        user: { firstName: 'Alice', lastName: 'Distributor' },
      };

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);
      BinaryVolumeService.setMockDistributor({
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 1500,
        leftMatching: 150000,
        rightMatching: 150000,
      });

      const result = await LevelService.promoteMember(memberId, {
        overrideBB: 1500,
        overrideLeftMatching: 150000,
        overrideRightMatching: 150000,
      });

      expect(result.promoted).toBe(true);
      expect(result.newLevel.code).toBe('RUBY');

      // Directly qualified for Ruby with single history record
      expect(mockHistoryStore).toHaveLength(1);
      const rubyRecord = mockHistoryStore[0];
      expect(rubyRecord.previousLevelCode).toBe('STARTER');
      expect(rubyRecord.newLevelCode).toBe('RUBY');
      expect(Number(rubyRecord.qualifyingBB)).toBe(1500);
      expect(Number(rubyRecord.qualifyingLeftMatching)).toBe(150000);
      expect(Number(rubyRecord.qualifyingRightMatching)).toBe(150000);
      expect(rubyRecord.reason).toBe('LEVEL_REQUIREMENTS_MET');
      expect(rubyRecord.source).toBe('SYSTEM');
    });
  });

  // =========================================================================
  // 5. IMMUTABILITY API GUARDS (FORBID MODIFICATION OR DELETION)
  // =========================================================================
  describe('5. Immutability API Protection (POST, PUT, PATCH, DELETE Forbidden)', () => {
    it('rejects POST to /api/members/:memberId/level/history with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/members/${memberId}/level/history`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ note: 'Attempting to manually create promotion history' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/immutable/i);
    });

    it('rejects PUT to /api/members/:memberId/level/history/hist-1 with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/members/${memberId}/level/history/hist-1`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ note: 'Attempting to update history record' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/immutable/i);
    });

    it('rejects PATCH to /api/members/:memberId/level/history/hist-1 with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/members/${memberId}/level/history/hist-1`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ note: 'Attempting to patch history record' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/immutable/i);
    });

    it('rejects DELETE to /api/members/:memberId/level/history/hist-1 with 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/members/${memberId}/level/history/hist-1`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/immutable/i);
    });

    it('rejects POST to /api/v1/levels/history with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/levels/history')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ note: 'Attempting to inject into current distributor history' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/immutable/i);
    });

    it('rejects DELETE to /api/v1/levels/history/hist-1 with 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/v1/levels/history/hist-1')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/immutable/i);
    });
  });

  // =========================================================================
  // 6. HISTORY QUERY API & SERVICE (READ-ONLY AUDIT TRAIL)
  // =========================================================================
  describe('6. Querying Promotion History', () => {
    it('returns chronological promotion records via GET /api/members/:memberId/level/history', async () => {
      const mockMember = {
        id: memberId,
        distributorCode: 'DST-P9-01',
        currentBB: 500,
        currentMatching: 5000,
        user: { firstName: 'Alice', lastName: 'Distributor' },
      };
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(mockMember as any);

      // Populate history records in chronological order
      mockHistoryStore.push(
        {
          id: 'hist-1',
          memberId,
          previousLevelCode: 'STARTER',
          newLevelCode: 'SILVER',
          previousLevel: { code: 'BASE', name: 'Base', order: 0 },
          newLevel: { code: 'SILVER', name: 'Silver', order: 1 },
          qualifyingBB: 250,
          qualifyingLeftMatching: 2000,
          qualifyingRightMatching: 2000,
          qualifyingMatching: 2000,
          reason: 'LEVEL_REQUIREMENTS_MET',
          source: 'SYSTEM',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        },
        {
          id: 'hist-2',
          memberId,
          previousLevelCode: 'SILVER',
          newLevelCode: 'GOLD',
          previousLevel: { code: 'SILVER', name: 'Silver', order: 1 },
          newLevel: { code: 'GOLD', name: 'Gold', order: 2 },
          qualifyingBB: 300,
          qualifyingLeftMatching: 5000,
          qualifyingRightMatching: 5000,
          qualifyingMatching: 5000,
          reason: 'LEVEL_REQUIREMENTS_MET',
          source: 'SYSTEM',
          createdAt: new Date('2026-09-15T12:00:00Z'),
        }
      );

      const res = await request(app)
        .get(`/api/members/${memberId}/level/history`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);

      // Check first record (STARTER -> SILVER)
      const record1 = res.body.data[0];
      expect(record1.previousLevel).toBe('STARTER');
      expect(record1.newLevel).toBe('SILVER');
      expect(record1.qualifyingBB).toBe(250);
      expect(record1.qualifyingLeftMatching).toBe(2000);
      expect(record1.qualifyingRightMatching).toBe(2000);
      expect(record1.reason).toBe('LEVEL_REQUIREMENTS_MET');
      expect(record1.source).toBe('SYSTEM');

      // Check second record (SILVER -> GOLD)
      const record2 = res.body.data[1];
      expect(record2.previousLevel).toBe('SILVER');
      expect(record2.newLevel).toBe('GOLD');
      expect(record2.qualifyingBB).toBe(300);
      expect(record2.qualifyingLeftMatching).toBe(5000);
      expect(record2.qualifyingRightMatching).toBe(5000);
      expect(record2.reason).toBe('LEVEL_REQUIREMENTS_MET');
      expect(record2.source).toBe('SYSTEM');
    });
  });
});
