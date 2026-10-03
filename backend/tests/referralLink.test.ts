/**
 * Test Suite: Distributor Referral Link Automated Tests (Prompt 6)
 * Uses Vitest & Supertest
 *
 * Covers:
 * 1. GET /api/v1/distributors/me/referral-link (Authenticated)
 * 2. GET /api/v1/distributors/me/referral-link (Optional auth / dev fallback)
 * 3. GET /api/v1/distributors/:id/referral-link (By Distributor ID e.g. KV-1001)
 * 4. Custom domain support (baseUrl query parameter & header)
 * 5. 404 response for invalid/non-existent distributor
 * 6. Verification of response shape: { success: true, data: { distributorId, referralUrl } }
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { createTestToken } from './helpers/testHelpers';

describe('DISTRIBUTOR REFERRAL LINK API TESTS (PROMPT 6)', () => {
  const userId = 'usr-dist-001';
  const token = createTestToken({
    id: userId,
    email: 'distributor@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Authenticated Referral Link (GET /api/v1/distributors/me/referral-link)', () => {
    it('should return 200 and referral link for authenticated distributor', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-1',
        userId: userId,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/me/referral-link?baseUrl=https://YOURDOMAIN.com')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        distributorId: 'KV-1001',
        referralUrl: 'https://YOURDOMAIN.com/join?ref=KV-1001',
      });
    });

    it('should fallback to distributorCode if distributorId is not explicitly set', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-2',
        userId: userId,
        distributorId: null,
        distributorCode: 'DST-10002',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/me/referral-link?baseUrl=https://YOURDOMAIN.com')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.distributorId).toBe('DST-10002');
      expect(res.body.data.referralUrl).toBe('https://YOURDOMAIN.com/join?ref=DST-10002');
    });
  });

  describe('2. Unauthenticated / Dev Fallback (GET /api/v1/distributors/me/referral-link)', () => {
    it('should allow optional auth preview with default KV-1001 distributor', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-rahul',
        userId: 'usr-rahul',
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/me/referral-link?baseUrl=https://YOURDOMAIN.com')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        distributorId: 'KV-1001',
        referralUrl: 'https://YOURDOMAIN.com/join?ref=KV-1001',
      });
    });
  });

  describe('3. Specific Distributor Referral Link (GET /api/v1/distributors/:id/referral-link)', () => {
    it('should retrieve referral link for specific distributor ID', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-3',
        userId: 'usr-3',
        distributorId: 'KV-1005',
        distributorCode: 'DST-10005',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/KV-1005/referral-link?baseUrl=https://YOURDOMAIN.com')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        distributorId: 'KV-1005',
        referralUrl: 'https://YOURDOMAIN.com/join?ref=KV-1005',
      });
    });

    it('should generate valid referralUrl containing /join?ref=KV-1001 when baseUrl is omitted', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-1',
        userId: userId,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/me/referral-link')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.distributorId).toBe('KV-1001');
      expect(res.body.data.referralUrl).toMatch(/\/join\?ref=KV-1001$/);
    });

    it('should reject inactive distributor with DISTRIBUTOR_INACTIVE', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-inactive',
        userId: userId,
        distributorId: 'KV-INACTIVE',
        distributorCode: 'KV-INACTIVE',
        status: 'INACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/me/referral-link')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DISTRIBUTOR_INACTIVE');
    });

    it('should never expose sensitive distributor information in response', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-uuid-1',
        userId: userId,
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/v1/distributors/me/referral-link')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const keys = Object.keys(res.body.data);
      expect(keys).toEqual(['distributorId', 'referralUrl']);
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.email).toBeUndefined();
      expect(res.body.data.phone).toBeUndefined();
      expect(res.body.data.bankAccount).toBeUndefined();
    });
    it('should return 404 if distributor is not found', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/distributors/NON_EXISTENT_ID/referral-link')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DISTRIBUTOR_NOT_FOUND');
    });
  });
});
