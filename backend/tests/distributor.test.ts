/**
 * Test Suite: Distributor Management Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Profile (me & by ID/code)
 * - Sponsor & Upline lineage
 * - Team (direct team & downline)
 * - Authentication & Authorization guards
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { DistributorService } from '../src/services/distributor.service';
import { TreeService } from '../src/services/tree.service';
import { createTestToken } from './helpers/testHelpers';

describe('DISTRIBUTOR MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  const distributorId = 'dst-profile-10001';
  const userId = 'usr-dist-001';
  const token = createTestToken({
    id: userId,
    email: 'distributor@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Profile Retrieval (/api/v1/distributors/me & /:id)', () => {
    it('should retrieve authenticated distributor profile via GET /me', async () => {
      const mockProfile = {
        id: distributorId,
        distributorCode: 'DST-10001',
        userId: userId,
        status: 'ACTIVE',
        user: {
          email: 'distributor@kashvimlm.com',
          role: 'DISTRIBUTOR',
          status: 'ACTIVE',
        },
        currentRank: { rankName: 'Executive Director' },
        businessCenters: [{ id: 'bc-1', centerNumber: 1, status: 'ACTIVE' }],
      };

      vi.spyOn(DistributorService, 'getProfileByUserId').mockResolvedValue(mockProfile as any);

      const res = await request(app)
        .get('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Distributor profile retrieved');
      expect(res.body.data.distributorCode).toBe('DST-10001');
      expect(res.body.data.user.email).toBe('distributor@kashvimlm.com');
    });

    it('should retrieve distributor profile by ID or distributor code', async () => {
      const mockProfile = {
        id: distributorId,
        distributorCode: 'DST-10001',
        displayName: 'Rahul Kaushal',
        status: 'ACTIVE',
      };

      vi.spyOn(DistributorService, 'getProfileByIdOrCode').mockResolvedValue(mockProfile as any);

      const res = await request(app)
        .get(`/api/v1/distributors/${distributorId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.distributorCode).toBe('DST-10001');
      expect(res.body.data.displayName).toBe('Rahul Kaushal');
    });

    it('should reject profile request with 401 when token is missing', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/me')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authorization token is missing or malformed');
    });

    it('should update authenticated distributor profile via PATCH /me', async () => {
      const updateData = {
        displayName: 'RK Leader',
        phone: '+919876543210',
      };

      vi.spyOn(DistributorService, 'updateProfile').mockResolvedValue({
        id: distributorId,
        displayName: 'RK Leader',
        phone: '+919876543210',
      } as any);

      const res = await request(app)
        .patch('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('RK Leader');
    });
  });

  describe('2. Sponsor & Upline Lineage (/api/v1/distributors/:id/upline)', () => {
    it('should retrieve sponsor details and placement upline hierarchy', async () => {
      const mockUpline = {
        distributorId,
        sponsor: {
          id: 'dst-sponsor-999',
          distributorCode: 'DST-88767139',
          name: 'Direct Sponsor Leader',
          email: 'sponsor@kashvimlm.com',
          status: 'ACTIVE',
        },
        placementParent: {
          id: 'node-parent-123',
          distributorId: 'dst-sponsor-999',
          distributorCode: 'DST-88767139',
          position: 'LEFT',
          depth: 2,
        },
        sponsorLineage: [
          { depth: 1, distributorCode: 'DST-88767139', name: 'Direct Sponsor Leader' },
          { depth: 2, distributorCode: 'DST-ROOT-001', name: 'Master Root' },
        ],
      };

      vi.spyOn(DistributorService, 'getUpline').mockResolvedValue(mockUpline as any);

      const res = await request(app)
        .get(`/api/v1/distributors/${distributorId}/upline`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Upline lineage retrieved');
      expect(res.body.data.sponsor.distributorCode).toBe('DST-88767139');
      expect(res.body.data.placementParent.position).toBe('LEFT');
      expect(res.body.data.sponsorLineage.length).toBeGreaterThan(0);
    });
  });

  describe('3. Team & Downline Management (/api/v1/distributors/:id/team)', () => {
    it('should retrieve direct personal sponsored team members', async () => {
      const mockTeam = {
        distributorId,
        directSponsorsCount: 3,
        activeSponsorsCount: 3,
        teamMembers: [
          {
            id: 'dst-member-1',
            distributorCode: 'DST-10002',
            firstName: 'Sarah',
            lastName: 'Connor',
            status: 'ACTIVE',
            enrolledAt: new Date().toISOString(),
            currentPSV: 150,
          },
          {
            id: 'dst-member-2',
            distributorCode: 'DST-10003',
            firstName: 'John',
            lastName: 'Smith',
            status: 'ACTIVE',
            enrolledAt: new Date().toISOString(),
            currentPSV: 200,
          },
        ],
      };

      vi.spyOn(DistributorService, 'getTeam').mockResolvedValue(mockTeam as any);

      const res = await request(app)
        .get(`/api/v1/distributors/${distributorId}/team`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Direct team retrieved');
      expect(res.body.data.directSponsorsCount).toBe(3);
      expect(res.body.data.teamMembers.length).toBe(2);
      expect(res.body.data.teamMembers[0].distributorCode).toBe('DST-10002');
    });

    it('should retrieve binary genealogy tree for distributor team', async () => {
      const mockTree = {
        nodeId: 'node-root',
        depth: 0,
        distributor: {
          id: distributorId,
          distributorCode: 'DST-10001',
          name: 'Rahul Kaushal',
        },
        leftChild: {
          nodeId: 'node-left',
          position: 'LEFT',
          distributor: { id: 'dst-2', distributorCode: 'DST-10002' },
        },
        rightChild: {
          nodeId: 'node-right',
          position: 'RIGHT',
          distributor: { id: 'dst-3', distributorCode: 'DST-10003' },
        },
      };

      vi.spyOn(DistributorService, 'getTree').mockResolvedValue(mockTree as any);

      const res = await request(app)
        .get(`/api/v1/distributors/${distributorId}/tree`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.leftChild.position).toBe('LEFT');
      expect(res.body.data.rightChild.position).toBe('RIGHT');
    });
  });
});
