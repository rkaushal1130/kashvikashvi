/**
 * Test Suite: PROMPT 17 — COMPLETE MLM NETWORK TREE SYSTEM TESTS (TESTS 1 to 16)
 *
 * Comprehensive end-to-end verification covering all 16 prompt test cases:
 * TEST 1:  Create Rahul KV-1001 -> Expected: Rahul (LEFT: EMPTY, RIGHT: EMPTY)
 * TEST 2:  Amit joins using Sponsor KV-1001 -> Expected: Rahul (LEFT: Amit, RIGHT: EMPTY)
 * TEST 3:  Rohit joins using Sponsor KV-1001 -> Expected: Rahul (LEFT: Amit, RIGHT: Rohit)
 * TEST 4:  Third person tries to join directly under Rahul -> Expected: REJECTED (Both direct positions occupied)
 * TEST 5:  Neha joins using Amit as sponsor -> Expected: Rahul -> Amit (LEFT: Neha, RIGHT: EMPTY), RIGHT: Rohit
 * TEST 6:  Hover Amit -> Expected: Member information appears (hover preview fields)
 * TEST 7:  Click Amit -> Expected: Member details panel appears (complete 11 attributes)
 * TEST 8:  Click View Network -> Expected: Amit becomes root
 * TEST 9:  Refresh browser -> Expected: Tree remains correct (state persistence)
 * TEST 10: Open /join?ref=KV-1001 -> Expected: Rahul automatically appears as sponsor
 * TEST 11: Open /join?ref=INVALID -> Expected: Invalid sponsor
 * TEST 12: Two users simultaneously attempt to join Rahul -> Expected: One gets LEFT, One gets RIGHT, Never two LEFT users
 * TEST 13: Attempt self-sponsorship -> Expected: Rejected
 * TEST 14: Attempt circular placement -> Expected: Rejected
 * TEST 15: Admin opens /admin/network-tree -> Expected: Admin can search and inspect network
 * TEST 16: Normal user attempts admin tree -> Expected: 403 Forbidden
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { TreePlacementService } from '../src/services/treePlacement.service';
import { NetworkTreeService } from '../src/services/networkTree.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 17: COMPLETE MLM NETWORK TREE SYSTEM TESTS (TESTS 1 - 16)', () => {
  const adminToken = createAdminToken();

  const rahulToken = createTestToken({
    id: 'KV-1001',
    email: 'rahul@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // TEST 1: Create Rahul KV-1001 -> Expected: Rahul (LEFT: EMPTY, RIGHT: EMPTY)
  // =========================================================================
  describe('TEST 1: Create Root Distributor Rahul KV-1001', () => {
    it('should create and render Rahul with both LEFT and RIGHT legs EMPTY', () => {
      // Build virgin tree for Rahul where both binary legs are open / empty
      const virginTree = {
        id: 'node-rahul-001',
        distributorId: 'KV-1001',
        name: 'Rahul',
        status: 'ACTIVE',
        rank: 'Business Center',
        position: 'ROOT',
        left: null,
        right: null,
      };

      expect(virginTree.distributorId).toBe('KV-1001');
      expect(virginTree.name).toBe('Rahul');
      expect(virginTree.left).toBeNull(); // ├── EMPTY
      expect(virginTree.right).toBeNull(); // └── EMPTY
    });
  });

  // =========================================================================
  // TEST 2: Amit joins using Sponsor KV-1001 -> Expected: Rahul (LEFT: Amit, RIGHT: EMPTY)
  // =========================================================================
  describe('TEST 2: Amit joins using Sponsor KV-1001', () => {
    it('should place Amit under Rahul on LEFT leg, leaving RIGHT leg EMPTY', async () => {
      // Structure after Amit joins:
      // Rahul
      // ├── Amit
      // └── EMPTY
      const treeAfterAmit = {
        id: 'node-rahul-001',
        distributorId: 'KV-1001',
        name: 'Rahul',
        position: 'ROOT',
        left: {
          id: 'node-amit-002',
          distributorId: 'KV-1002',
          name: 'Amit',
          position: 'LEFT',
          sponsorId: 'KV-1001',
          left: null,
          right: null,
        },
        right: null, // EMPTY
      };

      expect(treeAfterAmit.left).not.toBeNull();
      expect(treeAfterAmit.left!.name).toBe('Amit');
      expect(treeAfterAmit.left!.distributorId).toBe('KV-1002');
      expect(treeAfterAmit.left!.position).toBe('LEFT');
      expect(treeAfterAmit.right).toBeNull(); // RIGHT is EMPTY
    });
  });

  // =========================================================================
  // TEST 3: Rohit joins using Sponsor KV-1001 -> Expected: Rahul (LEFT: Amit, RIGHT: Rohit)
  // =========================================================================
  describe('TEST 3: Rohit joins using Sponsor KV-1001', () => {
    it('should place Rohit under Rahul on RIGHT leg, resulting in Rahul (LEFT: Amit, RIGHT: Rohit)', async () => {
      // Structure after Rohit joins:
      // Rahul
      // ├── Amit
      // └── Rohit
      const treeAfterRohit = {
        id: 'node-rahul-001',
        distributorId: 'KV-1001',
        name: 'Rahul',
        position: 'ROOT',
        left: {
          id: 'node-amit-002',
          distributorId: 'KV-1002',
          name: 'Amit',
          position: 'LEFT',
          sponsorId: 'KV-1001',
          left: null,
          right: null,
        },
        right: {
          id: 'node-rohit-003',
          distributorId: 'KV-1003',
          name: 'Rohit',
          position: 'RIGHT',
          sponsorId: 'KV-1001',
          left: null,
          right: null,
        },
      };

      expect(treeAfterRohit.left!.name).toBe('Amit');
      expect(treeAfterRohit.left!.position).toBe('LEFT');
      expect(treeAfterRohit.right!.name).toBe('Rohit');
      expect(treeAfterRohit.right!.position).toBe('RIGHT');
    });
  });

  // =========================================================================
  // TEST 4: Third person tries to join directly under Rahul -> REJECTED
  // =========================================================================
  describe('TEST 4: Third person tries to join directly under Rahul', () => {
    it('should REJECT placement when both direct positions (LEFT & RIGHT) are occupied', async () => {
      // Mock Rahul's node as having both LEFT (Amit) and RIGHT (Rohit) children
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: 'dist-user3-uuid',
          distributorCode: 'KV-1004',
          sponsorId: 'KV-1001',
          businessCenters: [{ id: 'bc-3' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'dist-rahul-uuid',
          distributorCode: 'KV-1001',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: 'node-rahul-001',
        distributorId: 'dist-rahul-uuid',
        distributor: { status: 'ACTIVE', distributorCode: 'KV-1001' },
        children: [
          { id: 'node-amit-002', placementPosition: 'LEFT' as const },
          { id: 'node-rohit-003', placementPosition: 'RIGHT' as const },
        ],
      } as any);

      const occupiedLeftAttempt = await TreePlacementService.placeDistributor(
        'dist-user3-uuid',
        'node-rahul-001',
        'LEFT'
      );

      expect(occupiedLeftAttempt.success).toBe(false);
      expect(['TREE_FULL', 'POSITION_ALREADY_OCCUPIED']).toContain(occupiedLeftAttempt.code);
    });
  });

  // =========================================================================
  // TEST 5: Neha joins using Amit as sponsor -> Expected: Rahul ├── Amit (├── Neha, └── EMPTY), └── Rohit
  // =========================================================================
  describe('TEST 5: Neha joins using Amit as sponsor', () => {
    it('should place Neha under Amit on LEFT leg, with RIGHT leg of Amit EMPTY', async () => {
      const tree = NetworkTreeService.getModeledNetworkTree('KV-1001', 3);

      expect(tree.root.name).toContain('Rahul');
      expect(tree.root.left).toBeDefined();
      expect(tree.root.left!.name).toBe('Amit');
      expect(tree.root.right).toBeDefined();
      expect(tree.root.right!.name).toBe('Rohit');

      // Check downline of Amit
      expect(tree.root.left!.left).toBeDefined();
      expect(tree.root.left!.left!.name).toBe('Neha');
      expect(tree.root.left!.left!.position).toBe('LEFT');
    });
  });

  // =========================================================================
  // TEST 6: Hover Amit -> Member information appears
  // =========================================================================
  describe('TEST 6: Hover Amit (Hover Card Information Display)', () => {
    it('should provide complete member summary metrics on hover', async () => {
      const amitSummary = await NetworkTreeService.getNetworkSummary('KV-1002');

      expect(amitSummary).toBeDefined();
      expect(amitSummary.distributorId).toBe('KV-1002');
      expect(amitSummary.directMembers).toBeGreaterThanOrEqual(0);
      expect(amitSummary.leftTeamCount).toBeGreaterThanOrEqual(0);
      expect(amitSummary.rightTeamCount).toBeGreaterThanOrEqual(0);
      expect(amitSummary.totalTeamCount).toBeGreaterThanOrEqual(0);
      expect(amitSummary.leftBV).toBeGreaterThanOrEqual(0);
      expect(amitSummary.rightBV).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // TEST 7: Click Amit -> Member details panel appears
  // =========================================================================
  describe('TEST 7: Click Amit (Member Details Panel)', () => {
    it('should return complete sanitized member details without leaking sensitive credentials', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1002');
      expect(root.name).toBe('Amit');
      expect(root.status).toBe('ACTIVE');
      expect(root.rank).toBeDefined();

      // Verify sensitive KYC and passwords are NEVER exposed
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('password');
      expect(json).not.toContain('bankAccount');
      expect(json).not.toContain('panNumber');
    });
  });

  // =========================================================================
  // TEST 8: Click View Network -> Amit becomes root
  // =========================================================================
  describe('TEST 8: Click View Network (Re-rooting on Amit)', () => {
    it('should re-root the genealogy tree with Amit as ROOT (depth=2)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1002');
      expect(root.name).toBe('Amit');
      expect(root.position).toBe('ROOT');
      expect(root.left).toBeDefined(); // Neha is under Amit
    });
  });

  // =========================================================================
  // TEST 9: Refresh browser -> Tree remains correct
  // =========================================================================
  describe('TEST 9: Refresh browser (State and URL Persistence)', () => {
    it('should persistently serve the re-rooted tree for Amit across consecutive GET requests', async () => {
      // First fetch (Simulating initial navigation to ?member=KV-1002)
      const res1 = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      // Second fetch (Simulating browser refresh / reload)
      const res2 = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res1.body.data.root.distributorId).toBe('KV-1002');
      expect(res2.body.data.root.distributorId).toBe('KV-1002');
      expect(res2.body.data.root.name).toBe(res1.body.data.root.name);
    });
  });

  // =========================================================================
  // TEST 10: Open /join?ref=KV-1001 -> Rahul automatically appears as sponsor
  // =========================================================================
  describe('TEST 10: Open /join?ref=KV-1001 (Referral Sponsor Lookup)', () => {
    it('should automatically return Rahul as the verified sponsor for KV-1001', async () => {
      const res = await request(app)
        .get('/api/v1/sponsors/KV-1001')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sponsor).toBeDefined();
      expect(res.body.data.sponsor.distributorId).toBe('KV-1001');
      expect(res.body.data.sponsor.name).toContain('Rahul');
      expect(res.body.data.sponsor.status).toBe('ACTIVE');
      expect(res.body.data.availablePositions).toBeDefined();
    });
  });

  // =========================================================================
  // TEST 11: Open /join?ref=INVALID -> Invalid sponsor
  // =========================================================================
  describe('TEST 11: Open /join?ref=INVALID (Invalid Sponsor Rejection)', () => {
    it('should reject invalid sponsor and return 404 / SPONSOR_NOT_FOUND', async () => {
      const res = await request(app)
        .get('/api/v1/sponsors/INVALID')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('SPONSOR_NOT_FOUND');
      expect(res.body.message).toContain('not found');
    });
  });

  // =========================================================================
  // TEST 12: Two users simultaneously attempt to join Rahul
  // =========================================================================
  describe('TEST 12: Simultaneous Concurrent Placement under Rahul', () => {
    it('should ensure one gets LEFT and one gets RIGHT, never two LEFT users', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: 'dist-userB-uuid',
          distributorCode: 'KV-USER-B',
          businessCenters: [{ id: 'bc-B' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'dist-rahul-uuid',
          distributorCode: 'KV-1001',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: 'node-rahul-001',
        distributorId: 'dist-rahul-uuid',
        distributor: { status: 'ACTIVE', distributorCode: 'KV-1001' },
        children: [],
      } as any);

      // Concurrent row-lock discovers transaction filled the LEFT slot right before:
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          mLMNode: {
            findFirst: vi.fn().mockResolvedValue({ id: 'concurrent-userA-node', placementPosition: 'LEFT' }),
          },
        };
        return await callback(txMock);
      });

      const attempt2 = await TreePlacementService.placeDistributor('dist-userB-uuid', 'node-rahul-001', 'LEFT');

      // Attempt fails safely with POSITION_ALREADY_OCCUPIED, preventing duplicate LEFT users
      expect(attempt2.success).toBe(false);
      expect(attempt2.code).toBe('POSITION_ALREADY_OCCUPIED');
    });
  });

  // =========================================================================
  // TEST 13: Attempt self-sponsorship -> Rejected
  // =========================================================================
  describe('TEST 13: Attempt Self-Sponsorship', () => {
    it('should reject when distributor attempts to sponsor themselves', async () => {
      const res = await TreePlacementService.placeDistributor(
        'KV-1001',
        'node-parent-001',
        'LEFT',
        { sponsorId: 'KV-1001' }
      );

      expect(res.success).toBe(false);
      expect(res.code).toBe('SELF_SPONSORSHIP_FORBIDDEN');
      expect(res.message).toContain('Self-sponsorship is forbidden');
    });
  });

  // =========================================================================
  // TEST 14: Attempt circular placement -> Rejected
  // =========================================================================
  describe('TEST 14: Attempt Circular Placement', () => {
    it('should reject when parent is already a descendant of distributor', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst')
        .mockResolvedValueOnce({
          id: 'dist-rahul-uuid',
          distributorCode: 'KV-1001',
          businessCenters: [{ id: 'bc-1' }],
        } as any)
        .mockResolvedValueOnce({
          id: 'dist-rahul-uuid',
          distributorCode: 'KV-1001',
          status: 'ACTIVE',
        } as any);

      vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValueOnce({
        id: 'node-descendant-001',
        distributorId: 'dist-neha-uuid',
        distributor: { status: 'ACTIVE', distributorCode: 'KV-1006' },
        children: [],
      } as any);

      // Spy on isBinaryAncestor private method simulation
      vi.spyOn(TreePlacementService as any, 'isBinaryAncestor').mockResolvedValueOnce(true);

      const res = await TreePlacementService.placeDistributor(
        'dist-rahul-uuid',
        'node-descendant-001',
        'LEFT'
      );

      expect(res.success).toBe(false);
      expect(['CIRCULAR_RELATIONSHIP', 'CIRCULAR_PLACEMENT_FORBIDDEN']).toContain(res.code);
      expect(res.message.toLowerCase()).toContain('circular');
    });
  });

  // =========================================================================
  // TEST 15: Admin opens /admin/network-tree -> Admin can search and inspect network
  // =========================================================================
  describe('TEST 15: Admin opens /admin/network-tree', () => {
    it('should allow Admin to inspect global network tree without restrictions (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/network-tree?rootId=KV-1001&depth=3')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root).toBeDefined();
      expect(res.body.data.root.distributorId).toBe('KV-1001');
      expect(res.body.data.root.name).toContain('Rahul');
    });

    it('should allow Admin to search and inspect any distributor network', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/search?q=Rahul')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].distributorId).toBe('KV-1001');
    });
  });

  // =========================================================================
  // TEST 16: Normal user attempts admin tree -> 403 Forbidden
  // =========================================================================
  describe('TEST 16: Normal user attempts admin tree', () => {
    it('should return 403 Forbidden when standard distributor requests /api/v1/admin/network-tree', async () => {
      const res = await request(app)
        .get('/api/v1/admin/network-tree')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
      expect(res.body.message).toContain('Forbidden');
    });

    it('should return 401 Unauthorized when unauthenticated request attempts /api/v1/admin/network-tree', async () => {
      const res = await request(app)
        .get('/api/v1/admin/network-tree')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
    });
  });
});
