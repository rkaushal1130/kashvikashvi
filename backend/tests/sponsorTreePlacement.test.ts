import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { createAdminToken, createTestToken } from './helpers/testHelpers';
import { SponsorService } from '../src/services/sponsor.service';
import { NetworkTreeService } from '../src/services/networkTree.service';
import { TreePlacementService } from '../src/services/treePlacement.service';
import { AuthService } from '../src/services/auth.service';

describe('SPONSOR REGISTRATION, PERSONAL TREES, AUTO-PLACEMENT & OWNER ACCESS', () => {
  const adminToken = createAdminToken();

  const rahulToken = createTestToken({
    id: 'KV-1001',
    email: 'rahulkaushal1109@gmail.com',
    role: 'ADMIN',
  });

  const amitToken = createTestToken({
    id: 'KV-1002',
    email: 'amit@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const rohitToken = createTestToken({
    id: 'KV-1003',
    email: 'rohit@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Sponsor Link & ID Validation (GET /api/v1/sponsors/:sponsorId)
  // =========================================================================
  describe('1. Sponsor Link and ID Validation', () => {
    it('should validate an active sponsor (KV-1001) and return details with available positions', async () => {
      const res = await request(app)
        .get('/api/v1/sponsors/KV-1001')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sponsor.distributorId).toBe('KV-1001');
      expect(res.body.data.sponsor.name).toContain('Rahul');
      expect(res.body.data.sponsor.status).toBe('ACTIVE');
      expect(Array.isArray(res.body.data.availablePositions)).toBe(true);
    });

    it('should validate an active downline sponsor (KV-1002 Amit Patel)', async () => {
      const res = await request(app)
        .get('/api/v1/sponsors/KV-1002')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sponsor.distributorId).toBe('KV-1002');
      expect(res.body.data.sponsor.status).toBe('ACTIVE');
    });

    it('should return 404 if sponsor referral ID does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/sponsors/NONEXISTENT_9999')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_NOT_FOUND');
    });

    it('should return 400 if sponsor account is inactive', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValueOnce({
        id: 'dist-inactive-uuid',
        distributorId: 'KV-9999',
        distributorCode: 'KV-9999',
        firstName: 'Inactive',
        lastName: 'User',
        displayName: 'Inactive User',
        status: 'SUSPENDED',
        mlmNodes: [],
      } as any);

      const res = await request(app)
        .get('/api/v1/sponsors/KV-9999')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_INACTIVE');
    });
  });

  // =========================================================================
  // 2. Personal Distributor Tree Isolation (Self as Root)
  // =========================================================================
  describe('2. Personal Distributor Tree Isolation (Self as Root)', () => {
    it('should root Rahul Kaushal (KV-1001) tree at himself', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root.distributorId).toBe('KV-1001');
      expect(res.body.data.root.position).toBe('ROOT');
    });

    it('should root Amit Patel (KV-1002) tree at Amit, NEVER showing Rahul as root', async () => {
      const tree = await NetworkTreeService.getNetworkTree('KV-1002');

      expect(tree.root.distributorId).toBe('KV-1002');
      expect(tree.root.name).toBe('Amit');
      expect(tree.root.position).toBe('ROOT');
      // Verify Rahul is NOT the root of Amit's tree
      expect(tree.root.distributorId).not.toBe('KV-1001');
    });

    it('should root Rohit Sharma (KV-1003) tree at Rohit, NEVER showing Rahul or Amit as root', async () => {
      const tree = await NetworkTreeService.getNetworkTree('KV-1003');

      expect(tree.root.distributorId).toBe('KV-1003');
      expect(tree.root.name).toBe('Rohit');
      expect(tree.root.position).toBe('ROOT');
      expect(tree.root.distributorId).not.toBe('KV-1001');
      expect(tree.root.distributorId).not.toBe('KV-1002');
    });

    it('should root Priya Sharma (KV-1004) tree at Priya, NEVER exposing uplines as root', async () => {
      const tree = await NetworkTreeService.getNetworkTree('KV-1004');

      expect(tree.root.distributorId).toBe('KV-1004');
      expect(tree.root.name).toBe('Priya');
      expect(tree.root.position).toBe('ROOT');
      expect(tree.root.distributorId).not.toBe('KV-1001');
      expect(tree.root.distributorId).not.toBe('KV-1003');
    });
  });

  // =========================================================================
  // 3. Separation of Sponsorship vs Tree Placement & Auto-Placement
  // =========================================================================
  describe('3. Separation of Sponsorship vs Tree Placement', () => {
    it('should place a new distributor with permanent sponsorId and proper tree placement', async () => {
      const result = await TreePlacementService.autoPlaceUnderSponsor(
        'KV-1050',
        'KV-1001',
        'RIGHT'
      );

      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.sponsorId).toBe('KV-1001');
        expect(result.data.placementPosition).toBe('RIGHT');
      }
    });

    it('should preserve direct sponsor when spillover places distributor under a downline parent', async () => {
      // Mock sponsor with occupied immediate slots
      const sponsorNodeMock = {
        id: 'node-sponsor-mock',
        distributorId: 'dist-sponsor-uuid',
        distributorCode: 'KV-SPONSOR',
        status: 'ACTIVE',
        depth: 1,
        binaryPath: 'ROOT/R',
        children: [
          { id: 'node-child-left', placementPosition: 'LEFT' },
          { id: 'node-child-right', placementPosition: 'RIGHT' },
        ],
        distributor: { status: 'ACTIVE', distributorCode: 'KV-SPONSOR', id: 'dist-sponsor-uuid' },
        businessCenters: [{ id: 'bc-sponsor' }],
      };

      vi.spyOn(TreePlacementService, 'resolveNode').mockResolvedValueOnce(sponsorNodeMock as any);
      vi.spyOn(prisma.mLMNode, 'findMany')
        .mockResolvedValueOnce([
          { id: 'node-child-left', placementPosition: 'LEFT' },
          { id: 'node-child-right', placementPosition: 'RIGHT' },
        ] as any)
        .mockResolvedValueOnce([
          // Downline right child has open right slot
          { id: 'node-grandchild-left', placementPosition: 'LEFT' },
        ] as any);

      vi.spyOn(TreePlacementService, 'placeDistributor').mockResolvedValueOnce({
        success: true,
        data: {
          distributorId: 'dist-new-uuid',
          sponsorId: 'KV-SPONSOR',
          placementParentId: 'node-child-right',
          placementPosition: 'RIGHT',
        },
      });

      const result = await TreePlacementService.autoPlaceUnderSponsor(
        'dist-new-uuid',
        'KV-SPONSOR',
        'RIGHT'
      );

      expect(result.success).toBe(true);
      expect(result.data.sponsorId).toBe('KV-SPONSOR');
      expect(result.data.placementParentId).toBe('node-child-right');
    });

    it('should prevent self-sponsorship where sponsor equals distributor', async () => {
      const validation = await TreePlacementService.validatePlacement({
        distributorId: 'KV-1002',
        placementParentId: 'node-root-uuid',
        placementPosition: 'LEFT',
        sponsorId: 'KV-1002',
      });

      expect(validation.valid).toBe(false);
      expect(validation.code).toBe('SELF_SPONSORSHIP_FORBIDDEN');
    });
  });

  // =========================================================================
  // 4. Payment-Gated Tree Placement
  // =========================================================================
  describe('4. Payment-Gated Tree Placement', () => {
    it('should activate distributor and auto-place in tree only upon payment completion', async () => {
      const activation = await AuthService.activateDistributorAndPlace('KV-1025', {
        bv: 100,
        orderId: 'ord-activation-test',
        paymentMethod: 'RAZORPAY',
      });

      expect(activation.success).toBe(true);
      expect(activation.status).toBe('ACTIVE');
      expect(activation.distributorId).toBe('KV-1025');
    });
  });

  // =========================================================================
  // 5. Owner-Only Company-Wide Access & Role-Based Access Control
  // =========================================================================
  describe('5. Owner-Only Company-Wide Access & Role-Based Access Control', () => {
    it('should allow Admin to view ANY distributor network tree', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1003')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root.distributorId).toBe('KV-1003');
    });

    it('should allow regular distributor Amit to view members within his downline organization', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1006')
        .set('Authorization', `Bearer ${amitToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root.distributorId).toBe('KV-1006');
    });

    it('should return 403 Forbidden when regular distributor Amit tries to view crossline tree Rohit (KV-1003)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1003')
        .set('Authorization', `Bearer ${amitToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_NETWORK_VIEW');
    });

    it('should return 403 Forbidden when regular distributor Rohit tries to view crossline tree Amit (KV-1002)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1002')
        .set('Authorization', `Bearer ${rohitToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_NETWORK_VIEW');
    });

    it('should return 403 Forbidden when regular distributor tries to view upline owner tree directly without authorization', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1001')
        .set('Authorization', `Bearer ${amitToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_NETWORK_VIEW');
    });
  });
});
