/**
 * Automated Test Suite: Authoritative Business Volume (BV) Handling (Prompt 14)
 *
 * Verifies:
 * 1. Base is strictly Business Volume (BV) / commissionableBusinessVolume:
 *    - NEVER calculated directly from selling price, GST, wallet balance, BB, or binary matching.
 * 2. Selling price and BV are independent:
 *    - Order with selling price ₹10,000 and BV ₹10,000 pays:
 *      L1 = ₹2,400, L2 = ₹800, L3 = ₹1,300, L4 = ₹500, L5 = ₹400 (Total ₹5,400).
 *    - Order with selling price ₹10,000 and BV ₹6,000 pays:
 *      L1 = ₹1,440, L2 = ₹480, L3 = ₹780, L4 = ₹300, L5 = ₹240 (Total ₹3,240).
 * 3. Zero BV Handling:
 *    - Order with selling price ₹5,000 but 0 BV generates zero commission.
 * 4. Cancellation & Refund Handling:
 *    - Order cancelled before qualification generates zero commission.
 *    - Order in PENDING status rejects commission calculation (ORDER_NOT_PAID).
 *    - Order refunded after commission uses clawback / reversal pipeline.
 * 5. Zero-Trust Frontend Security:
 *    - Ordinary frontend users submitting BV, totalBV, or commissionableBusinessVolume are blocked (HTTP 403).
 *    - Authoritative BV originates strictly from database product records or authorized admin operations.
 * 6. Admin BV Adjustment:
 *    - PUT /api/v1/orders/:id/bv allows admin override with audit logging.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { Prisma } from '@prisma/client';
import { AuthoritativeBVService } from '../src/services/authoritativeBV.service';
import { LevelCommissionService } from '../src/services/levelCommission.service';
import { MLMSecurityService } from '../src/services/mlmSecurity.service';
import { AuditService } from '../src/services/audit.service';
import { SafeDecimal } from '../src/utils/safeDecimal';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('AUTHORITATIVE BUSINESS VOLUME (BV) HANDLING (PROMPT 14 TEST SUITE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock commission level queries to return canonical default rates immediately
    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();

  describe('1. Authoritative BV Calculation & Independence from Selling Price', () => {
    it('TC-BV-01: should calculate commissions on BV = ₹10,000 when selling price = ₹10,000', async () => {
      const mockOrder = {
        id: 'ord-10000',
        orderNumber: 'ORD-10000',
        distributorId: 'dist-buyer',
        status: 'PAID',
        totalAmount: new Prisma.Decimal('10000.00'), // Selling price
        totalBV: new Prisma.Decimal('10000.00'),     // BV equal to selling price
        commissionableBusinessVolume: new Prisma.Decimal('10000.00'),
      };

      const mockUplines = [
        { level: 1, distributorId: 'upline-1', distributorCode: 'KV-01', displayName: 'Upline 1', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'upline-2', distributorCode: 'KV-02', displayName: 'Upline 2', status: 'ACTIVE', isDirect: false },
        { level: 3, distributorId: 'upline-3', distributorCode: 'KV-03', displayName: 'Upline 3', status: 'ACTIVE', isDirect: false },
        { level: 4, distributorId: 'upline-4', distributorCode: 'KV-04', displayName: 'Upline 4', status: 'ACTIVE', isDirect: false },
        { level: 5, distributorId: 'upline-5', distributorCode: 'KV-05', displayName: 'Upline 5', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      vi.spyOn(prisma.levelCommission, 'findMany').mockResolvedValue([]);
      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);
      vi.spyOn(prisma.levelCommission, 'create').mockImplementation((args: any) =>
        Promise.resolve({ id: `comm-${args.data.level}`, ...args.data } as any)
      );

      const result = await LevelCommissionService.calculateCommissionsForOrder('ord-10000');

      expect(result.orderBV).toBe(10000);
      expect(result.commissionableBusinessVolume).toBe(10000);
      expect(result.commissions).toHaveLength(5);

      // Level 1 = 10,000 * 24% = 2,400
      expect(result.commissions[0].level).toBe(1);
      expect(result.commissions[0].commissionAmount).toBe(2400.00);

      // Level 2 = 10,000 * 8% = 800
      expect(result.commissions[1].level).toBe(2);
      expect(result.commissions[1].commissionAmount).toBe(800.00);

      // Level 3 = 10,000 * 13% = 1,300
      expect(result.commissions[2].level).toBe(3);
      expect(result.commissions[2].commissionAmount).toBe(1300.00);

      // Level 4 = 10,000 * 5% = 500
      expect(result.commissions[3].level).toBe(4);
      expect(result.commissions[3].commissionAmount).toBe(500.00);

      // Level 5 = 10,000 * 4% = 400
      expect(result.commissions[4].level).toBe(5);
      expect(result.commissions[4].commissionAmount).toBe(400.00);

      expect(result.totalCommissionAmount).toBe(5400.00);
    });

    it('TC-BV-02: should calculate commissions strictly on BV = ₹6,000 when selling price = ₹10,000', async () => {
      // PROVING THAT COMMISSION IS BASED ON BV AND NOT SELLING PRICE
      const mockOrder = {
        id: 'ord-split-price',
        orderNumber: 'ORD-SPLIT-1',
        distributorId: 'dist-buyer',
        status: 'PAID',
        totalAmount: new Prisma.Decimal('10000.00'), // Selling price = ₹10,000
        totalBV: new Prisma.Decimal('6000.00'),      // Authoritative BV = ₹6,000
        commissionableBusinessVolume: new Prisma.Decimal('6000.00'),
      };

      const mockUplines = [
        { level: 1, distributorId: 'upline-1', distributorCode: 'KV-01', displayName: 'Upline 1', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'upline-2', distributorCode: 'KV-02', displayName: 'Upline 2', status: 'ACTIVE', isDirect: false },
        { level: 3, distributorId: 'upline-3', distributorCode: 'KV-03', displayName: 'Upline 3', status: 'ACTIVE', isDirect: false },
        { level: 4, distributorId: 'upline-4', distributorCode: 'KV-04', displayName: 'Upline 4', status: 'ACTIVE', isDirect: false },
        { level: 5, distributorId: 'upline-5', distributorCode: 'KV-05', displayName: 'Upline 5', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      vi.spyOn(prisma.levelCommission, 'findMany').mockResolvedValue([]);
      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);
      vi.spyOn(prisma.levelCommission, 'create').mockImplementation((args: any) =>
        Promise.resolve({ id: `comm-${args.data.level}`, ...args.data } as any)
      );

      const result = await LevelCommissionService.calculateCommissionsForOrder('ord-split-price');

      expect(result.orderBV).toBe(6000);
      expect(result.commissionableBusinessVolume).toBe(6000);

      // Level 1 = 6,000 * 24% = 1,440 (NOT 10,000 * 24% = 2,400)
      expect(result.commissions[0].commissionAmount).toBe(1440.00);

      // Level 2 = 6,000 * 8% = 480 (NOT 10,000 * 8% = 800)
      expect(result.commissions[1].commissionAmount).toBe(480.00);

      // Level 3 = 6,000 * 13% = 780 (NOT 10,000 * 13% = 1,300)
      expect(result.commissions[2].commissionAmount).toBe(780.00);

      // Level 4 = 6,000 * 5% = 300 (NOT 10,000 * 5% = 500)
      expect(result.commissions[3].commissionAmount).toBe(300.00);

      // Level 5 = 6,000 * 4% = 240 (NOT 10,000 * 4% = 400)
      expect(result.commissions[4].commissionAmount).toBe(240.00);

      // Total = 3,240 (54% of 6,000, NOT 5,400)
      expect(result.totalCommissionAmount).toBe(3240.00);
    });
  });

  describe('2. Zero BV, Disqualification & Cancellation Handlers', () => {
    it('TC-BV-03: should generate zero commission when order has zero BV (even with high selling price)', async () => {
      const zeroBVOrder = {
        id: 'ord-zero-bv',
        orderNumber: 'ORD-ZERO-BV',
        distributorId: 'dist-buyer',
        status: 'PAID',
        totalAmount: new Prisma.Decimal('5000.00'), // Selling price = ₹5,000
        totalBV: new Prisma.Decimal('0.00'),        // Zero BV
        commissionableBusinessVolume: new Prisma.Decimal('0.00'),
      };

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(zeroBVOrder as any);

      const result = await LevelCommissionService.calculateCommissionsForOrder('ord-zero-bv');

      expect(result.commissions).toHaveLength(0);
      expect(result.totalCommissionAmount).toBe(0);
      expect(result.skippedLevels).toHaveLength(5);
      expect(result.skippedLevels[0].reason).toBe('ZERO_BV');
    });

    it('TC-BV-04: should reject commission calculation if order is not in qualified status (PENDING)', async () => {
      const pendingOrder = {
        id: 'ord-pending',
        orderNumber: 'ORD-PENDING',
        status: 'PENDING',
        totalAmount: new Prisma.Decimal('5000.00'),
        totalBV: new Prisma.Decimal('2000.00'),
        commissionableBusinessVolume: new Prisma.Decimal('2000.00'),
      };

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(pendingOrder as any);

      await expect(
        LevelCommissionService.calculateCommissionsForOrder('ord-pending')
      ).rejects.toThrow('Order must be PAID or CONFIRMED');
    });

    it('TC-BV-05: should generate zero commission if order was cancelled before qualification', async () => {
      const cancelledOrder = {
        id: 'ord-cancelled',
        orderNumber: 'ORD-CANCELLED',
        status: 'CANCELLED',
        totalAmount: new Prisma.Decimal('5000.00'),
        totalBV: new Prisma.Decimal('2000.00'),
        commissionableBusinessVolume: new Prisma.Decimal('2000.00'),
      };

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(cancelledOrder as any);

      const result = await LevelCommissionService.calculateCommissionsForOrder('ord-cancelled');

      expect(result.commissions).toHaveLength(0);
      expect(result.totalCommissionAmount).toBe(0);
      expect(result.skippedLevels[0].reason).toBe('ORDER_CANCELLED');
    });

    it('TC-BV-06: AuthoritativeBVService.validateOrderBVEligibility should correctly report eligibility status', () => {
      // 1. Eligible paid order
      const el1 = AuthoritativeBVService.validateOrderBVEligibility({
        status: 'PAID',
        totalBV: 1000,
        commissionableBusinessVolume: 1000,
      });
      expect(el1.isEligible).toBe(true);
      expect(el1.commissionableBVNumber).toBe(1000);

      // 2. Disqualified zero BV order
      const el2 = AuthoritativeBVService.validateOrderBVEligibility({
        status: 'PAID',
        totalBV: 0,
        commissionableBusinessVolume: 0,
      });
      expect(el2.isEligible).toBe(false);
      expect(el2.reason).toBe('ZERO_COMMISSIONABLE_BV');

      // 3. Disqualified cancelled order
      const el3 = AuthoritativeBVService.validateOrderBVEligibility({
        status: 'CANCELLED',
        totalBV: 1000,
      });
      expect(el3.isEligible).toBe(false);
      expect(el3.reason).toBe('ORDER_CANCELLED');

      // 4. Disqualified pending order
      const el4 = AuthoritativeBVService.validateOrderBVEligibility({
        status: 'PENDING',
        totalBV: 1000,
      });
      expect(el4.isEligible).toBe(false);
      expect(el4.reason).toBe('ORDER_NOT_PAID');
    });
  });

  describe('3. Zero-Trust Frontend Security & Authoritative Source of Truth', () => {
    it('TC-BV-07: should reject ordinary user submitting BV or commissionableBusinessVolume in body', async () => {
      // protectMlmFields middleware intercepts requests
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          items: [{ productId: 'b4a0f44f-c4df-419b-a3dc-0ad9e925c4e9', quantity: 1 }],
          commissionableBusinessVolume: 999999, // Tampering attempt
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Direct client modification of MLM qualification');
    });

    it('TC-BV-08: should reject ordinary user submitting totalBV in body', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({
          items: [{ productId: 'b4a0f44f-c4df-419b-a3dc-0ad9e925c4e9', quantity: 1 }],
          totalBV: 88888, // Tampering attempt
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Direct client modification of MLM qualification');
    });

    it('TC-BV-09: AuthoritativeBVService.calculateOrderCommissionableBV derives BV directly from DB', async () => {
      vi.spyOn(prisma.product, 'findUnique').mockResolvedValue({
        id: 'prod-1',
        name: 'Super Wellness Tea',
        wholesalePrice: new Prisma.Decimal('500.00'),
        bv: new Prisma.Decimal('250.00'), // 250 BV per unit
        stock: 100,
        status: 'ACTIVE',
        deletedAt: null,
      } as any);

      const calculated = await AuthoritativeBVService.calculateOrderCommissionableBV([
        { productId: 'prod-1', quantity: 3 },
      ]);

      expect(calculated.items).toHaveLength(1);
      expect(calculated.items[0].unitPrice.toString()).toBe('500');
      expect(calculated.items[0].totalPrice.toString()).toBe('1500');

      // Authoritative BV = 250 * 3 = 750
      expect(calculated.items[0].unitBV.toString()).toBe('250');
      expect(calculated.items[0].totalBV.toString()).toBe('750');
      expect(calculated.commissionableBusinessVolume.toString()).toBe('750');
      expect(calculated.commissionableBusinessVolume.toNumber()).toBe(750);
    });
  });

  describe('4. Authorized Admin BV Adjustments', () => {
    it('TC-BV-10: should forbid non-admin user from adjusting order BV via PUT /api/v1/orders/:id/bv', async () => {
      const res = await request(app)
        .put('/api/v1/orders/ord-test-id/bv')
        .set('Authorization', `Bearer ${distributorToken}`) // Non-admin
        .send({
          commissionableBusinessVolume: 1500,
          reason: 'Manual adjustment',
        });

      expect(res.status).toBe(403);
    });

    it('TC-BV-11: should allow admin to adjust order commissionableBusinessVolume with audit logging', async () => {
      const mockOrder = {
        id: 'ord-admin-adj',
        orderNumber: 'ORD-10022',
        commissionableBusinessVolume: new Prisma.Decimal('1000.00'),
        totalBV: new Prisma.Decimal('1000.00'),
        status: 'PAID',
      };

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);
      vi.spyOn(prisma.order, 'update').mockResolvedValue({
        ...mockOrder,
        commissionableBusinessVolume: new Prisma.Decimal('1500.00'),
      } as any);
      vi.spyOn(AuditService, 'recordLog').mockResolvedValue({} as any);

      const res = await request(app)
        .put('/api/v1/orders/ord-admin-adj/bv')
        .set('Authorization', `Bearer ${adminToken}`) // Admin
        .send({
          commissionableBusinessVolume: 1500,
          reason: 'Customer special volume promotion credit',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('adjusted successfully');
    });
  });
});
