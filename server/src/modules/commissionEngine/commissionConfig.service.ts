import { CommissionRuleConfig } from './commission.types.js';
import { config } from '../../config/env.js';

export class CommissionConfigService {
  private static currentConfig: CommissionRuleConfig = {
    matchingPercentage: config.binaryMatchPercentage || 10,
    minimumPersonalBV: config.minimumQualifyingBv || 100,
    minimumLeftBV: 0,
    minimumRightBV: 0,
    maxDailyCommission: null,
    maxMonthlyCommission: null,
    carryForwardEnabled: true,
    carryForwardCap: null,
    tdsPercentage: config.tdsDeductionPercentage || 5,
    adminFeePercentage: config.adminFeePercentage || 5,
    bvToCurrencyMultiplier: 1.0, // 1 BV = ₹1.0
    qualificationRequired: true,
    matchingRule: 'MIN_LEG',
  };

  /**
   * Get active commission rules configuration.
   */
  public static getConfig(): any {
    return {
      ...this.currentConfig,
      binaryMatchPercentage: this.currentConfig.matchingPercentage,
      directSponsorPercentage: 5,
      minPbvForQualification: this.currentConfig.minimumPersonalBV,
      monthlyMaintenanceBv: 50,
      cappingLimit: this.currentConfig.maxDailyCommission || 100000,
      tdsRate: this.currentConfig.tdsPercentage,
      adminFeeRate: this.currentConfig.adminFeePercentage,
    };
  }

  /**
   * Update commission configuration. Requires administrative authorization.
   */
  public static updateConfig(
    updates: any,
    userRole?: string
  ): any {
    if (userRole && !['admin', 'super_admin'].includes(userRole.toLowerCase())) {
      const err: any = new Error('403 Forbidden: Only administrators can modify commission rules.');
      err.statusCode = 403;
      throw err;
    }

    const matchPct = updates.matchingPercentage !== undefined ? updates.matchingPercentage : updates.binaryMatchPercentage;
    if (matchPct !== undefined) {
      if (matchPct < 0 || matchPct > 100) {
        throw new Error('Matching percentage must be between 0 and 100.');
      }
      this.currentConfig.matchingPercentage = Number(matchPct);
    }

    const minPbv = updates.minimumPersonalBV !== undefined ? updates.minimumPersonalBV : updates.minPbvForQualification;
    if (minPbv !== undefined) {
      if (minPbv < 0) {
        throw new Error('Minimum personal BV cannot be negative.');
      }
      this.currentConfig.minimumPersonalBV = Number(minPbv);
    }

    if (updates.minimumLeftBV !== undefined) {
      this.currentConfig.minimumLeftBV = Math.max(0, Number(updates.minimumLeftBV));
    }

    if (updates.minimumRightBV !== undefined) {
      this.currentConfig.minimumRightBV = Math.max(0, Number(updates.minimumRightBV));
    }

    const cap = updates.maxDailyCommission !== undefined ? updates.maxDailyCommission : updates.cappingLimit;
    if (cap !== undefined) {
      this.currentConfig.maxDailyCommission = Number(cap);
    }

    if (updates.maxMonthlyCommission !== undefined) {
      this.currentConfig.maxMonthlyCommission = Number(updates.maxMonthlyCommission);
    }

    if (updates.carryForwardEnabled !== undefined) {
      this.currentConfig.carryForwardEnabled = Boolean(updates.carryForwardEnabled);
    }

    if (updates.carryForwardCap !== undefined) {
      this.currentConfig.carryForwardCap = updates.carryForwardCap ? Number(updates.carryForwardCap) : null;
    }

    const tds = updates.tdsPercentage !== undefined ? updates.tdsPercentage : updates.tdsRate;
    if (tds !== undefined) {
      this.currentConfig.tdsPercentage = Math.max(0, Number(tds));
    }

    const fee = updates.adminFeePercentage !== undefined ? updates.adminFeePercentage : updates.adminFeeRate;
    if (fee !== undefined) {
      this.currentConfig.adminFeePercentage = Math.max(0, Number(fee));
    }

    if (updates.bvToCurrencyMultiplier !== undefined) {
      this.currentConfig.bvToCurrencyMultiplier = Math.max(0.01, Number(updates.bvToCurrencyMultiplier));
    }

    if (updates.qualificationRequired !== undefined) {
      this.currentConfig.qualificationRequired = Boolean(updates.qualificationRequired);
    }

    if (updates.matchingRule !== undefined) {
      this.currentConfig.matchingRule = updates.matchingRule;
    }

    return this.getConfig();
  }

  /**
   * Reset to default configuration.
   */
  public static resetConfig(): CommissionRuleConfig {
    this.currentConfig = {
      matchingPercentage: config.binaryMatchPercentage || 10,
      minimumPersonalBV: config.minimumQualifyingBv || 100,
      minimumLeftBV: 0,
      minimumRightBV: 0,
      maxDailyCommission: null,
      maxMonthlyCommission: null,
      carryForwardEnabled: true,
      carryForwardCap: null,
      tdsPercentage: config.tdsDeductionPercentage || 5,
      adminFeePercentage: config.adminFeePercentage || 5,
      bvToCurrencyMultiplier: 1.0,
      qualificationRequired: true,
      matchingRule: 'MIN_LEG',
    };
    return { ...this.currentConfig };
  }
}
