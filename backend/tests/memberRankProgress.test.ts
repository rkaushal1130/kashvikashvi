import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { MemberRankProgressService } from '../src/services/memberRankProgress.service';
import { LevelService } from '../src/services/level.service';
import { createTestToken } from './helpers/testHelpers';

describe('PROMPT 7: MEMBER RANK PROGRESS SYSTEM', () => {
  const memberToken = createTestToken({
    id: 'usr-progress-001',
    email: 'progress.member@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const mockMemberId = 'dist-progress-001';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PURE PROGRESS CALCULATION ENGINE TESTS
  // =========================================================================
  describe('1. MemberRankProgressService.computeProgress', () => {
    it('should compute exact Prompt 7 example specification', () => {
      // Prompt 7 exact example:
      // currentLevel: Silver
      // currentBB: 300, leftMatching: 3500, rightMatching: 2700
      // nextLevel: Gold (requiredBB: 250, requiredLeftMatching: 5000, requiredRightMatching: 5000)
      const result = MemberRankProgressService.computeProgress(
        300,
        3500,
        2700,
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );

      expect(result).toEqual({
        currentLevel: {
          name: 'Silver',
          code: 'SILVER',
        },
        currentBB: 300,
        leftMatching: 3500,
        rightMatching: 2700,
        nextLevel: {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        },
        progress: {
          bb: {
            current: 300,
            required: 250,
            remaining: 0,
            percentage: 100,
          },
          leftMatching: {
            current: 3500,
            required: 5000,
            remaining: 1500,
            percentage: 70,
          },
          rightMatching: {
            current: 2700,
            required: 5000,
            remaining: 2300,
            percentage: 54,
          },
        },
        qualifiedForNextLevel: false,
      });
    });

    it('SAFE CALCULATION: should NEVER return negative remaining values', () => {
      // currentBB = 300, requiredBB = 250 => remaining must be 0, not -50
      const result = MemberRankProgressService.computeProgress(
        500,
        10000,
        15000,
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );

      expect(result.progress.bb.remaining).toBe(0);
      expect(result.progress.leftMatching.remaining).toBe(0);
      expect(result.progress.rightMatching.remaining).toBe(0);
      expect(result.progress.bb.remaining).toBeGreaterThanOrEqual(0);
      expect(result.progress.leftMatching.remaining).toBeGreaterThanOrEqual(0);
      expect(result.progress.rightMatching.remaining).toBeGreaterThanOrEqual(0);
    });

    it('PERCENTAGE CAPPING: should cap percentage at 100% when current exceeds required', () => {
      const result = MemberRankProgressService.computeProgress(
        1000, // 400% of 250
        20000, // 400% of 5000
        25000, // 500% of 5000
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );

      expect(result.progress.bb.percentage).toBe(100);
      expect(result.progress.leftMatching.percentage).toBe(100);
      expect(result.progress.rightMatching.percentage).toBe(100);
    });

    it('QUALIFICATION CHECK: qualifiedForNextLevel is true only when ALL 3 requirements are met', () => {
      // Case A: All 3 requirements satisfied
      const fullyQualified = MemberRankProgressService.computeProgress(
        250,
        5000,
        5000,
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );
      expect(fullyQualified.qualifiedForNextLevel).toBe(true);

      // Case B: Left matching deficient (BB and Right OK)
      const leftDeficient = MemberRankProgressService.computeProgress(
        250,
        4999,
        5000,
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );
      expect(leftDeficient.qualifiedForNextLevel).toBe(false);

      // Case C: Right matching deficient (BB and Left OK)
      const rightDeficient = MemberRankProgressService.computeProgress(
        250,
        5000,
        4999,
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );
      expect(rightDeficient.qualifiedForNextLevel).toBe(false);

      // Case D: BB deficient (Left and Right OK)
      const bbDeficient = MemberRankProgressService.computeProgress(
        249,
        5000,
        5000,
        { name: 'Silver', code: 'SILVER' },
        {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        }
      );
      expect(bbDeficient.qualifiedForNextLevel).toBe(false);
    });

    it('MAX LEVEL (RUBY): should handle member at peak level with nextLevel null and qualifiedForNextLevel false', () => {
      const rubyProgress = MemberRankProgressService.computeProgress(
        1500,
        150000,
        150000,
        {
          name: 'Ruby',
          code: 'RUBY',
          requiredBB: 1000,
          requiredLeftMatching: 100000,
          requiredRightMatching: 100000,
        },
        null // Peak level: no nextLevel
      );

      expect(rubyProgress.currentLevel).toEqual({ name: 'Ruby', code: 'RUBY' });
      expect(rubyProgress.nextLevel).toBeNull();
      expect(rubyProgress.qualifiedForNextLevel).toBe(false);
      expect(rubyProgress.progress.bb.remaining).toBe(0);
      expect(rubyProgress.progress.bb.percentage).toBe(100);
      expect(rubyProgress.progress.leftMatching.remaining).toBe(0);
      expect(rubyProgress.progress.leftMatching.percentage).toBe(100);
      expect(rubyProgress.progress.rightMatching.remaining).toBe(0);
      expect(rubyProgress.progress.rightMatching.percentage).toBe(100);
    });
  });

  // =========================================================================
  // 2. REST API INTEGRATION TESTS
  // =========================================================================
  describe('2. Member Rank Progress Endpoints', () => {
    beforeEach(() => {
      vi.spyOn(LevelService, 'getMemberLevel').mockResolvedValue({
        memberId: mockMemberId,
        distributorCode: 'KV-PROG-001',
        displayName: 'Test Member',
        currentBB: 300,
        currentLeftMatching: 3500,
        currentRightMatching: 2700,
        currentMatching: 2700,
        currentLevel: {
          order: 1,
          code: 'SILVER',
          name: 'Silver',
          requiredBB: 250,
          requiredLeftMatching: 2000,
          requiredRightMatching: 2000,
          description: 'Silver tier',
        },
        highestLevel: {
          order: 1,
          code: 'SILVER',
          name: 'Silver',
          requiredBB: 250,
          requiredLeftMatching: 2000,
          requiredRightMatching: 2000,
          description: 'Silver tier',
        },
        nextLevel: {
          order: 2,
          code: 'GOLD',
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
          description: 'Gold tier',
        },
        isMaxLevel: false,
        progress: {
          bbGap: 0,
          leftMatchingGap: 1500,
          rightMatchingGap: 2300,
          matchingGap: 2300,
          bbProgressPercentage: 100,
          leftMatchingProgressPercentage: 70,
          rightMatchingProgressPercentage: 54,
          matchingProgressPercentage: 54,
          isQualifiedForNext: false,
        },
        achievedAt: new Date(),
      } as any);

      vi.spyOn(LevelService, 'getLevelHistory').mockResolvedValue({
        data: [
          {
            id: 'mlh-prog-1',
            memberId: mockMemberId,
            previousLevel: 'Base',
            newLevel: 'Silver',
            previousOrder: 0,
            newOrder: 1,
            qualifyingBB: 250,
            qualifyingMatching: 2000,
            reason: 'Qualification met',
            source: 'SYSTEM_AUTO',
            createdAt: new Date('2026-09-01T10:00:00Z'),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as any);
    });

    it('GET /api/members/:memberId/level/progress -> 200 with exact Prompt 7 payload', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level/progress`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Member next level progress retrieved successfully');

      const data = res.body.data;
      expect(data).toEqual({
        currentLevel: {
          name: 'Silver',
          code: 'SILVER',
        },
        currentBB: 300,
        leftMatching: 3500,
        rightMatching: 2700,
        nextLevel: {
          name: 'Gold',
          requiredBB: 250,
          requiredLeftMatching: 5000,
          requiredRightMatching: 5000,
        },
        progress: {
          bb: {
            current: 300,
            required: 250,
            remaining: 0,
            percentage: 100,
          },
          leftMatching: {
            current: 3500,
            required: 5000,
            remaining: 1500,
            percentage: 70,
          },
          rightMatching: {
            current: 2700,
            required: 5000,
            remaining: 2300,
            percentage: 54,
          },
        },
        qualifiedForNextLevel: false,
      });
    });

    it('GET /api/members/:memberId/level -> 200 with level overview', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.memberId).toBe(mockMemberId);
      expect(res.body.data.currentLevel).toBe('Silver');
      expect(res.body.data.currentLevelCode).toBe('SILVER');
      expect(res.body.data.bb).toBe(300);
      expect(res.body.data.leftMatching).toBe(3500);
      expect(res.body.data.rightMatching).toBe(2700);
    });

    it('GET /api/members/:memberId/level/history -> 200 with promotion history', async () => {
      const res = await request(app)
        .get(`/api/members/${mockMemberId}/level/history`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].newLevel).toBe('Silver');
      expect(res.body.meta.total).toBe(1);
    });

    it('SECURITY: 401 Unauthorized for unauthenticated requests on all 3 endpoints', async () => {
      await request(app).get(`/api/members/${mockMemberId}/level`).expect(401);
      await request(app).get(`/api/members/${mockMemberId}/level/progress`).expect(401);
      await request(app).get(`/api/members/${mockMemberId}/level/history`).expect(401);
    });
  });
});
