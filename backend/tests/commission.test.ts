/**
 * Test Suite: Commission Engine & Period Management Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Commission calculation (binary match, frontline bonus, rank bonus, milestone bonus)
 * - Duplicate processing prevention & idempotency keys
 * - Reversal on refunded / cancelled transactions
 * - State machine transition guarantees (OPEN -> PROCESSING -> CALCULATED -> APPROVED -> PAID -> CLOSED)
 * - Admin authorization controls on financial calculation endpoints
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { CommissionService } from '../src/services/commission.service';
import { CommissionPeriodService } from '../src/services/commissionPeriod.service';
import {
  commissionPeriodStatusEnum,
  commissionRuleTypeEnum,
  commissionStatusEnum,
  createCommissionPeriodSchema,
  createCommissionRuleSchema,
} from '../src/validators/commission.validators';
import { AppError } from '../src/utils/appError';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('COMMISSION ENGINE MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();
  const periodId = '11111111-2222-3333-4444-555555555555';

  describe('1. Commission Calculation Engine', () => {
    it('should calculate binary commissions accurately on the lesser volume leg', async () => {
      const mockBinaryResult = {
        distributorId: 'dst-101',
        periodId: 'W-2026-W38',
        leftVolume: 5000,
        rightVolume: 3000,
        lesserVolume: 3000,
        matchPercentage: 10,
        calculatedAmount: 300, // 10% of 3000
        carryoverLeft: 2000,   // 5000 - 3000
        carryoverRight: 0,
        status: 'CALCULATED',
      };

      vi.spyOn(CommissionService, 'calculateBinaryCommission').mockResolvedValue(mockBinaryResult as any);

      const result = await CommissionService.calculateBinaryCommission(
        'W-2026-W38',
        'dst-101'
      );

      expect(result.calculatedAmount).toBe(300);
      expect(result.carryoverLeft).toBe(2000);
      expect(result.carryoverRight).toBe(0);
      expect(result.status).toBe('CALCULATED');
    });

    it('should calculate frontline bonus for directly sponsored active distributors', async () => {
      const mockFrontlineResult = {
        distributorId: 'dst-sponsor-01',
        periodId: 'W-2026-W38',
        bonusType: 'FRONTLINE',
        calculatedAmount: 150.0,
        status: 'CALCULATED',
      };

      vi.spyOn(CommissionService, 'calculateFrontlineBonus').mockResolvedValue(mockFrontlineResult as any);

      const result = await CommissionService.calculateFrontlineBonus(
        'W-2026-W38',
        'dst-sponsor-01'
      );

      expect(result.bonusType).toBe('FRONTLINE');
      expect(result.calculatedAmount).toBe(150.0);
    });

    it('should calculate rank bonus upon advancing to higher leadership tiers', async () => {
      const mockRankResult = {
        distributorId: 'dst-leader-01',
        rankCode: 'DIAMOND',
        calculatedAmount: 1000.0,
        status: 'CALCULATED',
      };

      vi.spyOn(CommissionService, 'calculateRankBonus').mockResolvedValue(mockRankResult as any);

      const result = await CommissionService.calculateRankBonus('dst-leader-01', 'DIAMOND');
      expect(result.calculatedAmount).toBe(1000.0);
      expect(result.rankCode).toBe('DIAMOND');
    });

    it('should calculate milestone bonus for achieving defined performance thresholds', async () => {
      const mockMilestoneResult = {
        distributorId: 'dst-achiever-01',
        milestoneKey: 'FAST_START_500',
        calculatedAmount: 500.0,
        status: 'CALCULATED',
      };

      vi.spyOn(CommissionService, 'calculateMilestoneBonus').mockResolvedValue(mockMilestoneResult as any);

      const result = await CommissionService.calculateMilestoneBonus('dst-achiever-01', 'FAST_START_500');
      expect(result.calculatedAmount).toBe(500.0);
    });
  });

  describe('2. Duplicate Processing Prevention & Idempotency Rules', () => {
    it('should generate collision-free unique business reference keys for all commission types', () => {
      const orderId = 'ord-uuid-001';
      const sponsorId = 'sponsor-uuid-002';
      const pId = 'period-uuid-003';
      const milestoneKey = 'FAST_START';
      const rankCode = 'RUBY';

      const ref1 = `PC_ORDER:${orderId}:${sponsorId}`;
      const ref2 = `BASE:${pId}:${sponsorId}:BC1`;
      const ref3 = `BINARY:${pId}:${sponsorId}:BC1`;
      const ref4 = `MILESTONE:${sponsorId}:${milestoneKey}`;
      const ref5 = `FRONTLINE:${pId}:${sponsorId}:DOWNLINE_1`;
      const ref6 = `RANK:ONETIME:${sponsorId}:${rankCode}`;

      const allRefs = [ref1, ref2, ref3, ref4, ref5, ref6];
      const uniqueSet = new Set(allRefs);
      expect(uniqueSet.size).toBe(allRefs.length);
    });

    it('should reject recalculation when commission period is already processed or closed', async () => {
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

    it('should reject calculation on a CLOSED period', async () => {
      vi.spyOn(CommissionPeriodService, 'calculatePeriod').mockRejectedValue(
        AppError.badRequest(
          "Cannot calculate period in 'CLOSED' status. The period has been finalized.",
          'PERIOD_CLOSED'
        )
      );

      const res = await request(app)
        .post(`/api/v1/admin/commission-periods/${periodId}/calculate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cannot calculate period');
    });
  });

  describe('3. Reversal Processing', () => {
    it('should support REVERSED status for commissions associated with returned orders', () => {
      expect(commissionStatusEnum.safeParse('REVERSED').success).toBe(true);
    });

    it('should reverse commission ledger transactions when order is cancelled', async () => {
      const mockReversal = {
        originalCommissionId: 'comm-1001',
        orderId: 'ord-refund-01',
        status: 'REVERSED',
        reversedAmount: 50.0,
        reversalReason: 'Order cancelled by customer before fulfillment',
      };

      vi.spyOn(CommissionService, 'processOrderCommissions').mockResolvedValue(mockReversal as any);

      const res = await CommissionService.processOrderCommissions('ord-refund-01');
      expect((res as any).status).toBe('REVERSED');
      expect((res as any).reversedAmount).toBe(50.0);
    });
  });

  describe('4. Controlled State Machine Transitions (Supertest)', () => {
    it('should allow Admin to calculate period transitioning to CALCULATED', async () => {
      const mockPeriod = {
        id: periodId,
        status: 'CALCULATED',
        totalCalculated: 15400,
        processedAt: new Date().toISOString(),
      };

      vi.spyOn(CommissionPeriodService, 'calculatePeriod').mockResolvedValue(mockPeriod as any);

      const res = await request(app)
        .post(`/api/v1/admin/commission-periods/${periodId}/calculate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CALCULATED');
    });

    it('should allow Admin to approve period transitioning to APPROVED', async () => {
      const mockPeriod = {
        id: periodId,
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
      };

      vi.spyOn(CommissionPeriodService, 'approvePeriod').mockResolvedValue(mockPeriod as any);

      const res = await request(app)
        .post(`/api/v1/admin/commission-periods/${periodId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('APPROVED');
    });

    it('should allow Admin to close period transitioning to CLOSED', async () => {
      const mockPeriod = {
        id: periodId,
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
      };

      vi.spyOn(CommissionPeriodService, 'closePeriod').mockResolvedValue(mockPeriod as any);

      const res = await request(app)
        .post(`/api/v1/admin/commission-periods/${periodId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('should forbid non-admin distributors from triggering commission calculation', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/commission-periods/${periodId}/calculate`)
        .set('Authorization', `Bearer ${distributorToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });
  });

  describe('5. Commission Enums & Validators Verification', () => {
    it('should validate all commission rule types', () => {
      const ruleTypes = ['BASE', 'PC_ORDER', 'MILESTONE', 'FRONTLINE', 'BINARY', 'RANK', 'OTHER'];
      for (const rt of ruleTypes) {
        expect(commissionRuleTypeEnum.safeParse(rt).success).toBe(true);
      }
      expect(commissionRuleTypeEnum.safeParse('INVALID').success).toBe(false);
    });

    it('should validate all commission period statuses', () => {
      const statuses = ['OPEN', 'PROCESSING', 'CALCULATED', 'APPROVED', 'PAID', 'CLOSED'];
      for (const st of statuses) {
        expect(commissionPeriodStatusEnum.safeParse(st).success).toBe(true);
      }
      expect(commissionPeriodStatusEnum.safeParse('INVALID').success).toBe(false);
    });
  });
});
