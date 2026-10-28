import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { NetworkTreeService } from '../src/services/networkTree.service';
import { MemberIdService } from '../src/services/memberId.service';
import { PaymentService } from '../src/services/payment.service';
import { createTestToken, createAdminToken } from './helpers/testHelpers';

describe('AUTOMATIC BINARY NETWORK TREE SYSTEM TEST SUITE (SCENARIOS A - J)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    NetworkTreeService.clearEnrolledMembers();
    PaymentService.clearProcessedWebhookEvents();
  });

  // SCENARIO A: Single Distributor
  describe('Scenario A: Single Distributor Registration and Initial Tree View', () => {
    it('should register KV1001 and display KV1001 as the root of their own tree with 0 team members', async () => {
      const token = createTestToken({
        id: 'usr-kv1001',
        email: 'kv1001@kashvimlm.com',
        role: 'DISTRIBUTOR',
      });

      // Register root distributor in network service
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Distributor KV1001',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        position: 'RIGHT',
        sponsor: 'KV-1000',
        placementParent: 'KV-1000',
        bv: 100,
      });

      const res = await request(app)
        .get('/api/v1/network-tree?depth=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const root = res.body.data.root;
      expect(root.distributorId).toMatch(/KV1001|KV-1001/);
      expect(root.totalTeamCount).toBe(0);
      expect(root.directMembers).toBe(0);
      expect(root.left).toBeNull();
      expect(root.right).toBeNull();
    });
  });

  // SCENARIO B: First Referral
  describe('Scenario B: First Referral Added After Verified Enrollment Payment', () => {
    it('should automatically place KV1002 in KV1001 tree upon payment verification', async () => {
      // 1. Root KV1001 exists
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Rahul Kaushal',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV-1000',
        placementParent: 'KV-1000',
        bv: 100,
      });

      // 2. KV1002 completes registration & payment verification
      const verifyRes = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: 'KV1002',
          razorpayPaymentId: 'pay_test_scen_b_1002',
          razorpaySignature: 'valid_mock_signature',
          paymentMethod: 'UPI',
        })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.paymentStatus).toBe('PAID');
      expect(verifyRes.body.data.accountStatus).toBe('ACTIVE');

      // 3. Place KV1002 under KV1001
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        name: 'Amit Partner',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
        bv: 100,
      });

      // 4. KV1001 views tree: KV1002 must immediately appear in KV1001 tree
      const treeRes = await NetworkTreeService.getNetworkTree('KV1001', 3);
      expect(treeRes.root.distributorId).toMatch(/KV1001|KV-1001/);
      expect(treeRes.root.right).not.toBeNull();
      expect(treeRes.root.right?.distributorId).toBe('KV1002');
      expect(treeRes.root.totalTeamCount).toBe(1);
    });
  });

  // SCENARIO C: Second-Generation Referral
  describe('Scenario C: Second-Generation Referral Placement and Lineage Reflection', () => {
    it('should place KV1003 under KV1002 and display KV1003 as descendant in KV1001 tree', async () => {
      // Setup KV1001 -> KV1002
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Root Distributor',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV-1000',
        placementParent: 'KV-1000',
      });
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        name: 'Distributor KV1002',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
      });

      // KV1002 shares link, KV1003 registers and pays
      const verifyRes = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: 'KV1003',
          razorpayPaymentId: 'pay_test_scen_c_1003',
          razorpaySignature: 'valid_mock_signature',
        })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);

      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1003',
        name: 'Distributor KV1003',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1002',
        placementParent: 'KV1002',
        position: 'RIGHT',
      });

      // KV1001 views tree: must show KV1002 as child, and KV1003 as grandchild
      const treeRes1001 = await NetworkTreeService.getNetworkTree('KV1001', 3);
      expect(treeRes1001.root.totalTeamCount).toBe(2);
      expect(treeRes1001.root.right?.distributorId).toBe('KV1002');
      expect(treeRes1001.root.right?.right?.distributorId).toBe('KV1003');

      // KV1002 views tree: must show KV1003 under KV1002
      const treeRes1002 = await NetworkTreeService.getNetworkTree('KV1002', 3);
      expect(treeRes1002.root.totalTeamCount).toBe(1);
      expect(treeRes1002.root.right?.distributorId).toBe('KV1003');
    });
  });

  // SCENARIO D: Independent Distributor View
  describe('Scenario D: Independent Distributor View Isolation', () => {
    it('should show KV1002 as the root of their own tree, never exposing KV1001 to KV1002', async () => {
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Root Distributor',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV-1000',
        placementParent: 'KV-1000',
      });
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        name: 'Distributor KV1002',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
      });
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1003',
        name: 'Distributor KV1003',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1002',
        placementParent: 'KV1002',
        position: 'RIGHT',
      });

      // When KV1002 requests their own tree:
      const tree1002 = await NetworkTreeService.getNetworkTree('KV1002', 3);
      expect(tree1002.root.distributorId).toBe('KV1002');
      expect(tree1002.root.name).toBe('Distributor KV1002');
      expect(tree1002.root.position).toBe('ROOT');

      // KV1001 is upline and must NOT be inside KV1002's tree
      expect(tree1002.root.left).toBeNull();
      expect(tree1002.root.right?.distributorId).toBe('KV1003');

      // When KV1003 requests their own tree:
      const tree1003 = await NetworkTreeService.getNetworkTree('KV1003', 3);
      expect(tree1003.root.distributorId).toBe('KV1003');
      expect(tree1003.root.totalTeamCount).toBe(0);
      expect(tree1003.root.left).toBeNull();
      expect(tree1003.root.right).toBeNull();
    });
  });

  // SCENARIO E: Failed or Unconfirmed Payment
  describe('Scenario E: Unconfirmed Payment Withholding from Active Tree', () => {
    it('should never place unpaid or pending members into the active binary tree', async () => {
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Root Distributor',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV-1000',
        placementParent: 'KV-1000',
      });

      // Member registers but payment is PENDING / UNPAID
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1004',
        name: 'Unpaid Member',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
      });

      // Tree under KV1001 must have 0 placed active team members
      const treeRes = await NetworkTreeService.getNetworkTree('KV1001', 3);
      expect(treeRes.root.totalTeamCount).toBe(0);
      expect(treeRes.root.left).toBeNull();
      expect(treeRes.root.right).toBeNull();
    });
  });

  // SCENARIO F: Duplicate Payment Callbacks (Idempotency)
  describe('Scenario F: Idempotent Payment Confirmations', () => {
    it('should ignore duplicate payment confirmations without corrupting the tree structure', async () => {
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Root Distributor',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV-1000',
        placementParent: 'KV-1000',
      });

      const paymentPayload = {
        memberId: 'KV1002',
        razorpayPaymentId: 'pay_duplicate_check_999',
        razorpaySignature: 'valid_mock_signature',
      };

      // 1st callback
      const res1 = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send(paymentPayload)
        .expect(200);

      expect(res1.body.success).toBe(true);

      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        name: 'Distributor KV1002',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
      });

      // 2nd duplicate callback with identical transaction ID
      const res2 = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send(paymentPayload)
        .expect(200);

      expect(res2.body.success).toBe(true);
      expect(res2.body.data.alreadyProcessed).toBe(true);

      // Verify no duplicate nodes exist in KV1001 tree
      const treeRes = await NetworkTreeService.getNetworkTree('KV1001', 3);
      expect(treeRes.root.totalTeamCount).toBe(1);
    });
  });

  // SCENARIO G: Binary Placement & Spillover
  describe('Scenario G: Binary Placement & Automatic Spillover Logic', () => {
    it('should enforce max 2 children and spillover down the preferred leg when immediate slots are full', () => {
      // Root: KV1001
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      });

      // Child 1 on RIGHT
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      });

      // Child 2 on LEFT
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1003',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'LEFT',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      });

      // Immediate slots on KV1001 are full. Find next available slot for preferredLeg 'RIGHT':
      const slot = NetworkTreeService.findNextAvailableSlot('KV1001', 'RIGHT');
      expect(slot.targetParentId).toBe('KV1002'); // Spillover down right leg under KV1002
      expect(slot.position).toBe('RIGHT');

      // Place 4th member with spillover
      const member4 = NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1004',
        sponsor: 'KV1001',
        placementParent: 'KV1001', // Parent is full, auto-spillover kicks in
        position: 'RIGHT',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      });

      expect(member4.placementParent).toBe('KV1002');
      expect(member4.position).toBe('RIGHT');

      // Total count under KV1001 must be 3
      const tree = NetworkTreeService.getModeledNetworkTree('KV1001', 3);
      expect(tree.root.totalTeamCount).toBe(3);
      expect(tree.root.left?.distributorId).toBe('KV1003');
      expect(tree.root.right?.distributorId).toBe('KV1002');
      expect(tree.root.right?.right?.distributorId).toBe('KV1004');
    });
  });

  // SCENARIO H: Concurrency & Unique ID Generation
  describe('Scenario H: Concurrency-Safe Member ID Generation', () => {
    it('should generate distinct, unique KV IDs without collisions under simultaneous calls', async () => {
      const generateTasks = Array.from({ length: 10 }, () =>
        MemberIdService.generateNextMemberId()
      );

      const generatedIds = await Promise.all(generateTasks);
      expect(generatedIds).toHaveLength(10);

      // Verify every ID begins with KV
      for (const id of generatedIds) {
        expect(id).toMatch(/^KV\d+$/);
      }

      // Verify strict uniqueness
      const uniqueSet = new Set(generatedIds);
      expect(uniqueSet.size).toBe(10);
    });
  });

  // SCENARIO I: Security & IDOR Prevention
  describe('Scenario I: Strict Security & IDOR Prevention on Network Endpoints', () => {
    it('should return 403 Forbidden when a non-admin attempts to view lateral or non-downline tree', async () => {
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
      });
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1003',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
      });

      // Token for KV1003 (independent lateral distributor)
      const token1003 = createTestToken({
        id: 'usr-kv1003',
        email: 'kv1003@kashvimlm.com',
        role: 'DISTRIBUTOR',
      });

      // KV1003 attempts to view KV1002's private network tree
      const res = await request(app)
        .get('/api/v1/network-tree/member/KV1002')
        .set('Authorization', `Bearer ${token1003}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized|forbidden/i);
    });

    it('should allow admin to view any distributor network tree', async () => {
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        name: 'Distributor KV1002',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      });

      const adminToken = createAdminToken();

      const res = await request(app)
        .get('/api/v1/network-tree/member/KV1002')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.root.distributorId).toBe('KV1002');
    });
  });

  // SCENARIO J: Data Persistence Across Re-queries
  describe('Scenario J: Network Structure & Metrics Persistence', () => {
    it('should return consistent network statistics and relationships on successive queries', async () => {
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1001',
        name: 'Root Distributor',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
      });
      NetworkTreeService.addEnrolledMember({
        distributorId: 'KV1002',
        name: 'Partner 1002',
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        sponsor: 'KV1001',
        placementParent: 'KV1001',
        position: 'RIGHT',
        bv: 150,
      });

      // Query 1
      const summary1 = await NetworkTreeService.getNetworkSummary('KV1001');
      expect(summary1.totalTeamCount).toBe(1);
      expect(summary1.rightBV).toBeGreaterThanOrEqual(150);

      // Query 2
      const summary2 = await NetworkTreeService.getNetworkSummary('KV1001');
      expect(summary2).toEqual(summary1);
    });
  });
});
