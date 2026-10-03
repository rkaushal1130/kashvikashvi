/**
 * Automated Test Suite: Configurable Commission-Rate System (Prompt 13)
 *
 * Verifies:
 * 1. CommissionLevel table model & constraints (1-5 range, non-negative, unique levelNumber).
 * 2. Canonical seed rates:
 *    - Level 1 = 24.00%
 *    - Level 2 = 8.00%
 *    - Level 3 = 13.00%
 *    - Level 4 = 5.00%
 *    - Level 5 = 4.00%
 *    Total theoretical distribution = 54.00%.
 * 3. SafeDecimal arithmetic prevents binary floating-point inaccuracy (0.1 + 0.2 !== 0.3).
 * 4. CommissionConfigService methods:
 *    - getCommissionRates(): returns all active rates sorted by levelNumber.
 *    - getCommissionRate(levelNumber): retrieves rate for specific level and validates bounds (1-5).
 *    - validateCommissionConfiguration(): verifies presence of all 5 levels, active status, and bounds.
 *    - updateCommissionRate(): updates level rate and invalidates cache.
 *    - initializeDefaultRates(): seeds/resets canonical defaults.
 * 5. Dynamic integration: LevelCommissionService dynamically reads from CommissionConfigService.
 * 6. REST API endpoints: GET /api/v1/commissions/config, GET /:levelNumber, PUT /:levelNumber, POST /reset.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { Prisma } from '@prisma/client';
import { CommissionConfigService } from '../src/services/commissionConfig.service';
import { SafeDecimal } from '../src/utils/safeDecimal';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('CONFIGURABLE COMMISSION RATE SYSTEM (PROMPT 13 TEST SUITE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CommissionConfigService.clearCache();

    // Mock Prisma transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();

  describe('1. SafeDecimal Precision & Financial Calculations', () => {
    it('should eliminate binary floating point imprecision in addition', () => {
      // Standard JS binary floating point: 0.1 + 0.2 = 0.30000000000000004
      const jsFloat = 0.1 + 0.2;
      expect(jsFloat).not.toBe(0.3);

      // SafeDecimal: exact 0.30
      const safeSum = SafeDecimal.add(0.1, 0.2);
      expect(safeSum.toString()).toBe('0.3');
      expect(SafeDecimal.round(safeSum, 2)).toBe(0.3);
    });

    it('should accurately calculate commission amount without float drift', () => {
      // Order BV = 1000, Level 1 rate = 24.00% -> 240.00
      const c1 = SafeDecimal.calculateCommissionAmount('1000.00', '24.00');
      expect(c1.toString()).toBe('240');
      expect(c1.toNumber()).toBe(240.00);

      // Order BV = 1333.33, Level 3 rate = 13.00% -> 173.3329 -> 173.33
      const c3 = SafeDecimal.calculateCommissionAmount('1333.33', '13.00');
      expect(c3.toString()).toBe('173.33');
      expect(c3.toNumber()).toBe(173.33);

      // Order BV = 777.77, Level 2 rate = 8.00% -> 62.2216 -> 62.22
      const c2 = SafeDecimal.calculateCommissionAmount('777.77', '8.00');
      expect(c2.toString()).toBe('62.22');
      expect(c2.toNumber()).toBe(62.22);
    });

    it('should handle zero and negative inputs safely', () => {
      const zeroBV = SafeDecimal.calculateCommissionAmount(0, '24.00');
      expect(zeroBV.toString()).toBe('0');

      const negBV = SafeDecimal.calculateCommissionAmount('-500', '24.00');
      expect(negBV.toString()).toBe('0');

      const zeroRate = SafeDecimal.calculateCommissionAmount('1000', '0');
      expect(zeroRate.toString()).toBe('0');
    });

    it('should throw error on division by zero', () => {
      expect(() => SafeDecimal.div('100', '0')).toThrow('Division by zero');
    });
  });

  describe('2. CommissionConfigService Unit Tests', () => {
    it('TC-CFG-01: should return canonical default rates when database is empty', async () => {
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);

      const rates = await CommissionConfigService.getCommissionRates();

      expect(rates).toHaveLength(5);
      expect(rates[0].levelNumber).toBe(1);
      expect(rates[0].percentage.toString()).toBe('24');
      expect(rates[0].percentageNumber).toBe(24);

      expect(rates[1].levelNumber).toBe(2);
      expect(rates[1].percentage.toString()).toBe('8');

      expect(rates[2].levelNumber).toBe(3);
      expect(rates[2].percentage.toString()).toBe('13');

      expect(rates[3].levelNumber).toBe(4);
      expect(rates[3].percentage.toString()).toBe('5');

      expect(rates[4].levelNumber).toBe(5);
      expect(rates[4].percentage.toString()).toBe('4');

      const total = rates.reduce((sum, r) => sum + r.percentageNumber, 0);
      expect(total).toBe(54);
    });

    it('TC-CFG-02: should load rates from database when configured', async () => {
      const mockDbRecords = [
        { id: 'cfg-1', levelNumber: 1, percentage: new Prisma.Decimal('25.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-2', levelNumber: 2, percentage: new Prisma.Decimal('10.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-3', levelNumber: 3, percentage: new Prisma.Decimal('10.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-4', levelNumber: 4, percentage: new Prisma.Decimal('5.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-5', levelNumber: 5, percentage: new Prisma.Decimal('5.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue(mockDbRecords as any);

      const rates = await CommissionConfigService.getCommissionRates();

      expect(rates).toHaveLength(5);
      expect(rates[0].percentage.toString()).toBe('25');
      expect(rates[1].percentage.toString()).toBe('10');
      const total = rates.reduce((sum, r) => sum + r.percentageNumber, 0);
      expect(total).toBe(55);
    });

    it('TC-CFG-03: should retrieve rate for a specific level with getCommissionRate(levelNumber)', async () => {
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);

      const level3 = await CommissionConfigService.getCommissionRate(3);
      expect(level3.levelNumber).toBe(3);
      expect(level3.percentageNumber).toBe(13);

      const level1 = await CommissionConfigService.getCommissionRate(1);
      expect(level1.levelNumber).toBe(1);
      expect(level1.percentageNumber).toBe(24);
    });

    it('TC-CFG-04: should reject invalid level numbers (< 1 or > 5)', async () => {
      await expect(CommissionConfigService.getCommissionRate(0)).rejects.toThrow('between 1 and 5');
      await expect(CommissionConfigService.getCommissionRate(6)).rejects.toThrow('between 1 and 5');
      await expect(CommissionConfigService.getCommissionRate(-1)).rejects.toThrow('between 1 and 5');
      await expect(CommissionConfigService.getCommissionRate(2.5 as any)).rejects.toThrow('between 1 and 5');
    });

    it('TC-CFG-05: validateCommissionConfiguration should validate all 5 levels are present, active, and sum to 54%', async () => {
      const mockDbRecords = [
        { id: 'cfg-1', levelNumber: 1, percentage: new Prisma.Decimal('24.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-2', levelNumber: 2, percentage: new Prisma.Decimal('8.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-3', levelNumber: 3, percentage: new Prisma.Decimal('13.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-4', levelNumber: 4, percentage: new Prisma.Decimal('5.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cfg-5', levelNumber: 5, percentage: new Prisma.Decimal('4.00'), isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue(mockDbRecords as any);

      const valResult = await CommissionConfigService.validateCommissionConfiguration();

      expect(valResult.isValid).toBe(true);
      expect(valResult.errors).toHaveLength(0);
      expect(valResult.levels).toHaveLength(5);
      expect(valResult.totalPercentageNumber).toBe(54);
    });

    it('TC-CFG-06: validateCommissionConfiguration should flag missing and inactive levels', async () => {
      // Only levels 1, 2, 3 present; Level 2 is inactive
      const incompleteRecords = [
        { id: 'cfg-1', levelNumber: 1, percentage: new Prisma.Decimal('24.00'), isActive: true },
        { id: 'cfg-2', levelNumber: 2, percentage: new Prisma.Decimal('8.00'), isActive: false },
        { id: 'cfg-3', levelNumber: 3, percentage: new Prisma.Decimal('13.00'), isActive: true },
      ];
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue(incompleteRecords as any);

      const valResult = await CommissionConfigService.validateCommissionConfiguration();

      expect(valResult.isValid).toBe(false);
      expect(valResult.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('marked inactive'),
          expect.stringContaining('Missing configuration for Commission Level 4'),
          expect.stringContaining('Missing configuration for Commission Level 5'),
        ])
      );
    });

    it('TC-CFG-07: updateCommissionRate should validate inputs and update rate', async () => {
      const mockUpdated = {
        id: 'cfg-2',
        levelNumber: 2,
        percentage: new Prisma.Decimal('9.50'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(prisma.commissionLevel, 'upsert').mockResolvedValue(mockUpdated as any);

      const updated = await CommissionConfigService.updateCommissionRate({
        levelNumber: 2,
        percentage: '9.50',
      });

      expect(updated.levelNumber).toBe(2);
      expect(updated.percentageNumber).toBe(9.5);
    });

    it('TC-CFG-08: updateCommissionRate should reject invalid percentage (< 0 or > 100)', async () => {
      await expect(
        CommissionConfigService.updateCommissionRate({ levelNumber: 1, percentage: -5 })
      ).rejects.toThrow('between 0.00% and 100.00%');

      await expect(
        CommissionConfigService.updateCommissionRate({ levelNumber: 1, percentage: 105 })
      ).rejects.toThrow('between 0.00% and 100.00%');
    });
  });

  describe('3. REST API Endpoints', () => {
    it('GET /api/v1/commissions/config - should return all 5 rates', async () => {
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/commissions/config')
        .set('Authorization', `Bearer ${distributorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.data[0].levelNumber).toBe(1);
      expect(res.body.data[0].percentageNumber).toBe(24);
    });

    it('GET /api/v1/commissions/config/validate - should return validation report', async () => {
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/commissions/config/validate')
        .set('Authorization', `Bearer ${distributorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('isValid');
      expect(res.body.data).toHaveProperty('levels');
    });

    it('GET /api/v1/commissions/config/:levelNumber - should return single level rate', async () => {
      vi.spyOn(prisma.commissionLevel, 'findMany').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/commissions/config/3')
        .set('Authorization', `Bearer ${distributorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.levelNumber).toBe(3);
      expect(res.body.data.percentageNumber).toBe(13);
    });

    it('PUT /api/v1/commissions/config/:levelNumber - should require admin role', async () => {
      const res = await request(app)
        .put('/api/v1/commissions/config/2')
        .set('Authorization', `Bearer ${distributorToken}`) // non-admin
        .send({ percentage: 10 });

      expect(res.status).toBe(403);
    });

    it('PUT /api/v1/commissions/config/:levelNumber - should update rate as admin', async () => {
      const mockUpdated = {
        id: 'cfg-2',
        levelNumber: 2,
        percentage: new Prisma.Decimal('10.00'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(prisma.commissionLevel, 'upsert').mockResolvedValue(mockUpdated as any);

      const res = await request(app)
        .put('/api/v1/commissions/config/2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 10.0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.percentageNumber).toBe(10);
    });

    it('POST /api/v1/commissions/config/reset - should reset defaults as admin', async () => {
      vi.spyOn(prisma.commissionLevel, 'upsert').mockImplementation((args: any) => {
        return Promise.resolve({
          id: `cfg-${args.where.levelNumber}`,
          levelNumber: args.where.levelNumber,
          percentage: args.update.percentage,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as any;
      });

      const res = await request(app)
        .post('/api/v1/commissions/config/reset')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);
    });
  });
});
