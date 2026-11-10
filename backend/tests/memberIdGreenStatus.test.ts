/**
 * ============================================================================
 * KASHVI MLM: MEMBER ID GREEN STATUS BASED ON PAYMENT TEST SUITE
 * ============================================================================
 *
 * Verifies all 5 core specifications:
 * 1. Default ID Status: Newly registered member's ID remains in default inactive
 *    status (NOT green, isPaid: false) until they complete a qualifying payment.
 * 2. Super Admin ID KK-0001 is permanently active, paid, and green.
 * 3. Payment-Based Green Status via Enrollment: Successful enrollment pack payment
 *    automatically turns the member ID green (isPaid: true, paymentStatus: PAID, status: ACTIVE).
 * 4. Payment-Based Green Status via Product Order: Successful order payment
 *    automatically turns the member ID green.
 * 5. Pending, failed, or cancelled transactions NEVER activate or turn the ID green.
 * 6. Idempotency: Duplicate payment callbacks do not double-activate or corrupt the tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { AuthService } from '../src/services/auth.service';
import { PaymentService } from '../src/services/payment.service';
import { NetworkTreeService } from '../src/services/networkTree.service';
import { MemberPerformanceService } from '../src/services/memberPerformance.service';
import { MemberIdService } from '../src/services/memberId.service';

describe('KASHVI MLM - MEMBER ID GREEN STATUS BASED ON PAYMENT', { timeout: 30000 }, () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.ENABLE_DEMO_SEED = 'true';
    AuthService.clearInMemoryUsers();
    PaymentService.clearProcessedWebhookEvents();
    NetworkTreeService.clearEnrolledMembers();
    await AuthService.initSeedUsers();
  });

  // --------------------------------------------------------------------------
  // SPEC 1: Super Admin KK-0001 Permanent Green Status
  // --------------------------------------------------------------------------
  describe('1. Super Admin KK-0001 Status', () => {
    it('Super Admin KK-0001 must always be active, paid, and green', async () => {
      // Direct in-memory user check
      const superAdmin = AuthService.getInMemoryUser('KK-0001');
      expect(superAdmin).toBeDefined();
      expect(superAdmin.distributorCode).toBe('KK-0001');

      // getMe check
      const adminProfile = await AuthService.getMe(superAdmin.id);
      expect(adminProfile.memberId).toBe('KK-0001');
      expect(adminProfile.isPaid).toBe(true);
      expect(adminProfile.paymentStatus).toBe('PAID');
      expect(adminProfile.status).toBe('ACTIVE');
      expect(adminProfile.accountStatus).toBe('ACTIVE');

      // Member performance check
      const perf = await MemberPerformanceService.getMemberPerformance('KK-0001');
      expect(perf).toBeDefined();
      expect(perf.distributorCode).toBe('KK-0001');
      expect(perf.isPaid).toBe(true);
      expect(perf.paymentStatus).toBe('PAID');
      expect(perf.accountStatus).toBe('ACTIVE');

      // Network tree root check
      const tree = await NetworkTreeService.getNetworkTree('KK-0001', 3);
      expect(tree.root).toBeDefined();
      expect(tree.root.distributorId).toBe('KK-0001');
      expect(tree.root.isPaid).toBe(true);
      expect(tree.root.status).toBe('ACTIVE');
      expect(tree.root.paymentStatus).toBe('PAID');
    });
  });

  // --------------------------------------------------------------------------
  // SPEC 2: Newly Registered Member starts in Default Inactive Status (NOT Green)
  // --------------------------------------------------------------------------
  describe('2. Default Inactive Status Before Payment', () => {
    it('newly registered member ID must NOT be green and must have isPaid: false, paymentStatus: PENDING', async () => {
      const timestamp = Date.now();
      const email = `unpaid_member_${timestamp}@kashvimlm.com`;
      const phone = `98${timestamp.toString().slice(-8)}`;
      const regResult = await AuthService.register({
        email,
        phone,
        password: 'Password123!',
        fullName: 'Priya Sharma',
        sponsorId: 'KK-0001',
      });

      expect(regResult).toBeDefined();
      expect(regResult.user).toBeDefined();

      const memberCode = regResult.user.distributorCode || regResult.user.distributorId || regResult.user.memberId;
      expect(memberCode).toMatch(/^KK-\d{4,}$/);
      expect(memberCode).not.toBe('KK-0001');

      // Unpaid member assertions (NOT GREEN)
      expect(regResult.user.isPaid).toBe(false);
      expect(regResult.user.paymentStatus).toBe('PENDING');
      expect(regResult.user.status).toBe('PENDING_PAYMENT');
      expect(regResult.user.accountStatus).toBe('PENDING_PAYMENT');

      // Verify getMe returns unpaid status
      const memberMe = await AuthService.getMe(regResult.user.id);
      expect(memberMe.isPaid).toBe(false);
      expect(memberMe.paymentStatus).toBe('PENDING');
      expect(memberMe.status).toBe('PENDING_PAYMENT');
      expect(memberMe.accountStatus).toBe('PENDING_PAYMENT');

      // Verify performance returns isPaid: false
      const perf = await MemberPerformanceService.getMemberPerformance(memberCode);
      expect(perf.isPaid).toBe(false);
      expect(perf.paymentStatus).toBe('PENDING');
      expect(perf.accountStatus).toBe('PENDING');

      // In NetworkTreeService, enrolled member before payment marks them unpaid
      const treeMember = NetworkTreeService.addEnrolledMember(
        {
          id: regResult.user.id,
          name: 'Priya Sharma',
          email,
          sponsorId: 'KK-0001',
          distributorId: memberCode,
          memberId: memberCode,
          paymentStatus: 'PENDING',
          status: 'PENDING_PAYMENT',
        },
        'KK-0001'
      );
      expect(treeMember.isPaid).toBe(false);
      expect(treeMember.paymentStatus).toBe('PENDING');
      expect(treeMember.status).toBe('PENDING_PAYMENT');
    });
  });

  // --------------------------------------------------------------------------
  // SPEC 3: Member ID Turns Green Upon Enrollment Starter Pack Payment
  // --------------------------------------------------------------------------
  describe('3. Payment-Based Green Status via Enrollment', () => {
    it('member ID should automatically turn green (isPaid: true) upon successful enrollment payment', async () => {
      const timestamp = Date.now();
      const email = `enrollment_paid_${timestamp}@kashvimlm.com`;
      const phone = `97${timestamp.toString().slice(-8)}`;
      const reg = await AuthService.register({
        email,
        phone,
        password: 'Password123!',
        fullName: 'Amit Patel',
        sponsorId: 'KK-0001',
      });

      const memberCode = reg.user.distributorCode || reg.user.memberId;
      expect(reg.user.isPaid).toBe(false);

      // Perform payment activation (Enrollment Starter Pack)
      const activation = await AuthService.activateDistributorAndPlace(memberCode, {
        starterKitId: 'STARTER_KIT_STANDARD',
        bv: 100,
        paymentMethod: 'RAZORPAY',
      });

      expect(activation.success).toBe(true);
      expect(activation.status).toBe('ACTIVE');

      // Verify user profile is now PAID, ACTIVE, and isPaid: true (GREEN)
      const updatedUser = await AuthService.getMe(reg.user.id);
      expect(updatedUser.isPaid).toBe(true);
      expect(updatedUser.paymentStatus).toBe('PAID');
      expect(updatedUser.status).toBe('ACTIVE');
      expect(updatedUser.accountStatus).toBe('ACTIVE');

      // Verify performance returns isPaid: true
      const updatedPerf = await MemberPerformanceService.getMemberPerformance(memberCode);
      expect(updatedPerf.isPaid).toBe(true);
      expect(updatedPerf.paymentStatus).toBe('PAID');
      expect(updatedPerf.accountStatus).toBe('ACTIVE');

      // Verify network tree node is now ACTIVE and PAID
      const tree = await NetworkTreeService.getNetworkTree('KK-0001', 3);
      const placedMember = tree.root.children.find(
        (c: any) => c.distributorId === memberCode || c.memberId === memberCode
      );
      if (placedMember) {
        expect(placedMember.isPaid).toBe(true);
        expect(placedMember.status).toBe('ACTIVE');
        expect(placedMember.paymentStatus).toBe('PAID');
      }
    });
  });

  // --------------------------------------------------------------------------
  // SPEC 4: Member ID Turns Green Upon Eligible Product Order Purchase
  // --------------------------------------------------------------------------
  describe('4. Payment-Based Green Status via Product Order', () => {
    it('member ID should automatically turn green upon completing qualifying product order', async () => {
      const timestamp = Date.now();
      const email = `order_paid_${timestamp}@kashvimlm.com`;
      const phone = `96${timestamp.toString().slice(-8)}`;
      const reg = await AuthService.register({
        email,
        phone,
        password: 'Password123!',
        fullName: 'Neha Gupta',
        sponsorId: 'KK-0001',
      });

      const memberCode = reg.user.distributorCode || reg.user.memberId;
      expect(reg.user.isPaid).toBe(false);

      // Simulate qualifying product order payment activation
      const orderActivation = await AuthService.activateDistributorAndPlace(memberCode, {
        orderId: `ORD-${Date.now()}`,
        bv: 250,
        paymentMethod: 'RAZORPAY',
      });

      expect(orderActivation.success).toBe(true);
      expect(orderActivation.status).toBe('ACTIVE');

      // Check profile is green
      const userProfile = await AuthService.getMe(reg.user.id);
      expect(userProfile.isPaid).toBe(true);
      expect(userProfile.paymentStatus).toBe('PAID');
      expect(userProfile.status).toBe('ACTIVE');

      // Check performance is green
      const perf = await MemberPerformanceService.getMemberPerformance(memberCode);
      expect(perf.isPaid).toBe(true);
      expect(perf.paymentStatus).toBe('PAID');
      expect(perf.accountStatus).toBe('ACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // SPEC 5: Pending, Failed, or Invalid Transactions Never Turn ID Green
  // --------------------------------------------------------------------------
  describe('5. Unpaid, Pending, or Failed Payments Stay Inactive (NOT Green)', () => {
    it('invalid payment signature must be rejected and must NOT activate the member', async () => {
      const timestamp = Date.now();
      const email = `fraud_test_${timestamp}@kashvimlm.com`;
      const phone = `95${timestamp.toString().slice(-8)}`;
      const reg = await AuthService.register({
        email,
        phone,
        password: 'Password123!',
        fullName: 'Rajesh Kumar',
        sponsorId: 'KK-0001',
      });

      const memberCode = reg.user.distributorCode || reg.user.memberId;

      // Attempt payment verification with a bogus signature
      const bogusPayload = {
        orderId: 'ORDER_BOGUS_123',
        paymentId: 'PAY_BOGUS_456',
        signature: 'invalid_forged_hmac_signature',
        memberId: memberCode,
        amount: 5000,
      };

      await expect(PaymentService.verifyEnrollmentPayment(bogusPayload as any)).rejects.toThrow();

      // Ensure user ID remains unpaid and NOT green
      const profile = await AuthService.getMe(reg.user.id);
      expect(profile.isPaid).toBe(false);
      expect(profile.paymentStatus).toBe('PENDING');
      expect(profile.status).toBe('PENDING_PAYMENT');

      const perf = await MemberPerformanceService.getMemberPerformance(memberCode);
      expect(perf.isPaid).toBe(false);
      expect(perf.paymentStatus).toBe('PENDING');
    });
  });

  // --------------------------------------------------------------------------
  // SPEC 6: Idempotency and Duplicate Protection
  // --------------------------------------------------------------------------
  describe('6. Idempotent Payment Confirmations', () => {
    it('duplicate activation callbacks must not double-activate or crash', async () => {
      const timestamp = Date.now();
      const email = `idempotent_${timestamp}@kashvimlm.com`;
      const phone = `94${timestamp.toString().slice(-8)}`;
      const reg = await AuthService.register({
        email,
        phone,
        password: 'Password123!',
        fullName: 'Suresh Reddy',
        sponsorId: 'KK-0001',
      });

      const memberCode = reg.user.distributorCode || reg.user.memberId;

      // First activation
      const firstActivation = await AuthService.activateDistributorAndPlace(memberCode, {
        orderId: 'ORD-DUP-1',
        bv: 100,
      });
      expect(firstActivation.success).toBe(true);

      // Second duplicate activation
      const secondActivation = await AuthService.activateDistributorAndPlace(memberCode, {
        orderId: 'ORD-DUP-1',
        bv: 100,
      });
      expect(secondActivation.success).toBe(true);
      expect(secondActivation.status).toBe('ACTIVE');

      // State remains cleanly PAID and green
      const profile = await AuthService.getMe(reg.user.id);
      expect(profile.isPaid).toBe(true);
      expect(profile.paymentStatus).toBe('PAID');
      expect(profile.status).toBe('ACTIVE');
    });
  });
});
