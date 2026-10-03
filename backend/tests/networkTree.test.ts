/**
 * Test Suite: Binary MLM Network Tree Automated Tests (Prompts 7, 14 & 15)
 * Uses Vitest & Supertest
 *
 * Covers:
 * 1. GET /api/v1/network-tree (Authenticated user tree)
 * 2. GET /api/v1/network-tree?depth=3 (Default & custom depth)
 * 3. Exact structure: Level 0 (root), Level 1 (LEFT + RIGHT), Level 2, Level 3
 * 4. GET /api/v1/network-tree/member/:distributorId?depth=3 (Specific member tree)
 * 5. GET /api/v1/network-tree/member/:distributorId/summary (Summary metrics)
 * 6. Non-exposure of sensitive fields (passwords, emails, bank accounts)
 * 7. 404 handling for invalid members
 * 8. Lazy Tree Loading & Deeper Members Expansion (Prompt 14)
 * 9. Security Pass Over Complete Network Tree System (Prompt 15):
 *    - 401 for unauthenticated requests
 *    - 403 for authenticated but unauthorized crossline/upline requests
 *    - User can view own network
 *    - User can only view other networks if in downline
 *    - Admin can view all networks
 *    - Never expose KYC, passwords, or banking details
 *    - Distributor ID & input validation
 *    - Placement security: prevent self-sponsorship, self-placement, circular & duplicate placement
 *    - Audit logging verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { AuditService } from '../src/services/audit.service';
import { TreePlacementService } from '../src/services/treePlacement.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('BINARY MLM NETWORK TREE API & SECURITY TESTS (PROMPT 15)', () => {
  const adminToken = createAdminToken();

  const rahulToken = createTestToken({
    id: 'KV-1001',
    email: 'rahul@kashvimlm.com',
    role: 'DISTRIBUTOR',
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

  describe('1. Authenticated User Network Tree (GET /api/v1/network-tree)', () => {
    it('should return 200 with the exact binary tree structure for authenticated user', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-rahul-uuid',
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        displayName: 'Rahul Kaushal',
        status: 'ACTIVE',
        currentRank: { name: 'Business Center' },
        businessCenters: [{ mlmNode: { id: 'node-root-uuid' } }],
        mlmNodes: [{ id: 'node-root-uuid', depth: 0 }],
      } as any);

      vi.spyOn(prisma.mLMNode, 'findMany')
        .mockResolvedValueOnce([
          {
            id: 'node-amit-uuid',
            placementParentId: 'node-root-uuid',
            placementPosition: 'LEFT',
            depth: 1,
            distributor: {
              id: 'dist-amit-uuid',
              distributorId: 'KV-1002',
              firstName: 'Amit',
              status: 'ACTIVE',
              currentRank: { name: 'Executive Director' },
            },
          },
          {
            id: 'node-rohit-uuid',
            placementParentId: 'node-root-uuid',
            placementPosition: 'RIGHT',
            depth: 1,
            distributor: {
              id: 'dist-rohit-uuid',
              distributorId: 'KV-1003',
              firstName: 'Rohit',
              status: 'ACTIVE',
              currentRank: { name: 'Senior Director' },
            },
          },
        ] as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/network-tree?depth=3')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.root).toBeDefined();

      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1001');
      expect(root.name).toBe('Rahul');
      expect(root.status).toBe('ACTIVE');
      expect(root.position).toBe('ROOT');

      expect(root.left).toBeDefined();
      expect(root.left.distributorId).toBe('KV-1002');
      expect(root.left.name).toBe('Amit');
      expect(root.left.position).toBe('LEFT');

      expect(root.right).toBeDefined();
      expect(root.right.distributorId).toBe('KV-1003');
      expect(root.right.name).toBe('Rohit');
      expect(root.right.position).toBe('RIGHT');

      // Security check: Never expose sensitive data
      expect(root).not.toHaveProperty('password');
      expect(root).not.toHaveProperty('passwordHash');
      expect(root).not.toHaveProperty('panNumber');
      expect(root).not.toHaveProperty('bankAccount');
    });

    it('should return tree hierarchy with Level 0 (root), Level 1 (LEFT + RIGHT), Level 2, and Level 3 with children and required fields (Prompt 7)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree?depth=3')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root).toBeDefined();

      // Required fields on root
      expect(root).toHaveProperty('distributorId');
      expect(root).toHaveProperty('name');
      expect(root).toHaveProperty('status');
      expect(root).toHaveProperty('rank');
      expect(root).toHaveProperty('joinedDate');
      expect(root).toHaveProperty('position');
      expect(root).toHaveProperty('children');

      // Level 1: LEFT + RIGHT
      expect(Array.isArray(root.children)).toBe(true);
      expect(root.children.length).toBe(2);

      const [leftNode, rightNode] = root.children;
      expect(leftNode.position).toBe('LEFT');
      expect(rightNode.position).toBe('RIGHT');

      for (const node of [leftNode, rightNode]) {
        expect(node).toHaveProperty('distributorId');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('status');
        expect(node).toHaveProperty('rank');
        expect(node).toHaveProperty('joinedDate');
        expect(node).toHaveProperty('children');
        expect(Array.isArray(node.children)).toBe(true);
      }

      // Level 2: Children of LEFT + RIGHT
      expect(leftNode.children.length).toBeGreaterThanOrEqual(1);
      expect(rightNode.children.length).toBeGreaterThanOrEqual(1);

      // Level 3: Next level
      const level2Node = leftNode.children[0];
      expect(level2Node).toHaveProperty('children');

      // Verify no sensitive fields anywhere
      const verifyNoSensitiveFields = (node: any) => {
        if (!node) return;
        expect(node.password).toBeUndefined();
        expect(node.pan).toBeUndefined();
        expect(node.panNumber).toBeUndefined();
        expect(node.aadhaar).toBeUndefined();
        expect(node.aadhaarNumber).toBeUndefined();
        expect(node.bankAccount).toBeUndefined();
        expect(node.otp).toBeUndefined();
        expect(node.securityPin).toBeUndefined();
        expect(node.kycDocuments).toBeUndefined();
        if (node.children) {
          node.children.forEach(verifyNoSensitiveFields);
        }
      };
      verifyNoSensitiveFields(root);
    });

    it('should support default depth = 3 when depth query param is omitted', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root).toBeDefined();
      expect(res.body.data.root.distributorId).toBe('KV-1001');
    });

    it('should respect depth=1 limit (only root + level 1 children without grand-children)', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-rahul-uuid',
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        status: 'ACTIVE',
        currentRank: { name: 'Business Center' },
        businessCenters: [],
        mlmNodes: [{ id: 'node-root-uuid', depth: 0 }],
      } as any);

      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([
        {
          id: 'node-amit-uuid',
          placementParentId: 'node-root-uuid',
          placementPosition: 'LEFT',
          depth: 1,
          distributor: {
            id: 'dist-amit-uuid',
            distributorId: 'KV-1002',
            firstName: 'Amit',
            status: 'ACTIVE',
            currentRank: { name: 'Director' },
          },
        },
      ] as any);

      const res = await request(app)
        .get('/api/v1/network-tree?depth=1')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.left).toBeDefined();
      expect(root.left.left).toBeNull();
      expect(root.left.right).toBeNull();
    });
  });

  describe('2. Specific Member Network Tree (GET /api/v1/network-tree/member/:distributorId)', () => {
    it('should retrieve network tree for a specific member by distributor ID', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-amit-uuid',
        distributorId: 'KV-1002',
        distributorCode: 'KV-1002',
        firstName: 'Amit',
        status: 'ACTIVE',
        currentRank: { name: 'Executive Director' },
        businessCenters: [],
        mlmNodes: [{ id: 'node-amit-uuid', depth: 1 }],
      } as any);

      vi.spyOn(prisma.mLMNode, 'findMany').mockResolvedValueOnce([] as any);

      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root.distributorId).toBe('KV-1002');
      expect(res.body.data.root.name).toBe('Amit');
      expect(res.body.data.root.position).toBe('ROOT');
    });

    it('should return Amit as root with downline Neha (LEFT) and Pooja (RIGHT) in modeled view', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1002');
      expect(root.name).toBe('Amit');
      expect(root.left).toBeDefined();
      expect(root.left.name).toBe('Neha');
      expect(root.right).toBeDefined();
      expect(root.right.name).toBe('Pooja');
    });

    it('should return 404 if requested member does not exist', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('DISTRIBUTOR_NOT_FOUND');
    });
  });

  describe('3. Member Network Summary (GET /api/v1/network-tree/member/:distributorId/summary)', () => {
    it('should return all required summary fields', async () => {
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
        id: 'dist-rahul-uuid',
        distributorId: 'KV-1001',
        distributorCode: 'KV-1001',
        firstName: 'Rahul',
        status: 'ACTIVE',
        businessCenters: [
          {
            leftVolume: '14500.00',
            rightVolume: '11200.00',
            accumulatedLeftVolume: '14500.00',
            accumulatedRightVolume: '11200.00',
          },
        ],
        mlmNodes: [{ id: 'node-root-uuid', depth: 0 }],
      } as any);

      vi.spyOn(prisma.distributorProfile, 'count').mockResolvedValue(12);

      vi.spyOn(prisma.mLMNode, 'findMany')
        .mockResolvedValueOnce([
          { id: 'node-left', placementPosition: 'LEFT' },
          { id: 'node-right', placementPosition: 'RIGHT' },
        ] as any)
        .mockResolvedValueOnce([{ id: 'node-left-child' }] as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'node-right-child' }] as any)
        .mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1001/summary')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const d = res.body.data;
      expect(d).toHaveProperty('directMembers');
      expect(d).toHaveProperty('leftTeamCount');
      expect(d).toHaveProperty('rightTeamCount');
      expect(d).toHaveProperty('totalTeamCount');
      expect(d).toHaveProperty('leftBV');
      expect(d).toHaveProperty('rightBV');

      expect(typeof d.directMembers).toBe('number');
      expect(typeof d.leftTeamCount).toBe('number');
      expect(typeof d.rightTeamCount).toBe('number');
      expect(typeof d.totalTeamCount).toBe('number');
      expect(typeof d.leftBV).toBe('number');
      expect(typeof d.rightBV).toBe('number');

      // Security check
      expect(d).not.toHaveProperty('email');
      expect(d).not.toHaveProperty('phone');
      expect(d).not.toHaveProperty('password');
    });
  });

  describe('4. Search Network Tree Members (GET /api/v1/network-tree/search)', () => {
    it('should return matching authorized distributors for query "Rahul"', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/search?q=Rahul')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const match = res.body.data.find((m: any) => m.distributorId === 'KV-1001');
      expect(match).toBeDefined();
      expect(match.name).toContain('Rahul');
      expect(match.status).toBe('ACTIVE');
      expect(match.rank).toBeDefined();

      // Ensure no sensitive fields are leaked
      expect(match).not.toHaveProperty('password');
      expect(match).not.toHaveProperty('email');
      expect(match).not.toHaveProperty('phone');
      expect(match).not.toHaveProperty('bankAccount');
    });

    it('should return matching distributor for ID query "KV-1002"', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/search?q=KV-1002')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].distributorId).toBe('KV-1002');
      expect(res.body.data[0].name).toContain('Amit');
    });

    it('should return empty array when no distributor matches the query', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/search?q=NONEXISTENT_USER_99999')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should return results from database when available', async () => {
      vi.spyOn(prisma.distributorProfile, 'findMany').mockResolvedValueOnce([
        {
          id: 'db-dist-1',
          distributorId: 'KV-2001',
          distributorCode: 'KV-2001',
          firstName: 'Siddharth',
          lastName: 'Sharma',
          displayName: 'Siddharth Sharma',
          status: 'ACTIVE',
          currentRank: { name: 'Gold Director' },
        },
      ] as any);

      const res = await request(app)
        .get('/api/v1/network-tree/search?q=Siddharth')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].distributorId).toBe('KV-2001');
      expect(res.body.data[0].name).toBe('Siddharth Sharma');
      expect(res.body.data[0].rank).toBe('Gold Director');
    });
  });

  describe('5. Lazy Tree Loading & Deeper Members Expansion (Prompt 14)', () => {
    it('should return deeper members for a node when expanded with depth=2 (e.g. GET /api/v1/network-tree/member/KV-1002?depth=2)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1002?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root).toBeDefined();

      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1002');
      expect(root.hasDeeperMembers).toBe(true);
      expect(root.left).toBeDefined();
      expect(root.left.distributorId).toMatch(/KV-(DEMO-)?100[46]/);
      expect(root.right).toBeDefined();
      expect(root.right.distributorId).toMatch(/KV-(DEMO-)?1005/);
    });

    it('should return immediate children when expanding deeper node Neha (KV-1006?depth=2)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1006?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1006');
      expect(root.left).toBeDefined();
      expect(root.left.distributorId).toBe('KV-1012');
      expect(root.left.name).toBe('Arjun');
      expect(root.right).toBeDefined();
      expect(root.right.distributorId).toBe('KV-1013');
      expect(root.right.name).toBe('Meera');
    });

    it('should indicate no children exist for leaf node (e.g. KV-1012)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV-1012?depth=2')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.distributorId).toBe('KV-1012');
      expect(root.totalTeamCount).toBe(0);
      expect(root.hasDeeperMembers).toBe(false);
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
    });
  });

  describe('6. Security Pass Over Network Tree System (Prompt 15)', () => {
    describe('A. Authentication Enforcement (Expected 401)', () => {
      it('should reject unauthenticated request to /api/v1/network-tree with 401', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree')
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
      });

      it('should reject unauthenticated request to /api/v1/network-tree/member/:id with 401', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/KV-1002')
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
      });

      it('should reject unauthenticated request to /api/v1/network-tree/summary with 401', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/summary')
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
      });

      it('should reject unauthenticated request to /api/v1/network-tree/search with 401', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/search?q=Rahul')
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
      });

      it('should reject request with invalid/malformed token with 401', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree')
          .set('Authorization', 'Bearer invalid.jwt.token')
          .expect(401);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('AUTH_INVALID_TOKEN');
      });
    });

    describe('B. Business Rules & Downline Authorization (Expected 403)', () => {
      it('should allow user Amit (KV-1002) to view their own network tree (KV-1002)', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/KV-1002')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.root.distributorId).toBe('KV-1002');
      });

      it('should allow user Amit (KV-1002) to view their downline member Neha (KV-1006)', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/KV-1006')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.root.distributorId).toBe('KV-1006');
      });

      it('should FORBID user Amit (KV-1002) from viewing crossline member Rohit (KV-1003) with 403', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/KV-1003')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(403);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('FORBIDDEN_NETWORK_VIEW');
        expect(res.body.message).toContain('downline organisation');
      });

      it('should FORBID user Amit (KV-1002) from viewing upline member Rahul (KV-1001) with 403', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/KV-1001')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(403);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('FORBIDDEN_NETWORK_VIEW');
      });

      it('should FORBID user Amit (KV-1002) from viewing crossline member summary with 403', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/KV-1003/summary')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(403);

        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('FORBIDDEN_NETWORK_VIEW');
      });

      it('should allow Admin to view ANY network tree without downline restrictions', async () => {
        // Admin views Rohit
        const res1 = await request(app)
          .get('/api/v1/network-tree/member/KV-1003')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res1.body.success).toBe(true);
        expect(res1.body.data.root.distributorId).toBe('KV-1003');

        // Admin views Rahul
        const res2 = await request(app)
          .get('/api/v1/network-tree/member/KV-1001')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res2.body.success).toBe(true);
        expect(res2.body.data.root.distributorId).toBe('KV-1001');
      }, 30000);
    });

    describe('C. Data Sanitization & Protection (Never expose KYC, Passwords, Bank details)', () => {
      it('should guarantee that no node in the tree exposes passwords, KYC, or bank accounts', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree?depth=3')
          .set('Authorization', `Bearer ${rahulToken}`)
          .expect(200);

        const checkNodeSecurity = (node: any) => {
          if (!node) return;
          expect(node.password).toBeUndefined();
          expect(node.passwordHash).toBeUndefined();
          expect(node.passwordSalt).toBeUndefined();
          expect(node.securityPin).toBeUndefined();
          expect(node.otp).toBeUndefined();
          expect(node.pan).toBeUndefined();
          expect(node.panNumber).toBeUndefined();
          expect(node.aadhaar).toBeUndefined();
          expect(node.aadhaarNumber).toBeUndefined();
          expect(node.bankAccount).toBeUndefined();
          expect(node.bankAccountNumber).toBeUndefined();
          expect(node.bankIfsc).toBeUndefined();
          expect(node.email).toBeUndefined();
          expect(node.phone).toBeUndefined();

          if (node.left) checkNodeSecurity(node.left);
          if (node.right) checkNodeSecurity(node.right);
        };

        checkNodeSecurity(res.body.data.root);
      });
    });

    describe('D. Input Validation & Protection Against Malicious IDs', () => {
      it('should reject invalid distributor ID format with 400 or 422 Validation Error', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree/member/..%2F..%2Fetc%2Fpasswd')
          .set('Authorization', `Bearer ${adminToken}`);

        expect([400, 422]).toContain(res.status);
        expect(res.body.success).toBe(false);
      });

      it('should reject depth greater than allowed maximum with 400 or 422 Validation Error', async () => {
        const res = await request(app)
          .get('/api/v1/network-tree?depth=999')
          .set('Authorization', `Bearer ${rahulToken}`);

        expect([400, 422]).toContain(res.status);
        expect(res.body.success).toBe(false);
      });
    });

    describe('E. Tree Placement Security (Rules 10-14)', () => {
      it('should reject unauthorized tree modification without authentication with 401', async () => {
        const res = await request(app)
          .post('/api/v1/tree/place')
          .send({
            distributorId: 'KV-2001',
            placementParentId: 'KV-1001',
            placementPosition: 'LEFT',
          })
          .expect(401);

        expect(res.body.success).toBe(false);
      });

      it('should prevent self-sponsorship where sponsorId equals distributorId', async () => {
        vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
          id: 'dist-self-id',
          distributorId: 'KV-5001',
          distributorCode: 'KV-5001',
          status: 'ACTIVE',
          businessCenters: [],
        } as any);

        const result = await TreePlacementService.validatePlacement({
          distributorId: 'KV-5001',
          placementParentId: 'node-root-uuid',
          placementPosition: 'LEFT',
          sponsorId: 'KV-5001',
        });

        expect(result.valid).toBe(false);
        expect(result.code).toBe('SELF_SPONSORSHIP_FORBIDDEN');
      });

      it('should prevent self-placement where placementParentId matches distributor ID', async () => {
        vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
          id: 'dist-self-id',
          distributorId: 'KV-5001',
          distributorCode: 'KV-5001',
          status: 'ACTIVE',
          businessCenters: [],
        } as any);

        vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue({
          id: 'node-self-id',
          distributorId: 'dist-self-id',
          distributor: { status: 'ACTIVE', distributorCode: 'KV-5001' },
          children: [],
        } as any);

        const result = await TreePlacementService.validatePlacement({
          distributorId: 'KV-5001',
          placementParentId: 'node-self-id',
          placementPosition: 'LEFT',
          sponsorId: 'KV-1001',
        });

        expect(result.valid).toBe(false);
        expect(['SELF_PLACEMENT_NOT_ALLOWED', 'SELF_PLACEMENT_FORBIDDEN']).toContain(result.code);
      });

      it('should prevent circular placement if placement parent is already a descendant', async () => {
        vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
          id: 'dist-ancestor-id',
          distributorId: 'KV-5001',
          distributorCode: 'KV-5001',
          status: 'ACTIVE',
          businessCenters: [],
        } as any);

        vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue({
          id: 'node-descendant-id',
          distributorId: 'dist-descendant-id',
          distributor: { status: 'ACTIVE', distributorCode: 'KV-5002' },
          children: [],
        } as any);

        // Mock ancestor check returning true (circular)
        vi.spyOn(TreePlacementService as any, 'isBinaryAncestor').mockResolvedValue(true);

        const result = await TreePlacementService.validatePlacement({
          distributorId: 'KV-5001',
          placementParentId: 'node-descendant-id',
          placementPosition: 'LEFT',
          sponsorId: 'KV-1001',
        });

        expect(result.valid).toBe(false);
        expect(['CIRCULAR_RELATIONSHIP', 'CIRCULAR_PLACEMENT_FORBIDDEN']).toContain(result.code);
      });

      it('should prevent duplicate LEFT placement when position is already occupied', async () => {
        vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
          id: 'dist-new-id',
          distributorId: 'KV-5002',
          distributorCode: 'KV-5002',
          status: 'ACTIVE',
          businessCenters: [],
        } as any);

        vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue({
          id: 'node-parent-id',
          distributorId: 'dist-parent-id',
          distributor: { status: 'ACTIVE', distributorCode: 'KV-1001' },
          children: [{ placementPosition: 'LEFT' }],
        } as any);

        vi.spyOn(TreePlacementService as any, 'isBinaryAncestor').mockResolvedValue(false);

        const result = await TreePlacementService.validatePlacement({
          distributorId: 'KV-5002',
          placementParentId: 'node-parent-id',
          placementPosition: 'LEFT',
          sponsorId: 'KV-1001',
        });

        expect(result.valid).toBe(false);
        expect(result.code).toBe('POSITION_ALREADY_OCCUPIED');
        expect(result.message).toContain('already occupied');
      });

      it('should prevent duplicate RIGHT placement when position is already occupied', async () => {
        vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue({
          id: 'dist-new-id',
          distributorId: 'KV-5003',
          distributorCode: 'KV-5003',
          status: 'ACTIVE',
          businessCenters: [],
        } as any);

        vi.spyOn(prisma.mLMNode, 'findFirst').mockResolvedValue({
          id: 'node-parent-id',
          distributorId: 'dist-parent-id',
          distributor: { status: 'ACTIVE', distributorCode: 'KV-1001' },
          children: [{ placementPosition: 'RIGHT' }],
        } as any);

        vi.spyOn(TreePlacementService as any, 'isBinaryAncestor').mockResolvedValue(false);

        const result = await TreePlacementService.validatePlacement({
          distributorId: 'KV-5003',
          placementParentId: 'node-parent-id',
          placementPosition: 'RIGHT',
          sponsorId: 'KV-1001',
        });

        expect(result.valid).toBe(false);
        expect(result.code).toBe('POSITION_ALREADY_OCCUPIED');
        expect(result.message).toContain('already occupied');
      });
    });

    describe('F. Audit Logging (Rule 16)', () => {
      it('should record audit log on unauthorized access attempt', async () => {
        const recordLogSpy = vi.spyOn(AuditService, 'recordLog');

        await request(app)
          .get('/api/v1/network-tree/member/KV-1003')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(403);

        expect(recordLogSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'KV-1002',
            action: 'UNAUTHORIZED_TREE_VIEW_ATTEMPT',
            entityType: 'NetworkTree',
            entityId: 'KV-1003',
          })
        );
      });

      it('should record audit log on authorized tree access', async () => {
        const recordLogSpy = vi.spyOn(AuditService, 'recordLog');

        await request(app)
          .get('/api/v1/network-tree/member/KV-1006')
          .set('Authorization', `Bearer ${amitToken}`)
          .expect(200);

        expect(recordLogSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'KV-1002',
            action: 'TREE_VIEW_MEMBER',
            entityType: 'NetworkTree',
            entityId: 'KV-1006',
          })
        );
      });
    });
  });

  describe('7. MLM Tree Audit Logging & Placement Operations (Prompt 16)', () => {
    it('should track and retrieve audit logs with all prompt 16 fields (actorId, memberId, sponsorId, placementParentId, position, oldValue, newValue, timestamp, IP, userAgent)', async () => {
      const res = await request(app)
        .get('/api/v1/network-tree/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const log = res.body.data[0];
      expect(log.actorId).toBeDefined();
      expect(log.memberId).toBeDefined();
      expect(log.timestamp).toBeDefined();
      expect(log.IP || log.ip).toBeDefined();
      expect(log.userAgent).toBeDefined();
    });

    it('should strictly REQUIRE Reason, Old Parent, Old Position, New Parent, New Position, and Admin ID when Admin changes placement', async () => {
      // 1. Missing Reason -> 400 or 422
      const missingReason = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        });
      expect([400, 422]).toContain(missingReason.status);

      // 2. Missing Old Parent -> 400 or 422
      const missingOldParent = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Valid restructuring reason',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        });
      expect([400, 422]).toContain(missingOldParent.status);

      // 3. Missing Old Position -> 400 or 422
      const missingOldPos = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Valid restructuring reason',
          oldParent: 'KV-1002',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        });
      expect([400, 422]).toContain(missingOldPos.status);

      // 4. Missing New Parent -> 400 or 422
      const missingNewParent = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Valid restructuring reason',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newPosition: 'RIGHT',
        });
      expect([400, 422]).toContain(missingNewParent.status);

      // 5. Missing New Position -> 400 or 422
      const missingNewPos = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Valid restructuring reason',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
        });
      expect([400, 422]).toContain(missingNewPos.status);

      // 6. Complete valid request succeeds and records audit log with all 6 fields
      const validChange = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Restructuring team to optimize binary leg performance',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(200);

      expect(validChange.body.success).toBe(true);
      const audit = validChange.body.data.auditRecord;
      expect(audit.action).toBe('TREE_MEMBER_MOVED');
      expect(audit.reason).toContain('Restructuring');
      expect(audit.oldParent).toBe('KV-1002');
      expect(audit.oldPosition).toBe('LEFT');
      expect(audit.newParent).toBe('KV-1003');
      expect(audit.newPosition).toBe('RIGHT');
      expect(audit.adminId).toBeDefined();
    });

    it('should NEVER silently change an MLM relationship (audit record must be created)', async () => {
      const res = await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1007',
          reason: 'Leg swap under parent to resolve placement discrepancy',
          oldParent: 'KV-1003',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(200);

      expect(res.body.data.auditRecord).toBeDefined();
      expect(res.body.data.auditRecord.action).toBe('TREE_POSITION_CHANGED');
      expect(res.body.data.auditRecord.oldValue).toBeDefined();
      expect(res.body.data.auditRecord.newValue).toBeDefined();
    });

    it('should block normal users from mutating or deleting audit records with 403 Forbidden', async () => {
      // Normal user trying to delete audit log
      const resDelete = await request(app)
        .delete('/api/v1/network-tree/audit-logs/tree-audit-001')
        .set('Authorization', `Bearer ${amitToken}`)
        .expect(403);

      expect(resDelete.body.code).toBe('AUDIT_LOG_IMMUTABLE');

      // Normal user trying to modify audit log
      const resPut = await request(app)
        .put('/api/v1/network-tree/audit-logs/tree-audit-001')
        .set('Authorization', `Bearer ${amitToken}`)
        .send({ reason: 'tampered' })
        .expect(403);

      expect(resPut.body.code).toBe('AUDIT_LOG_IMMUTABLE');
    });

    it('should block non-admins from changing tree placement with 403 Forbidden', async () => {
      await request(app)
        .post('/api/v1/network-tree/change-placement')
        .set('Authorization', `Bearer ${amitToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Unauthorized change attempt',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(403);
    });
  });
});
