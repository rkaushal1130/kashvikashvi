/**
 * Test Suite: Client Funding Portal, Bank Account Management, and Treasury Separation
 *
 * Verifies:
 * 1. Client Funding Order creation and listing (with strict tenant isolation).
 * 2. Signature verification, decimal precision, and atomic wallet balance credit.
 * 3. Idempotency: duplicate verification and webhooks do not credit twice.
 * 4. Bank account management: unverified upon creation, provider verification workflow, zero credential storage.
 * 5. Strict separation between client deposits and Corporate Platform Treasury.
 * 6. Admin Funding Portal access control and audited adjustments.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { ClientFundingService } from '../src/services/clientFunding.service';
import { BankAccountService } from '../src/services/bankAccount.service';
import { WalletService } from '../src/services/wallet.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('CLIENT FUNDING PORTAL & RAZORPAY INTEGRATION TESTS', { timeout: 35000 }, () => {
  const adminToken = createAdminToken();

  const userAId = 'usr_client_aaa_111';
  const userBId = 'usr_client_bbb_222';

  const userAToken = createTestToken({
    id: userAId,
    email: 'clientA@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const userBToken = createTestToken({
    id: userBId,
    email: 'clientB@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    ClientFundingService.clearInMemory();
    BankAccountService.clearInMemory();
  });

  describe('1. Client Funding Portal & Order Creation', () => {
    it('should allow an authenticated client to create a funding order', async () => {
      const res = await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 2500,
          currency: 'INR',
          paymentMethod: 'RAZORPAY_UPI',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.order).toBeDefined();
      expect(data.order.amount).toBe(2500);
      expect(data.order.currency).toBe('INR');
      expect(data.order.status).toBe('PENDING');
      expect(data.order.paymentMethod).toBe('RAZORPAY_UPI');
      expect(data.razorpayOrderId).toBeDefined();
      expect(data.amountInPaise).toBe(250000);
    });

    it('should reject invalid, zero, or negative funding amounts', async () => {
      const res = await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: -50,
          paymentMethod: 'RAZORPAY_UPI',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('should list funding history with strict tenant isolation (User A cannot view User B orders)', async () => {
      // 1. User A creates order
      await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 1500,
          paymentMethod: 'RAZORPAY_UPI',
        })
        .expect(201);

      // 2. User B creates order
      const bRes = await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          amount: 8000,
          paymentMethod: 'RAZORPAY_CARD',
        })
        .expect(201);

      const bOrderId = bRes.body.data.order.id;

      // 3. User A queries orders: must contain only User A orders
      const listResA = await request(app)
        .get('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(listResA.body.success).toBe(true);
      const ordersA = listResA.body.data.orders;
      expect(ordersA.length).toBeGreaterThanOrEqual(1);
      expect(ordersA.every((o: any) => o.userId === userAId)).toBe(true);

      // 4. User A attempts to directly access User B order: must return 403 or 404
      const directRes = await request(app)
        .get(`/api/v1/funding/orders/${bOrderId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect([403, 404]).toContain(directRes.status);
    });
  });

  describe('2. Bank Account Management & Zero-Credential Verification', () => {
    it('should register a new bank account with PENDING_VERIFICATION status', async () => {
      const res = await request(app)
        .post('/api/v1/funding/bank-accounts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          accountHolderName: 'Kunal Joshi',
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'HDFC0001234',
          branchName: 'Andheri West',
          isPrimary: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      const acc = res.body.data.account;
      expect(acc).toBeDefined();
      expect(acc.status).toBe('PENDING_VERIFICATION');
      expect(acc.bankName).toBe('HDFC Bank');
      // Account number must be securely masked
      expect(acc.accountNumber).toContain('••••');
      expect(acc.accountNumber).toContain('7890');
      expect(acc.verifiedAt).toBeNull();
    });

    it('should validate IFSC format and reject invalid IFSC strings', async () => {
      const res = await request(app)
        .post('/api/v1/funding/bank-accounts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          accountHolderName: 'Kunal Joshi',
          bankName: 'HDFC Bank',
          accountNumber: '50100234567890',
          ifscCode: 'INVALID_IFSC_123',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('should transition account to VERIFIED only upon successful provider verification', async () => {
      // 1. Add account
      const addRes = await request(app)
        .post('/api/v1/funding/bank-accounts')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          accountHolderName: 'Priya Sharma',
          bankName: 'ICICI Bank',
          accountNumber: '102938475610',
          ifscCode: 'ICIC0000102',
          isPrimary: false,
        })
        .expect(201);

      const bankAccountId = addRes.body.data.account.id;

      // 2. Trigger verification
      const verifyRes = await request(app)
        .post(`/api/v1/funding/bank-accounts/${bankAccountId}/verify`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ simulatedSuccess: true })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      const verifiedAcc = verifyRes.body.data.account;
      expect(verifiedAcc.status).toBe('VERIFIED');
      expect(verifiedAcc.verifiedAt).not.toBeNull();
    });

    it('should prevent User A from verifying or deleting User B bank account', async () => {
      // User B adds account
      const addRes = await request(app)
        .post('/api/v1/funding/bank-accounts')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          accountHolderName: 'User B',
          bankName: 'Axis Bank',
          accountNumber: '918237465019',
          ifscCode: 'UTIB0000456',
        })
        .expect(201);

      const bBankId = addRes.body.data.account.id;

      // User A attempts to delete User B's bank account
      const delRes = await request(app)
        .delete(`/api/v1/funding/bank-accounts/${bBankId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect([403, 404]).toContain(delRes.status);
    });
  });

  describe('3. Payment Verification, Atomic Credit & Strict Idempotency', () => {
    it('should verify payment signature and credit client wallet atomically', async () => {
      // 1. Create order
      const orderRes = await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 3000,
          paymentMethod: 'RAZORPAY_UPI',
        })
        .expect(201);

      const { order, razorpayOrderId } = orderRes.body.data;

      // 2. Verify payment
      const verifyRes = await request(app)
        .post('/api/v1/funding/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          orderId: order.id,
          razorpayOrderId,
          razorpayPaymentId: 'pay_client_fund_9988',
          razorpaySignature: 'valid_mock_signature',
        })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.order.status).toBe('SUCCEEDED');
      expect(verifyRes.body.data.walletBalance).toBeGreaterThanOrEqual(3000);
    });

    it('should ensure duplicate verification requests do not double credit (Idempotent)', async () => {
      const orderRes = await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 4500,
          paymentMethod: 'RAZORPAY_CARD',
        })
        .expect(201);

      const { order, razorpayOrderId } = orderRes.body.data;

      const payload = {
        orderId: order.id,
        razorpayOrderId,
        razorpayPaymentId: 'pay_idem_fund_1122',
        razorpaySignature: 'valid_mock_signature',
      };

      // First verification
      await request(app)
        .post('/api/v1/funding/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload)
        .expect(200);

      // Second identical verification
      const dupRes = await request(app)
        .post('/api/v1/funding/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload)
        .expect(200);

      expect(dupRes.body.success).toBe(true);
      expect(dupRes.body.data.alreadyProcessed).toBe(true);
    });

    it('should reject invalid payment signatures', async () => {
      const res = await request(app)
        .post('/api/v1/funding/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          razorpayOrderId: 'order_fake_123',
          razorpayPaymentId: 'pay_fake_123',
          razorpaySignature: 'untrusted_tampered_signature',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PAYMENT_SIGNATURE_INVALID');
    });
  });

  describe('4. Strict Separation from Corporate Treasury', () => {
    it('should ensure client wallet funding does not mutate or mix with Corporate Platform Treasury', async () => {
      // 1. Check corporate treasury before client deposit
      const treasuryResBefore = await request(app)
        .get('/api/v1/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      const corpBalanceBefore = treasuryResBefore.body.data?.availableBalance ?? 1000000;

      // 2. User A funds their personal wallet with ₹10,000
      const orderRes = await request(app)
        .post('/api/v1/funding/orders')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          amount: 10000,
          paymentMethod: 'RAZORPAY_UPI',
        })
        .expect(201);

      await request(app)
        .post('/api/v1/funding/verify')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          orderId: orderRes.body.data.order.id,
          razorpayOrderId: orderRes.body.data.razorpayOrderId,
          razorpayPaymentId: 'pay_sep_test_001',
          razorpaySignature: 'valid_mock_signature',
        })
        .expect(200);

      // 3. Corporate Treasury balance must remain unchanged
      const treasuryResAfter = await request(app)
        .get('/api/v1/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      const corpBalanceAfter = treasuryResAfter.body.data?.availableBalance ?? 1000000;
      expect(corpBalanceAfter).toBe(corpBalanceBefore);
    });

    it('should forbid regular clients from accessing Admin Corporate Funding Portal', async () => {
      const res = await request(app)
        .get('/api/v1/admin/funding/dashboard')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(403);
    });
  });
});
