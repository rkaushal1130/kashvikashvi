/**
 * Test Suite: Clean MLM Tree and Payment-Gated Distributor Activation
 *
 * Requirements:
 * 1. Initial tree: Admin only (no other nodes, no dummy/sample children).
 * 2. Registration without payment: Admin only (new distributor is PENDING, not in tree).
 * 3. Failed payment: Admin only (status remains pending, no placement).
 * 4. Pending payment: Admin only (unpaid order does not place distributor).
 * 5. Verified successful payment: Distributor appears once in the correct position.
 * 6. Duplicate webhook: No duplicate activation or tree node (idempotent).
 * 7. Invalid payment signature: No activation (signature rejected).
 * 8. Existing active paid distributors: Remain correctly connected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { NetworkTreeService } from '../src/services/networkTree.service';
import { AuthService } from '../src/services/auth.service';
import { PaymentService } from '../src/services/payment.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('CLEAN MLM TREE & PAYMENT-GATED ACTIVATION TESTS', { timeout: 35000 }, () => {
  const adminToken = createAdminToken();

  const rahulToken = createTestToken({
    id: 'KV-1001',
    email: 'rahul@kashvimlm.com',
    role: 'ADMIN',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    NetworkTreeService.clearEnrolledMembers();
    PaymentService.clearProcessedWebhookEvents();
  });

  describe('1. Initial Tree State', () => {
    it('should display only the Admin as the root node when there are no fully paid distributors', async () => {
      // In both DB and resilient fallback, initial tree has no children
      const res = await request(app)
        .get('/api/v1/network-tree?depth=3')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root).toBeDefined();
      expect(root.distributorId).toBe('KV-1001');
      expect(root.name).toContain('Rahul');
      expect(root.position).toBe('ROOT');
      expect(root.status).toBe('ACTIVE');

      // Crucial Clean Tree Assertions:
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
      expect(root.children).toEqual([]);
      expect(root.directMembers).toBe(0);
      expect(root.leftTeamCount).toBe(0);
      expect(root.rightTeamCount).toBe(0);
      expect(root.totalTeamCount).toBe(0);
      expect(root.leftBV).toBe(0);
      expect(root.rightBV).toBe(0);
      expect(root.hasChildren).toBe(false);
      expect(root.hasDeeperMembers).toBe(false);
    });
  });

  describe('2. Registration Without Payment', () => {
    it('should create user with PENDING status and keep MLM tree showing Admin only', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'unpaid_distributor@test.com',
          password: 'Password123!',
          fullName: 'Vikram Mehta',
          sponsorId: 'KV-1001',
        })
        .expect(201);

      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.user.status).toBe('PENDING');

      // Tree must still show Admin only
      const treeRes = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const root = treeRes.body.data.root;
      expect(root.distributorId).toBe('KV-1001');
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
      expect(root.children).toEqual([]);
      expect(root.totalTeamCount).toBe(0);
    });
  });

  describe('3. Failed Payment', () => {
    it('should keep user pending and keep MLM tree showing Admin only on failed payment', async () => {
      // 1. Register user
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'failed_pay_user@test.com',
          password: 'Password123!',
          fullName: 'Kunal Joshi',
          sponsorId: 'KV-1001',
        })
        .expect(201);

      const userId = regRes.body.data.user.id;
      const distId = regRes.body.data.user.distributorId;

      // 2. Simulate payment failure webhook
      const webhookPayload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_12345',
              order_id: 'order_failed_12345',
              status: 'failed',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment was declined by bank',
              notes: { userId, distributorId: distId },
            },
          },
        },
      };

      const hookRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'valid_mock_signature')
        .send(webhookPayload);

      expect(hookRes.status).toBe(200);

      // 3. Tree check: Admin only
      const treeRes = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const root = treeRes.body.data.root;
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
      expect(root.children).toEqual([]);
      expect(root.totalTeamCount).toBe(0);
    });
  });

  describe('4. Pending Payment', () => {
    it('should not place user in tree while payment remains pending', async () => {
      // Add a dynamic enrollee with explicit PENDING status
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV-2005',
        name: 'Pending Pay Member',
        status: 'PENDING',
        sponsor: 'KV-1001',
        placementParent: 'KV-1001',
      });

      const treeRes = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const root = treeRes.body.data.root;
      // Pending enrollee must NOT be rendered in Admin tree
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
      expect(root.children).toEqual([]);
      expect(root.totalTeamCount).toBe(0);
    });
  });

  describe('5. Verified Successful Payment', () => {
    it('should activate distributor and place them in the correct position upon verified payment', async () => {
      // 1. Register a distributor
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'paid_distributor@test.com',
          password: 'Password123!',
          fullName: 'Deepika Rao',
          sponsorId: 'KV-1001',
        })
        .expect(201);

      const distCode = regRes.body.data.user.distributorCode;
      const userId = regRes.body.data.user.id;

      // 2. Process verified payment webhook
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_succ_99999',
              order_id: 'order_succ_99999',
              amount: 500000, // 5000 INR
              currency: 'INR',
              status: 'captured',
              notes: {
                userId,
                distributorId: distCode,
              },
            },
          },
        },
      };

      const hookRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'valid_mock_signature')
        .send(webhookPayload)
        .expect(200);

      expect(hookRes.body.received).toBe(true);

      // 3. Tree check: distributor appears connected on designated RIGHT leg
      const treeRes = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const root = treeRes.body.data.root;
      expect(root.right).toBeDefined();
      expect(root.right).not.toBeNull();
      expect(root.right.distributorId).toBe(distCode);
      expect(root.right.status).toBe('ACTIVE');
      expect(root.right.position).toBe('RIGHT');
      expect(root.totalTeamCount).toBe(1);
    }, 35000);
  });

  describe('6. Duplicate Webhook Idempotency', () => {
    it('should ensure duplicate webhook notifications do not create duplicate activations or nodes', async () => {
      const distCode = 'KV-3001';

      // First webhook
      const hookPayload = {
        event: 'order.paid',
        payload: {
          payment: {
            entity: {
              id: 'pay_idem_10001',
              order_id: 'order_idem_10001',
              amount: 100000,
              currency: 'INR',
              status: 'captured',
              notes: { distributorId: distCode },
            },
          },
        },
      };

      await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'valid_mock_signature')
        .send(hookPayload)
        .expect(200);

      // Second identical webhook (duplicate delivery)
      const dupRes = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'valid_mock_signature')
        .send(hookPayload)
        .expect(200);

      expect(dupRes.body.received).toBe(true);

      // Verify tree has only 1 child, not duplicated
      const treeRes = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const root = treeRes.body.data.root;
      expect(root.totalTeamCount).toBe(1);
      expect(root.right.distributorId).toBe(distCode);
      expect(root.right.right).toBeNull();
    });
  });

  describe('7. Invalid Payment Signature', () => {
    it('should reject invalid payment signature and prevent activation', async () => {
      const distCode = 'KV-4001';

      // Register unpaid member
      NetworkTreeService.addEnrolledMember({
        distributorId: distCode,
        name: 'Untrusted Signature User',
        status: 'PENDING',
      });

      const hookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_fake_signature',
              order_id: 'order_fake_signature',
              amount: 500000,
              currency: 'INR',
              status: 'captured',
              notes: { distributorId: distCode },
            },
          },
        },
      };

      // Send with invalid signature
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-razorpay-signature', 'completely_bogus_signature')
        .send(hookPayload);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');

      // Tree must still show Admin only
      const treeRes = await request(app)
        .get('/api/v1/network-tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const root = treeRes.body.data.root;
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
      expect(root.totalTeamCount).toBe(0);
    });
  });

  describe('8. Existing Active Paid Distributors', () => {
    it('should keep existing active, paid distributors correctly connected in valid positions', async () => {
      // Mock existing active database hierarchy
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
            id: 'node-left-uuid',
            placementParentId: 'node-root-uuid',
            placementPosition: 'LEFT',
            depth: 1,
            distributor: {
              id: 'dist-left-uuid',
              distributorId: 'KV-1002',
              firstName: 'Amit',
              status: 'ACTIVE',
              currentRank: { name: 'Executive Director' },
            },
          },
          {
            id: 'node-right-uuid',
            placementParentId: 'node-root-uuid',
            placementPosition: 'RIGHT',
            depth: 1,
            distributor: {
              id: 'dist-right-uuid',
              distributorId: 'KV-1003',
              firstName: 'Rohit',
              status: 'ACTIVE',
              currentRank: { name: 'Senior Director' },
            },
          },
        ] as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const treeRes = await request(app)
        .get('/api/v1/network-tree?depth=3')
        .set('Authorization', `Bearer ${rahulToken}`)
        .expect(200);

      expect(treeRes.body.success).toBe(true);
      const root = treeRes.body.data.root;
      expect(root.distributorId).toBe('KV-1001');

      // Both active paid children remain connected
      expect(root.left).toBeDefined();
      expect(root.left.distributorId).toBe('KV-1002');
      expect(root.left.status).toBe('ACTIVE');
      expect(root.left.position).toBe('LEFT');

      expect(root.right).toBeDefined();
      expect(root.right.distributorId).toBe('KV-1003');
      expect(root.right.status).toBe('ACTIVE');
      expect(root.right.position).toBe('RIGHT');

      expect(root.children.length).toBe(2);
      expect(root.totalTeamCount).toBe(2);
    });
  });
});
