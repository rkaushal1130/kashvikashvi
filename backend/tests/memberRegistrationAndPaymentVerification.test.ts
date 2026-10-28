import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app';
import { NetworkTreeService } from '../src/services/networkTree.service';
import { MemberIdService } from '../src/services/memberId.service';
import { PaymentService } from '../src/services/payment.service';
import { prisma } from '../src/utils/prisma';
import { createTestToken, createAdminToken } from './helpers/testHelpers';

describe('MEMBER REGISTRATION, UNIQUE ID GENERATION & PAYMENT VERIFICATION SYSTEM', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    NetworkTreeService.clearEnrolledMembers();
    PaymentService.clearProcessedWebhookEvents();
  });

  // 1. UNIQUE KV-XXXX MEMBER ID GENERATION
  describe('1. Concurrency-Safe Sequential Member ID Generation', () => {
    it('should generate sequential IDs starting at KV-1001 or higher', async () => {
      const id1 = await MemberIdService.generateNextMemberId();
      const id2 = await MemberIdService.generateNextMemberId();
      const id3 = await MemberIdService.generateNextMemberId();

      expect(id1).toMatch(/^KV-\d{4,}$/);
      expect(id2).toMatch(/^KV-\d{4,}$/);
      expect(id3).toMatch(/^KV-\d{4,}$/);

      // Verify strict sequential ordering and uniqueness
      const num1 = parseInt(id1.replace('KV-', ''), 10);
      const num2 = parseInt(id2.replace('KV-', ''), 10);
      const num3 = parseInt(id3.replace('KV-', ''), 10);

      expect(num2).toBe(num1 + 1);
      expect(num3).toBe(num2 + 1);
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });

    it('should handle simultaneous ID generation requests without duplicate collisions', async () => {
      const promises = Array.from({ length: 10 }, () => MemberIdService.generateNextMemberId());
      const generatedIds = await Promise.all(promises);

      const uniqueSet = new Set(generatedIds);
      expect(uniqueSet.size).toBe(10);
      generatedIds.forEach((id) => {
        expect(id).toMatch(/^KV-\d{4,}$/);
      });
    });

    it('should validate and normalize valid and invalid member IDs correctly', () => {
      expect(MemberIdService.isValidMemberId('KV-1001')).toBe(true);
      expect(MemberIdService.isValidMemberId('KV1001')).toBe(true);
      expect(MemberIdService.isValidMemberId('KV-99999')).toBe(true);
      expect(MemberIdService.isValidMemberId('INVALID-123')).toBe(false);
      expect(MemberIdService.isValidMemberId('')).toBe(false);

      expect(MemberIdService.normalizeMemberId('kv1005')).toBe('KV-1005');
      expect(MemberIdService.normalizeMemberId('KV-1005')).toBe('KV-1005');
      expect(MemberIdService.normalizeMemberId('  kv-2020  ')).toBe('KV-2020');
    });
  });

  // 2. REGISTRATION DOES NOT MEAN PAYMENT (PENDING STATE)
  describe('2. Enrollment Registration State Machine: Registration != Payment', () => {
    it('should create an enrolled member in PENDING payment and INACTIVE status upon form submission', async () => {
      const email = `test.applicant.${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/v1/enrollments/complete')
        .send({
          fullName: 'Vikram Malhotra',
          email,
          phone: '9876543210',
          address: '123 MG Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          sponsorId: 'KV-1001',
          placementParentId: 'KV-1001',
          placementPosition: 'RIGHT',
          starterKitId: 'kit_pro',
          password: 'Password123!',
          agreeTerms: true,
        });

      if (res.status !== 200) {
        console.log('Verify Error Response 1:', res.status, res.body);
      }
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // Unique KV ID assigned
      const assignedId = data.distributor?.distributorId || data.distributor?.distributorCode || data.memberId;
      expect(assignedId).toMatch(/^KV-\d{4,}$/);

      // Status must be PENDING / INACTIVE, NOT PAID / ACTIVE
      expect(data.distributor?.status).toBe('PENDING');
      expect(data.distributor?.paymentStatus).toBe('PENDING');
      expect(data.user?.status).toMatch(/INACTIVE|PENDING/);
    });

    it('should generate an enrollment payment order without activating the account', async () => {
      const testMemberId = `KV-${Date.now().toString().slice(-4)}`;
      const orderRes = await request(app)
        .post('/api/v1/payments/enrollment/order')
        .send({
          memberId: testMemberId,
          starterKitId: 'kit_pro',
        });

      expect(orderRes.status).toBe(201);
      expect(orderRes.body.success).toBe(true);
      expect(orderRes.body.data.paymentStatus).toBe('PENDING');
      expect(orderRes.body.data.accountStatus).toBe('PENDING_PAYMENT');
      expect(orderRes.body.data.razorpayOrderId).toBeDefined();
    });
  });

  // 3. CRYPTOGRAPHIC PAYMENT SIGNATURE VERIFICATION
  describe('3. Cryptographic HMAC-SHA256 Signature Verification', () => {
    it('should reject tampered or invalid payment signatures and mark paymentStatus as FAILED', async () => {
      const testMemberId = `KV-${Date.now().toString().slice(-4)}`;
      const orderId = `order_test_${Date.now()}`;
      const paymentId = `pay_tampered_${Date.now()}`;
      const fakeSignature = 'bad_tampered_signature_hex_value_1234567890';

      const res = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: testMemberId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: fakeSignature,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PAYMENT_SIGNATURE_INVALID');
    });

    it('should successfully verify payment with a valid cryptographic signature and activate the account', async () => {
      const testMemberId = `KV-${Date.now().toString().slice(-4)}`;
      const orderId = `order_valid_${Date.now()}`;
      const paymentId = `pay_valid_${Date.now()}`;

      // Secret used by default in dev/test environment
      const secret = PaymentService.getRazorpayCredentials().keySecret;
      const validHmacSignature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: testMemberId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: validHmacSignature,
          starterKitId: 'kit_pro',
          amount: 2999,
        });

      if (res.status !== 200) {
        console.log('Verify Error Response 1:', res.status, res.body);
      }
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('PAID');
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(res.body.data.creditedBV).toBe(100);
    });

    it('should accept valid dev/test signature tokens during testing and activate member', async () => {
      const testMemberId = `KV-${Date.now().toString().slice(-4)}`;
      const orderId = `order_dev_${Date.now()}`;
      const paymentId = `pay_dev_${Date.now()}`;
      const testSig = `test_sig_${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: testMemberId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: testSig,
          starterKitId: 'kit_elite',
          amount: 4999,
        });

      if (res.status !== 200) {
        console.log('Verify Error Response 1:', res.status, res.body);
      }
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentStatus).toBe('PAID');
      expect(res.body.data.accountStatus).toBe('ACTIVE');
      expect(res.body.data.creditedBV).toBe(200);
    });

    it('should be idempotent and safely handle duplicate payment verification callbacks without double-crediting', async () => {
      const testMemberId = `KV-${Date.now().toString().slice(-4)}`;
      const orderId = `order_dup_${Date.now()}`;
      const paymentId = `pay_idempotent_${Date.now()}`;
      const testSig = `test_sig_${Date.now()}`;

      // First verification call
      const res1 = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: testMemberId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: testSig,
        });
      expect(res1.status).toBe(200);
      expect(res1.body.data.paymentStatus).toBe('PAID');

      // Duplicate second verification call
      const res2 = await request(app)
        .post('/api/v1/enrollments/verify-payment')
        .send({
          memberId: testMemberId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: testSig,
        });
      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyProcessed).toBe(true);
      expect(res2.body.data.paymentStatus).toBe('PAID');
    });
  });

  // 4. DUPLICATE MEMBER ID AUDIT & REPAIR ENGINE
  describe('4. Duplicate Member ID Inspection & Safe Repair', () => {
    it('should run repairDuplicateAndMissingMemberIds safely and return audit metrics', async () => {
      const repairResult = await MemberIdService.repairDuplicateAndMissingMemberIds();

      expect(repairResult).toBeDefined();
      expect(typeof repairResult.totalScanned).toBe('number');
      expect(typeof repairResult.duplicateGroupsResolved).toBe('number');
      expect(typeof repairResult.recordsRepaired).toBe('number');
      expect(Array.isArray(repairResult.details)).toBe(true);
    });
  });

  // 5. ADMIN ENROLLMENT INSPECTION & MANUAL VERIFICATION
  describe('5. Admin Enrollment Inspection & Manual Verification', () => {
    it('should allow authorized admin to inspect enrollment records and verify manually', async () => {
      const adminToken = createAdminToken({
        id: 'usr-admin-01',
        email: 'admin@kashvimlm.com',
        role: 'ADMIN',
      });

      // 1. Get admin enrollments
      const listRes = await request(app)
        .get('/api/v1/payments/admin/enrollments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);

      // 2. Admin manual verification
      const verifyRes = await request(app)
        .post('/api/v1/payments/admin/verify-manual')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1001',
          referenceNumber: `BANK-UTR-${Date.now()}`,
          reason: 'Verified direct NEFT transfer for starter pack activation',
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.paymentStatus).toBe('PAID');
      expect(verifyRes.body.data.accountStatus).toBe('ACTIVE');
    });

    it('should reject non-admin users attempting manual payment verification', async () => {
      const memberToken = createTestToken({
        id: 'usr-member-normal',
        email: 'member@kashvimlm.com',
        role: 'DISTRIBUTOR',
      });

      const verifyRes = await request(app)
        .post('/api/v1/payments/admin/verify-manual')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          memberId: 'KV-1002',
          referenceNumber: 'REF123',
          reason: 'Unauthorized bypass attempt',
        });
      expect(verifyRes.status).toBe(403);
    });
  });
});
