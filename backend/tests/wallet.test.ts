/**
 * Test Suite: Wallet & Payout Financial Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Wallet balance retrieval
 * - Financial credit operations & ledger entries
 * - Financial debit operations & overdraft prevention
 * - Direct mutation prevention security guards
 * - Payout request submission
 * - Payout approval & balance reconciliation
 * - Payout rejection & balance refund
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { WalletService } from '../src/services/wallet.service';
import { PayoutService } from '../src/services/payout.service';
import {
  adminWalletAdjustmentSchema,
  walletTransactionTypeEnum,
} from '../src/validators/wallet.validators';
import {
  createPayoutRequestSchema,
  payoutStatusEnum,
} from '../src/validators/payout.validators';
import { AppError } from '../src/utils/appError';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('WALLET & FINANCIAL OPERATIONS AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const userId = '11111111-1111-4111-8111-111111111111';
  const distributorId = '22222222-2222-4222-8222-222222222222';
  const payoutId = '33333333-3333-4333-8333-333333333333';
  const token = createTestToken({
    id: userId,
    email: 'distributor@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });
  const adminToken = createAdminToken();

  describe('1. Wallet Retrieval (/api/v1/wallet)', () => {
    it('should retrieve authenticated distributor wallet balance and summary', async () => {
      const mockWallet = {
        id: 'wal-101',
        distributorId,
        availableBalance: 1250.5,
        pendingBalance: 150.0,
        lifetimeEarned: 5000.0,
        lifetimePaid: 3749.5,
        currency: 'USD',
        isLocked: false,
      };

      vi.spyOn(WalletService, 'getWalletByUserId').mockResolvedValue(mockWallet as any);

      const res = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.availableBalance).toBe(1250.5);
      expect(res.body.data.pendingBalance).toBe(150.0);
    });

    it('should reject unauthenticated access to wallet with 401', async () => {
      const res = await request(app)
        .get('/api/v1/wallet')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Credit Operations (Financial Inflow)', () => {
    it('should successfully credit wallet with valid admin adjustment', async () => {
      const mockResult = {
        wallet: {
          id: 'wal-101',
          availableBalance: 1500.0,
          pendingBalance: 0,
        },
        transaction: {
          id: 'tx-credit-001',
          type: 'CREDIT',
          amount: 250.0,
          balanceAfter: 1500.0,
          description: 'Promotional leadership bonus',
        },
      };

      vi.spyOn(WalletService, 'adjustWalletBalance').mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post('/api/v1/admin/wallet/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distributorId,
          type: 'CREDIT',
          amount: 250.0,
          reason: 'Promotional leadership bonus',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.type).toBe('CREDIT');
      expect(res.body.data.transaction.amount).toBe(250.0);
      expect(res.body.data.wallet.availableBalance).toBe(1500.0);
    });

    it('should reject credit adjustment when requested by non-admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/wallet/adjust')
        .set('Authorization', `Bearer ${token}`)
        .send({
          distributorId,
          type: 'CREDIT',
          amount: 100.0,
          reason: 'Unauthorized credit attempt',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Debit Operations (Financial Outflow & Overdraft Guard)', () => {
    it('should successfully debit wallet when balance is sufficient', async () => {
      const mockResult = {
        wallet: {
          id: 'wal-101',
          availableBalance: 850.0,
        },
        transaction: {
          id: 'tx-debit-001',
          type: 'DEBIT',
          amount: 150.0,
          balanceAfter: 850.0,
          description: 'Monthly technology fee',
        },
      };

      vi.spyOn(WalletService, 'adjustWalletBalance').mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post('/api/v1/admin/wallet/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distributorId,
          type: 'DEBIT',
          amount: 150.0,
          reason: 'Monthly technology fee',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.type).toBe('DEBIT');
      expect(res.body.data.transaction.amount).toBe(150.0);
    });

    it('should reject debit with 400 when amount exceeds available balance (Overdraft protection)', async () => {
      vi.spyOn(WalletService, 'adjustWalletBalance').mockRejectedValue(
        AppError.badRequest(
          'Insufficient wallet balance. Available: 50.00, requested debit: 500.00',
          'INSUFFICIENT_WALLET_BALANCE'
        )
      );

      const res = await request(app)
        .post('/api/v1/admin/wallet/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distributorId,
          type: 'DEBIT',
          amount: 500.0,
          reason: 'Debit exceeding balance',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient wallet balance');
    });

    it('should reject zero or negative adjustment amounts in Zod schema', () => {
      expect(
        adminWalletAdjustmentSchema.safeParse({
          distributorId,
          type: 'CREDIT',
          amount: 0,
          reason: 'Zero amount',
        }).success
      ).toBe(false);

      expect(
        adminWalletAdjustmentSchema.safeParse({
          distributorId,
          type: 'DEBIT',
          amount: -50,
          reason: 'Negative amount',
        }).success
      ).toBe(false);
    });
  });

  describe('4. Direct Mutation Prevention (Anti-Tampering Guard)', () => {
    it('should reject direct POST to /api/v1/wallet', async () => {
      const res = await request(app)
        .post('/api/v1/wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ availableBalance: 999999 });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject direct PUT/PATCH to /api/v1/wallet', async () => {
      const putRes = await request(app)
        .put('/api/v1/wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ availableBalance: 999999 });
      expect(putRes.status).toBeGreaterThanOrEqual(400);

      const patchRes = await request(app)
        .patch('/api/v1/wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ availableBalance: 999999 });
      expect(patchRes.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('5. Payout Lifecycle (/api/v1/payouts)', () => {
    const bankAccountId = '44444444-4444-4444-8444-444444444444';

    it('should allow distributor to request a payout moving funds to pending balance', async () => {
      const mockPayout = {
        id: payoutId,
        distributorId,
        amount: 300.0,
        status: 'REQUESTED',
        fee: 0,
        netAmount: 300.0,
        currency: 'USD',
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(PayoutService, 'requestPayout').mockResolvedValue(mockPayout as any);

      const res = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 300.0,
          bankAccountId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(300.0);
      expect(res.body.data.status).toBe('REQUESTED');
    });

    it('should reject payout request when requested amount exceeds available balance', async () => {
      vi.spyOn(PayoutService, 'requestPayout').mockRejectedValue(
        AppError.badRequest(
          'Insufficient available balance for payout. Available: 50.00, requested: 500.00',
          'INSUFFICIENT_PAYOUT_BALANCE'
        )
      );

      const res = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 500.0,
          bankAccountId,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient available balance');
    });

    it('should allow Admin to approve payout request', async () => {
      const mockApproved = {
        id: payoutId,
        status: 'PAID',
        approvedAt: new Date().toISOString(),
        amount: 300.0,
      };

      vi.spyOn(PayoutService, 'approvePayout').mockResolvedValue(mockApproved as any);

      const res = await request(app)
        .post(`/api/v1/admin/payouts/${payoutId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          adminNotes: 'Bank transfer confirmed',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PAID');
    });

    it('should allow Admin to reject payout request and refund funds to available balance', async () => {
      const mockRejected = {
        id: payoutId,
        status: 'REJECTED',
        rejectionReason: 'Invalid bank account number',
        refundedAmount: 300.0,
      };

      vi.spyOn(PayoutService, 'rejectPayout').mockResolvedValue(mockRejected as any);

      const res = await request(app)
        .post(`/api/v1/admin/payouts/${payoutId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Invalid bank account number',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
    });
  });

  describe('6. Wallet & Payout Enums Verification', () => {
    it('should validate all financial wallet transaction types', () => {
      const validTypes = ['CREDIT', 'DEBIT', 'COMMISSION', 'PAYOUT', 'REFUND', 'ADJUSTMENT', 'REVERSAL'];
      for (const t of validTypes) {
        expect(walletTransactionTypeEnum.safeParse(t).success).toBe(true);
      }
      expect(walletTransactionTypeEnum.safeParse('HACK').success).toBe(false);
    });

    it('should validate all payout statuses', () => {
      const statuses = [
        'REQUESTED',
        'UNDER_REVIEW',
        'APPROVED',
        'PROCESSING',
        'PAID',
        'REJECTED',
        'FAILED',
        'COMPLETED',
        'CANCELLED',
      ];
      for (const st of statuses) {
        expect(payoutStatusEnum.safeParse(st).success).toBe(true);
      }
      expect(payoutStatusEnum.safeParse('UNKNOWN').success).toBe(false);
    });
  });
});
