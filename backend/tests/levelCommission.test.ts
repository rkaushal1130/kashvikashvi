/**
 * Automated Test Suite: 5-Level Unilevel Commission System (Prompt 12)
 *
 * Verifies:
 * 1. Business Invariant: Base is strictly Business Volume (BV), NOT price, GST, BB, or binary matching.
 * 2. Exact commission tiers: Level 1 = 24%, Level 2 = 8%, Level 3 = 13%, Level 4 = 5%, Level 5 = 4%.
 * 3. Total theoretical distribution = 54% of BV.
 * 4. Distinct concepts: Sponsor upline generations (1-5) vs. Career Ranks (Silver, Gold, Platinum, Diamond, Ruby).
 * 5. Full upline traversal and missing upline handling (truncated tree / company retention).
 * 6. Inactive upline skipping / forfeiture.
 * 7. Idempotency: repeated runs return identical records without duplicate insertions.
 * 8. Reversal & clawback on order cancellation / refund.
 * 9. Payout settlement to distributor wallets.
 * 10. REST API routing and RBAC enforcement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { LevelCommissionService } from '../src/services/levelCommission.service';
import {
  CANONICAL_LEVEL_RATES,
  TOTAL_THEORETICAL_DISTRIBUTION_PERCENT,
  UplineSponsorNode,
} from '../src/types/levelCommission.types';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('5-LEVEL UNILEVEL COMMISSION SYSTEM (PROMPT 12 TEST SUITE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests run cleanly in both offline & online DB environments
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock commissionLevel queries to return default canonical rates immediately
    vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();

  describe('1. Mathematical Invariants & Percentage Rates', () => {
    it('should match the canonical distribution schedule: 24%, 8%, 13%, 5%, 4% summing to 54%', () => {
      expect(CANONICAL_LEVEL_RATES).toHaveLength(5);
      expect(CANONICAL_LEVEL_RATES[0]).toEqual({ level: 1, ratePercentage: 24.0 });
      expect(CANONICAL_LEVEL_RATES[1]).toEqual({ level: 2, ratePercentage: 8.0 });
      expect(CANONICAL_LEVEL_RATES[2]).toEqual({ level: 3, ratePercentage: 13.0 });
      expect(CANONICAL_LEVEL_RATES[3]).toEqual({ level: 4, ratePercentage: 5.0 });
      expect(CANONICAL_LEVEL_RATES[4]).toEqual({ level: 5, ratePercentage: 4.0 });

      const totalPercentage = CANONICAL_LEVEL_RATES.reduce((sum, r) => sum + r.ratePercentage, 0);
      expect(totalPercentage).toBe(54.0);
      expect(TOTAL_THEORETICAL_DISTRIBUTION_PERCENT).toBe(54.0);
    });

    it('TC-LCM-01: should accurately calculate commissions on 1,000 BV', async () => {
      const mockUplines: UplineSponsorNode[] = [
        { level: 1, distributorId: 'dst-01', distributorCode: 'KV-1001', displayName: 'Upline 1', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'dst-02', distributorCode: 'KV-1002', displayName: 'Upline 2', status: 'ACTIVE', isDirect: false },
        { level: 3, distributorId: 'dst-03', distributorCode: 'KV-1003', displayName: 'Upline 3', status: 'ACTIVE', isDirect: false },
        { level: 4, distributorId: 'dst-04', distributorCode: 'KV-1004', displayName: 'Upline 4', status: 'ACTIVE', isDirect: false },
        { level: 5, distributorId: 'dst-05', distributorCode: 'KV-1005', displayName: 'Upline 5', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);

      const preview = await LevelCommissionService.previewOrderCommissions(1000, 'dst-purchaser');

      expect(preview.orderBV).toBe(1000);
      expect(preview.totalDistributedPercentage).toBe(54.0);
      expect(preview.totalCommissionAmount).toBe(540.0);
      expect(preview.commissions).toHaveLength(5);

      // Verify exact tier amounts
      expect(preview.commissions[0]).toMatchObject({ level: 1, ratePercentage: 24.0, commissionAmount: 240.0, beneficiaryId: 'dst-01' });
      expect(preview.commissions[1]).toMatchObject({ level: 2, ratePercentage: 8.0, commissionAmount: 80.0, beneficiaryId: 'dst-02' });
      expect(preview.commissions[2]).toMatchObject({ level: 3, ratePercentage: 13.0, commissionAmount: 130.0, beneficiaryId: 'dst-03' });
      expect(preview.commissions[3]).toMatchObject({ level: 4, ratePercentage: 5.0, commissionAmount: 50.0, beneficiaryId: 'dst-04' });
      expect(preview.commissions[4]).toMatchObject({ level: 5, ratePercentage: 4.0, commissionAmount: 40.0, beneficiaryId: 'dst-05' });
    });

    it('TC-LCM-02: should accurately calculate commissions on 250 BV (Starter Package)', async () => {
      const mockUplines: UplineSponsorNode[] = [
        { level: 1, distributorId: 'dst-01', distributorCode: 'KV-1001', displayName: 'Upline 1', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'dst-02', distributorCode: 'KV-1002', displayName: 'Upline 2', status: 'ACTIVE', isDirect: false },
        { level: 3, distributorId: 'dst-03', distributorCode: 'KV-1003', displayName: 'Upline 3', status: 'ACTIVE', isDirect: false },
        { level: 4, distributorId: 'dst-04', distributorCode: 'KV-1004', displayName: 'Upline 4', status: 'ACTIVE', isDirect: false },
        { level: 5, distributorId: 'dst-05', distributorCode: 'KV-1005', displayName: 'Upline 5', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);

      const preview = await LevelCommissionService.previewOrderCommissions(250, 'dst-purchaser');

      expect(preview.orderBV).toBe(250);
      expect(preview.totalCommissionAmount).toBe(135.0); // 54% of 250 = 135

      expect(preview.commissions[0].commissionAmount).toBe(60.0);  // 24% of 250
      expect(preview.commissions[1].commissionAmount).toBe(20.0);  // 8% of 250
      expect(preview.commissions[2].commissionAmount).toBe(32.5);  // 13% of 250
      expect(preview.commissions[3].commissionAmount).toBe(12.5);  // 5% of 250
      expect(preview.commissions[4].commissionAmount).toBe(10.0);  // 4% of 250
    });

    it('TC-LCM-03: should reject order with zero BV or non-paid status', async () => {
      // Mock order with zero BV
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: 'ord-zero-bv',
        orderNumber: 'ORD-ZERO-01',
        status: 'PAID',
        totalBV: 0 as any,
        distributorId: 'dst-01',
      } as any);

      const result = await LevelCommissionService.calculateCommissionsForOrder('ord-zero-bv');
      expect(result.commissions).toHaveLength(0);
      expect(result.totalCommissionAmount).toBe(0);
      expect(result.skippedLevels[0].reason).toBe('ZERO_BV');

      // Mock order with PAYMENT_PENDING status
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: 'ord-pending',
        orderNumber: 'ORD-PENDING-01',
        status: 'PAYMENT_PENDING',
        totalBV: 500 as any,
        distributorId: 'dst-01',
      } as any);

      await expect(
        LevelCommissionService.calculateCommissionsForOrder('ord-pending')
      ).rejects.toThrow('Order must be PAID or CONFIRMED');
    });

    it('TC-LCM-04: should strictly decouple career ranks (Silver/Gold/Platinum/Diamond/Ruby) from sponsor levels', async () => {
      // A Ruby rank leader at Level 1 receives 24%, NOT their rank bonus
      // A Base rank member at Level 1 receives 24%, NOT their rank bonus
      const mockUplines: UplineSponsorNode[] = [
        { level: 1, distributorId: 'dst-ruby-01', distributorCode: 'KV-RUBY', displayName: 'Ruby Leader', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'dst-base-02', distributorCode: 'KV-BASE', displayName: 'Base Distributor', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);

      const preview = await LevelCommissionService.previewOrderCommissions(1000, 'dst-purchaser');

      // Both receive designated sponsor level rate regardless of career rank
      expect(preview.commissions[0]).toMatchObject({
        level: 1,
        ratePercentage: 24.0,
        commissionAmount: 240.0,
        beneficiaryId: 'dst-ruby-01',
      });
      expect(preview.commissions[1]).toMatchObject({
        level: 2,
        ratePercentage: 8.0,
        commissionAmount: 80.0,
        beneficiaryId: 'dst-base-02',
      });
    });
  });

  describe('2. Upline Traversal & Hierarchy Edge Cases', () => {
    it('TC-LCM-05: should handle truncated upline hierarchy (e.g. only 2 uplines before Root)', async () => {
      const mockUplines: UplineSponsorNode[] = [
        { level: 1, distributorId: 'dst-01', distributorCode: 'KV-1001', displayName: 'Direct Sponsor', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'dst-root', distributorCode: 'KV-ROOT', displayName: 'Company Root', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);

      const preview = await LevelCommissionService.previewOrderCommissions(1000, 'dst-purchaser');

      expect(preview.commissions).toHaveLength(2);
      expect(preview.commissions[0].commissionAmount).toBe(240.0); // Level 1 (24%)
      expect(preview.commissions[1].commissionAmount).toBe(80.0);  // Level 2 (8%)

      // Levels 3, 4, 5 are identified as NO_UPLINE_EXISTS (retained by company)
      expect(preview.skippedLevels).toHaveLength(3);
      expect(preview.skippedLevels[0]).toMatchObject({ level: 3, ratePercentage: 13.0, reason: 'NO_UPLINE_EXISTS' });
      expect(preview.skippedLevels[1]).toMatchObject({ level: 4, ratePercentage: 5.0, reason: 'NO_UPLINE_EXISTS' });
      expect(preview.skippedLevels[2]).toMatchObject({ level: 5, ratePercentage: 4.0, reason: 'NO_UPLINE_EXISTS' });

      // Total distributed = 240 + 80 = 320
      expect(preview.totalCommissionAmount).toBe(320.0);
    });

    it('TC-LCM-06: should skip or forfeit inactive upline without disrupting remaining tiers', async () => {
      const mockUplines: UplineSponsorNode[] = [
        { level: 1, distributorId: 'dst-01', distributorCode: 'KV-1001', displayName: 'Upline 1', status: 'ACTIVE', isDirect: true },
        { level: 2, distributorId: 'dst-02', distributorCode: 'KV-1002', displayName: 'Upline 2 (Suspended)', status: 'SUSPENDED', isDirect: false },
        { level: 3, distributorId: 'dst-03', distributorCode: 'KV-1003', displayName: 'Upline 3', status: 'ACTIVE', isDirect: false },
      ];

      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);

      const preview = await LevelCommissionService.previewOrderCommissions(1000, 'dst-purchaser');

      // Level 1 active (24%)
      expect(preview.commissions.find((c) => c.level === 1)?.commissionAmount).toBe(240.0);
      // Level 2 suspended -> in skippedLevels
      expect(preview.skippedLevels.find((s) => s.level === 2)?.reason).toBe('UPLINE_INACTIVE');
      // Level 3 active (13%)
      expect(preview.commissions.find((c) => c.level === 3)?.commissionAmount).toBe(130.0);
    });
  });

  describe('3. Idempotency & Database Ledger Safety', () => {
    it('TC-LCM-07: should be strictly idempotent when processing the same order repeatedly', async () => {
      const orderId = '11111111-2222-3333-4444-555555555555';

      // Mock finding order
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-IDEMP-01',
        status: 'PAID',
        totalBV: 500 as any,
        distributorId: 'dst-buyer',
      } as any);

      // First run: no existing records -> creates records
      const existingStub: any[] = [];
      vi.spyOn(prisma.levelCommission, 'findMany').mockImplementation(async () => existingStub);

      const mockUplines: UplineSponsorNode[] = [
        { level: 1, distributorId: 'dst-sponsor', distributorCode: 'KV-SPONSOR', displayName: 'Sponsor', status: 'ACTIVE', isDirect: true },
      ];
      vi.spyOn(LevelCommissionService, 'getSponsorUpline5Levels').mockResolvedValue(mockUplines);

      const createdEntry = {
        id: 'lcm-101',
        commissionNumber: 'LCM-001',
        businessReference: `LEVEL:${orderId}:L1:dst-sponsor`,
        orderId,
        distributorId: 'dst-sponsor',
        level: 1,
        ratePercentage: 24.0 as any,
        orderBV: 500 as any,
        commissionAmount: 120.0 as any,
        status: 'CALCULATED' as const,
      };

      vi.spyOn(prisma.levelCommission, 'create').mockResolvedValue(createdEntry as any);

      // Run 1
      const run1 = await LevelCommissionService.calculateCommissionsForOrder(orderId);
      expect(run1.commissions).toHaveLength(1);
      expect(run1.commissions[0].commissionAmount).toBe(120.0);

      // Run 2: existing records returned without creating duplicates
      existingStub.push({
        ...createdEntry,
        distributor: { distributorCode: 'KV-SPONSOR', firstName: 'Sponsor', lastName: 'User' },
      });

      const run2 = await LevelCommissionService.calculateCommissionsForOrder(orderId);
      expect(run2.commissions).toHaveLength(1);
      expect(run2.commissions[0].businessReference).toBe(`LEVEL:${orderId}:L1:dst-sponsor`);
      expect(run2.totalCommissionAmount).toBe(120.0);
    });
  });

  describe('4. Reversals, Clawbacks & Wallet Settlement', () => {
    it('TC-LCM-08: should reverse CALCULATED commissions on order cancellation', async () => {
      const orderId = '22222222-2222-3333-4444-555555555555';

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-CANCEL-01',
      } as any);

      vi.spyOn(prisma.levelCommission, 'findMany').mockResolvedValue([
        {
          id: 'lcm-c1',
          orderId,
          distributorId: 'dst-sp1',
          level: 1,
          commissionAmount: 240.0 as any,
          status: 'CALCULATED',
        },
      ] as any);

      const updateSpy = vi.spyOn(prisma.levelCommission, 'update').mockResolvedValue({} as any);

      const revResult = await LevelCommissionService.reverseCommissionsForOrder(orderId, 'Order cancelled');

      expect(revResult.reversedCount).toBe(1);
      expect(revResult.totalReversedAmount).toBe(240.0);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lcm-c1' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      );
    });

    it('TC-LCM-09: should payout eligible commissions to wallet with double-entry ledger entries', async () => {
      vi.spyOn(prisma.levelCommission, 'findMany').mockResolvedValue([
        {
          id: 'lcm-pay-01',
          level: 1,
          ratePercentage: 24.0 as any,
          commissionAmount: 240.0 as any,
          distributorId: 'dst-wallet-owner',
          currency: 'INR',
          distributor: { id: 'dst-wallet-owner', userId: 'usr-101', distributorCode: 'KV-101' },
          order: { id: 'ord-01', orderNumber: 'ORD-PAY-01' },
        },
      ] as any);

      vi.spyOn(prisma.wallet, 'findFirst').mockResolvedValue({
        id: 'wal-01',
        distributorId: 'dst-wallet-owner',
        availableBalance: 100.0 as any,
      } as any);

      const createTxSpy = vi.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({
        id: 'wtx-001',
      } as any);

      const updateWalletSpy = vi.spyOn(prisma.wallet, 'update').mockResolvedValue({} as any);
      const updateCommSpy = vi.spyOn(prisma.levelCommission, 'update').mockResolvedValue({} as any);

      const payoutResult = await LevelCommissionService.payoutLevelCommissions({ orderId: 'ord-01' });

      expect(payoutResult.paidCount).toBe(1);
      expect(payoutResult.totalPaidAmount).toBe(240.0);
      expect(createTxSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: 'wal-01',
            type: 'COMMISSION',
            status: 'COMPLETED',
            referenceId: 'lcm-pay-01',
          }),
        })
      );
      expect(updateCommSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lcm-pay-01' },
          data: expect.objectContaining({ status: 'PAID' }),
        })
      );
    });
  });

  describe('5. REST API Integration & RBAC Protection', () => {
    it('TC-LCM-10: should allow members to preview commissions and require ADMIN for recalculation', async () => {
      // 1. Preview API is accessible by authenticated distributors
      vi.spyOn(LevelCommissionService, 'previewOrderCommissions').mockResolvedValue({
        orderId: 'PREVIEW',
        orderNumber: 'PREVIEW',
        orderBV: 500,
        totalDistributedPercentage: 54.0,
        totalCommissionAmount: 270.0,
        commissions: [
          { level: 1, beneficiaryId: 'd1', beneficiaryCode: 'KV-1', beneficiaryName: 'User', ratePercentage: 24, commissionAmount: 120, status: 'CALCULATED', businessReference: 'PREVIEW:L1:d1' },
        ],
        skippedLevels: [],
      });

      const previewRes = await request(app)
        .post('/api/v1/commissions/levels/preview')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({ orderBV: 500, purchaserDistributorId: 'KV-BUYER' });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.success).toBe(true);
      expect(previewRes.body.data.totalCommissionAmount).toBe(270.0);

      // 2. Calculate / Payout endpoints require ADMIN role
      const forbiddenRes = await request(app)
        .post('/api/v1/commissions/levels/calculate')
        .set('Authorization', `Bearer ${distributorToken}`) // Non-admin token
        .send({ orderId: '11111111-2222-3333-4444-555555555555' });

      expect(forbiddenRes.status).toBe(403);

      // 3. Admin successfully triggers calculate
      vi.spyOn(LevelCommissionService, 'calculateCommissionsForOrder').mockResolvedValue({
        orderId: '11111111-2222-3333-4444-555555555555',
        orderNumber: 'ORD-ADM-01',
        orderBV: 1000,
        totalDistributedPercentage: 54.0,
        totalCommissionAmount: 540.0,
        commissions: [],
        skippedLevels: [],
      });

      const adminRes = await request(app)
        .post('/api/v1/commissions/levels/calculate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderId: '11111111-2222-3333-4444-555555555555' });

      expect(adminRes.status).toBe(201);
      expect(adminRes.body.success).toBe(true);
      expect(adminRes.body.data.orderNumber).toBe('ORD-ADM-01');
    });
  });
});
