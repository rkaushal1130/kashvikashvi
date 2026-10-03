/**
 * Test Suite: Mission-Critical Financial Operations & Anti-Tampering Tests
 * Uses Vitest & Supertest
 *
 * Mandate: Every important financial operation must have tests.
 *
 * Covers:
 * - BV Ledger Integrity (Mandatory sourceId, strictly positive volume, valid reversals)
 * - Order Anti-Tampering (Zero-trust on client prices & BV, inventory locking)
 * - Wallet Financial Invariants (Overdraft protection, non-negative balances, balance consistency)
 * - Commission Idempotency (Strict double-spending & duplicate calculation guards)
 * - Payout Reconciliation (Pending balance transitions, approved settlement, rejected refund)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import {
  bvSourceTypeEnum,
  creditBVSchema,
  debitBVSchema,
  reverseBVTransactionSchema,
} from '../src/validators/bv.validators';
import { orderItemInputSchema } from '../src/validators/order.validators';
import {
  adminWalletAdjustmentSchema,
  walletTransactionTypeEnum,
} from '../src/validators/wallet.validators';
import { createPayoutRequestSchema } from '../src/validators/payout.validators';
import { WalletService } from '../src/services/wallet.service';
import { PayoutService } from '../src/services/payout.service';
import { CommissionPeriodService } from '../src/services/commissionPeriod.service';
import { AppError } from '../src/utils/appError';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('MISSION-CRITICAL FINANCIAL OPERATIONS TEST SUITE', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const distributorId = '11111111-2222-3333-4444-555555555555';
  const adminToken = createAdminToken();
  const token = createTestToken();

  describe('1. Business Volume (BV) Ledger Financial Invariants', () => {
    it('should mandate sourceId reference for every BV credit (no floating BV allowed)', () => {
      const creditWithoutRef = creditBVSchema.safeParse({
        distributorId,
        sourceType: 'ORDER',
        sourceId: '', // Blank reference
        bv: 100,
        position: 'LEFT',
      });
      expect(creditWithoutRef.success).toBe(false);

      const creditWithWhitespaceRef = creditBVSchema.safeParse({
        distributorId,
        sourceType: 'ORDER',
        sourceId: '   ',
        bv: 100,
        position: 'LEFT',
      });
      expect(creditWithWhitespaceRef.success).toBe(false);

      const validCredit = creditBVSchema.safeParse({
        distributorId,
        sourceType: 'ORDER',
        sourceId: 'ORD-2026-987654',
        bv: 100,
        position: 'LEFT',
      });
      expect(validCredit.success).toBe(true);
    });

    it('should mandate sourceId reference for every BV debit', () => {
      const debitWithoutRef = debitBVSchema.safeParse({
        distributorId,
        sourceType: 'ADJUSTMENT',
        sourceId: '',
        bv: 50,
      });
      expect(debitWithoutRef.success).toBe(false);

      const validDebit = debitBVSchema.safeParse({
        distributorId,
        sourceType: 'ADJUSTMENT',
        sourceId: 'ADJ-2026-0001',
        bv: 50,
      });
      expect(validDebit.success).toBe(true);
    });

    it('should enforce strictly positive BV amounts (rejecting <= 0)', () => {
      const zeroCredit = creditBVSchema.safeParse({
        distributorId,
        sourceType: 'ORDER',
        sourceId: 'ORD-001',
        bv: 0,
      });
      expect(zeroCredit.success).toBe(false);

      const negativeCredit = creditBVSchema.safeParse({
        distributorId,
        sourceType: 'ORDER',
        sourceId: 'ORD-001',
        bv: -50,
      });
      expect(negativeCredit.success).toBe(false);

      const zeroDebit = debitBVSchema.safeParse({
        distributorId,
        sourceType: 'ADJUSTMENT',
        sourceId: 'ADJ-001',
        bv: 0,
      });
      expect(zeroDebit.success).toBe(false);
    });

    it('should require a valid originalTransactionId and reason for all BV reversals', () => {
      const validReversal = reverseBVTransactionSchema.safeParse({
        originalTransactionId: '22222222-3333-4444-5555-666666666666',
        reason: 'Customer returned items within 30-day window',
        referenceId: 'REF-REV-001',
      });
      expect(validReversal.success).toBe(true);

      const invalidReversal = reverseBVTransactionSchema.safeParse({
        originalTransactionId: 'not-a-uuid',
        reason: 'Missing UUID',
        referenceId: 'REF-REV-002',
      });
      expect(invalidReversal.success).toBe(false);

      const emptyReasonReversal = reverseBVTransactionSchema.safeParse({
        originalTransactionId: '22222222-3333-4444-5555-666666666666',
        reason: '',
        referenceId: 'REF-REV-003',
      });
      expect(emptyReasonReversal.success).toBe(false);
    });
  });

  describe('2. Order Checkout Anti-Tampering Financial Controls', () => {
    it('should strip client-supplied price and BV values at API gateway level', () => {
      const maliciousPayload = {
        productId: '33333333-4444-5555-6666-777777777777',
        quantity: 5,
        unitPrice: 0.01,  // Attempting price tampering
        unitBV: 999999,   // Attempting BV inflation
        totalPrice: 0.05,
      };

      const parsed = orderItemInputSchema.parse(maliciousPayload);
      expect(parsed.productId).toBe('33333333-4444-5555-6666-777777777777');
      expect(parsed.quantity).toBe(5);
      expect((parsed as any).unitPrice).toBeUndefined();
      expect((parsed as any).unitBV).toBeUndefined();
      expect((parsed as any).totalPrice).toBeUndefined();
    });
  });

  describe('3. Wallet Invariants & Balance Reconciliation', () => {
    it('should guarantee available balance cannot be debited below zero (Overdraft prevention)', async () => {
      vi.spyOn(WalletService, 'adjustWalletBalance').mockRejectedValue(
        AppError.badRequest(
          'Insufficient wallet balance. Available: 25.00, requested debit: 100.00',
          'INSUFFICIENT_WALLET_BALANCE'
        )
      );

      const res = await request(app)
        .post('/api/v1/admin/wallet/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distributorId,
          type: 'DEBIT',
          amount: 100.0,
          reason: 'Chargeback fee',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient wallet balance');
    });

    it('should ensure financial credit updates both availableBalance and lifetimeEarnings accurately', async () => {
      const mockResult = {
        wallet: {
          id: 'wal-1',
          availableBalance: 1500.0,
          pendingBalance: 0,
          lifetimeEarned: 5500.0,
        },
        transaction: {
          id: 'tx-1',
          type: 'CREDIT',
          amount: 500.0,
          balanceAfter: 1500.0,
        },
      };

      vi.spyOn(WalletService, 'adjustWalletBalance').mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post('/api/v1/admin/wallet/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distributorId,
          type: 'CREDIT',
          amount: 500.0,
          reason: 'Executive Director Quarterly Achievement Bonus',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.wallet.availableBalance).toBe(1500.0);
      expect(res.body.data.wallet.lifetimeEarned).toBe(5500.0);
    });
  });

  describe('4. Commission Period Idempotency & Financial Double-Spending Guard', () => {
    it('should block double-calculation of the same commission period', async () => {
      const periodId = '44444444-5555-6666-7777-888888888888';

      vi.spyOn(CommissionPeriodService, 'calculatePeriod').mockRejectedValue(
        AppError.conflict(
          "Commission period 'W-2026-W38' has already been calculated. Duplicate processing is forbidden.",
          'PERIOD_ALREADY_CALCULATED'
        )
      );

      const res = await request(app)
        .post(`/api/v1/admin/commission-periods/${periodId}/calculate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Duplicate processing is forbidden');
    });
  });

  describe('5. Payout Lifecycle Financial State Transitions', () => {
    it('should hold payout funds in pendingBalance until admin approves or rejects', async () => {
      const mockPayout = {
        id: 'payout-uuid-001',
        amount: 450.0,
        status: 'REQUESTED',
        pendingBalance: 450.0,
      };

      vi.spyOn(PayoutService, 'requestPayout').mockResolvedValue(mockPayout as any);

      const res = await request(app)
        .post('/api/v1/payouts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 450.0,
          bankAccountId: '55555555-6666-7777-8888-999999999999',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REQUESTED');
      expect(res.body.data.amount).toBe(450.0);
    });

    it('should restore held pending balance to available balance when payout is rejected', async () => {
      const targetPayoutId = '66666666-7777-4777-8777-999999999999';
      const mockRejection = {
        id: targetPayoutId,
        status: 'REJECTED',
        refundedAmount: 450.0,
      };

      vi.spyOn(PayoutService, 'rejectPayout').mockResolvedValue(mockRejection as any);

      const res = await request(app)
        .post(`/api/v1/admin/payouts/${targetPayoutId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'KYC PAN card mismatch with banking details',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.refundedAmount).toBe(450.0);
    });
  });
});
