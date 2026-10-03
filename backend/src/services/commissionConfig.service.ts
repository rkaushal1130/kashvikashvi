import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import {
  CommissionRateConfig,
  CommissionConfigValidationResult,
  UpdateCommissionRateInput,
  CANONICAL_DEFAULT_RATES,
} from '../types/commissionConfig.types';

export class CommissionConfigService {
  private static cache: CommissionRateConfig[] | null = null;
  private static cacheExpiry: number = 0;
  private static readonly CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

  /**
   * Clears the in-memory cache of commission rates
   */
  public static clearCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Retrieves all active commission rates ordered by levelNumber ascending (Levels 1 to 5).
   * Reads from database configuration table, with automated fallback to canonical defaults
   * if the database is unseeded or undergoing migration.
   */
  public static async getCommissionRates(
    client?: Prisma.TransactionClient
  ): Promise<CommissionRateConfig[]> {
    const now = Date.now();
    if (!client && this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    const db = client || prisma;

    try {
      const records = await db.commissionLevel.findMany({
        where: { isActive: true },
        orderBy: { levelNumber: 'asc' },
      });

      if (records && records.length === 5) {
        const rates: CommissionRateConfig[] = records.map((r) => ({
          id: r.id,
          levelNumber: r.levelNumber,
          percentage: r.percentage,
          percentageNumber: r.percentage.toNumber(),
          isActive: r.isActive,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));

        if (!client) {
          this.cache = rates;
          this.cacheExpiry = now + this.CACHE_TTL_MS;
        }

        return rates;
      }

      if (records && records.length > 0) {
        // Merge found records with fallback defaults for missing levels
        const recordMap = new Map<number, typeof records[0]>();
        for (const r of records) {
          recordMap.set(r.levelNumber, r);
        }

        const merged: CommissionRateConfig[] = CANONICAL_DEFAULT_RATES.map((def) => {
          const rec = recordMap.get(def.levelNumber);
          if (rec) {
            return {
              id: rec.id,
              levelNumber: rec.levelNumber,
              percentage: rec.percentage,
              percentageNumber: rec.percentage.toNumber(),
              isActive: rec.isActive,
              createdAt: rec.createdAt,
              updatedAt: rec.updatedAt,
            };
          }
          const dec = new Prisma.Decimal(def.percentage);
          return {
            levelNumber: def.levelNumber,
            percentage: dec,
            percentageNumber: dec.toNumber(),
            isActive: true,
          };
        });

        if (!client) {
          this.cache = merged;
          this.cacheExpiry = now + this.CACHE_TTL_MS;
        }

        return merged;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Failed to load commission levels from database; utilizing canonical defaults');
    }

    // Default canonical rates: 1: 24%, 2: 8%, 3: 13%, 4: 5%, 5: 4%
    const defaultRates: CommissionRateConfig[] = CANONICAL_DEFAULT_RATES.map((def) => {
      const dec = new Prisma.Decimal(def.percentage);
      return {
        levelNumber: def.levelNumber,
        percentage: dec,
        percentageNumber: dec.toNumber(),
        isActive: true,
      };
    });

    if (!client) {
      this.cache = defaultRates;
      this.cacheExpiry = now + this.CACHE_TTL_MS;
    }

    return defaultRates;
  }

  /**
   * Retrieves the configured commission rate for a specific generation level (1 through 5).
   * Validates levelNumber constraint.
   */
  public static async getCommissionRate(
    levelNumber: number,
    client?: Prisma.TransactionClient
  ): Promise<CommissionRateConfig> {
    if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 5) {
      throw AppError.badRequest(
        `Invalid commission level: ${levelNumber}. Level must be an integer between 1 and 5.`,
        'INVALID_COMMISSION_LEVEL'
      );
    }

    const rates = await this.getCommissionRates(client);
    const found = rates.find((r) => r.levelNumber === levelNumber);

    if (found) {
      return found;
    }

    // Fallback if not found in cache/DB
    const canonical = CANONICAL_DEFAULT_RATES.find((d) => d.levelNumber === levelNumber);
    const dec = new Prisma.Decimal(canonical ? canonical.percentage : '0.00');
    return {
      levelNumber,
      percentage: dec,
      percentageNumber: dec.toNumber(),
      isActive: true,
    };
  }

  /**
   * Validates the integrity of the commission configuration system:
   * 1. All 5 generation levels (1, 2, 3, 4, 5) must exist.
   * 2. All 5 generation levels must be marked active.
   * 3. Percentages must be non-negative and finite decimals.
   * 4. Calculates total theoretical distribution (e.g. 54.00%).
   */
  public static async validateCommissionConfiguration(
    client?: Prisma.TransactionClient
  ): Promise<CommissionConfigValidationResult> {
    const db = client || prisma;
    const errors: string[] = [];

    let records: any[] = [];
    try {
      records = await db.commissionLevel.findMany({
        orderBy: { levelNumber: 'asc' },
      });
    } catch (err: any) {
      errors.push(`Database error querying commission levels: ${err?.message}`);
    }

    const levelsMap = new Map<number, any>();
    for (const r of records) {
      levelsMap.set(r.levelNumber, r);
    }

    let totalPct = new Prisma.Decimal('0.00');
    const checkedLevels: CommissionRateConfig[] = [];

    for (let lvl = 1; lvl <= 5; lvl++) {
      const rec = levelsMap.get(lvl);

      if (!rec) {
        errors.push(`Missing configuration for Commission Level ${lvl}`);
        // Populate fallback for reporting
        const canonical = CANONICAL_DEFAULT_RATES.find((d) => d.levelNumber === lvl);
        const dec = new Prisma.Decimal(canonical ? canonical.percentage : '0.00');
        checkedLevels.push({
          levelNumber: lvl,
          percentage: dec,
          percentageNumber: dec.toNumber(),
          isActive: false,
        });
        continue;
      }

      if (!rec.isActive) {
        errors.push(`Commission Level ${lvl} is configured but marked inactive`);
      }

      const dec = SafeDecimal.toDecimal(rec.percentage);
      if (dec.lessThan(0)) {
        errors.push(`Commission Level ${lvl} has a negative percentage: ${dec.toString()}%`);
      }
      if (dec.greaterThan(100)) {
        errors.push(`Commission Level ${lvl} percentage exceeds 100%: ${dec.toString()}%`);
      }

      totalPct = totalPct.add(dec);
      checkedLevels.push({
        id: rec.id,
        levelNumber: rec.levelNumber,
        percentage: dec,
        percentageNumber: dec.toNumber(),
        isActive: rec.isActive,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      });
    }

    // Check total percentage bounds
    if (totalPct.greaterThan(100)) {
      errors.push(`Total commission distribution (${totalPct.toString()}%) exceeds 100% maximum allowed`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      levels: checkedLevels,
      totalPercentage: totalPct,
      totalPercentageNumber: totalPct.toNumber(),
    };
  }

  /**
   * Updates or creates a commission rate configuration for a level (Admin operation).
   * Validates levelNumber (1-5) and percentage range (0-100%).
   */
  public static async updateCommissionRate(
    input: UpdateCommissionRateInput,
    client?: Prisma.TransactionClient
  ): Promise<CommissionRateConfig> {
    const { levelNumber, percentage, isActive = true } = input;

    if (!Number.isInteger(levelNumber) || levelNumber < 1 || levelNumber > 5) {
      throw AppError.badRequest(
        `Invalid level number: ${levelNumber}. Level must be an integer between 1 and 5.`,
        'INVALID_COMMISSION_LEVEL'
      );
    }

    const dec = SafeDecimal.toDecimal(percentage);
    if (dec.lessThan(0) || dec.greaterThan(100)) {
      throw AppError.badRequest(
        `Invalid percentage: ${dec.toString()}. Percentage must be between 0.00% and 100.00%.`,
        'INVALID_COMMISSION_PERCENTAGE'
      );
    }

    const db = client || prisma;

    const updated = await db.commissionLevel.upsert({
      where: { levelNumber },
      update: {
        percentage: dec,
        isActive,
      },
      create: {
        levelNumber,
        percentage: dec,
        isActive,
      },
    });

    this.clearCache();

    logger.info(
      { levelNumber, percentage: dec.toString(), isActive },
      'Commission rate configuration updated'
    );

    return {
      id: updated.id,
      levelNumber: updated.levelNumber,
      percentage: updated.percentage,
      percentageNumber: updated.percentage.toNumber(),
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Initializes or resets database commission levels to canonical default values:
   * Level 1 = 24%, Level 2 = 8%, Level 3 = 13%, Level 4 = 5%, Level 5 = 4%
   */
  public static async initializeDefaultRates(
    client?: Prisma.TransactionClient
  ): Promise<CommissionRateConfig[]> {
    const db = client || prisma;
    const results: CommissionRateConfig[] = [];

    for (const def of CANONICAL_DEFAULT_RATES) {
      const dec = new Prisma.Decimal(def.percentage);
      const record = await db.commissionLevel.upsert({
        where: { levelNumber: def.levelNumber },
        update: {
          percentage: dec,
          isActive: true,
        },
        create: {
          levelNumber: def.levelNumber,
          percentage: dec,
          isActive: true,
        },
      });

      results.push({
        id: record.id,
        levelNumber: record.levelNumber,
        percentage: record.percentage,
        percentageNumber: record.percentage.toNumber(),
        isActive: record.isActive,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }

    this.clearCache();
    return results;
  }
}
