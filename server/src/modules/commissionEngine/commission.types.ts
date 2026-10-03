export type CommissionPeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface CommissionRuleConfig {
  matchingPercentage: number; // e.g. 10%
  minimumPersonalBV: number; // e.g. 100 BV
  minimumLeftBV: number; // e.g. 0 BV
  minimumRightBV: number; // e.g. 0 BV
  maxDailyCommission: number | null; // e.g. 50000.00
  maxMonthlyCommission: number | null;
  carryForwardEnabled: boolean; // true/false
  carryForwardCap: number | null;
  tdsPercentage: number; // e.g. 5%
  adminFeePercentage: number; // e.g. 5%
  bvToCurrencyMultiplier: number; // default 1.0 (1 BV = ₹1)
  qualificationRequired: boolean; // default true (status === ACTIVE)
  matchingRule: 'MIN_LEG' | 'WEAKER_LEG';
}

export interface CommissionEligibilityResult {
  distributorId: string;
  eligible: boolean;
  reasons: string[];
  personalBV: number;
  leftTeamBV: number;
  rightTeamBV: number;
  requirements: {
    minimumPersonalBV: number;
    minimumLeftBV: number;
    minimumRightBV: number;
    qualificationRequired: boolean;
    distributorStatus: string;
  };
}

export interface CommissionCalculationResult {
  distributorId: string;
  cycleId: string;
  periodType: CommissionPeriodType;
  eligible: boolean;
  reasons: string[];
  leftVolume: number;
  rightVolume: number;
  previousCarryForwardLeft: number;
  previousCarryForwardRight: number;
  totalEffectiveLeftVolume: number;
  totalEffectiveRightVolume: number;
  matchedVolume: number;
  commissionRate: number; // e.g. 10
  grossCommission: number;
  tdsDeduction: number;
  adminCharge: number;
  netPayout: number;
  carryForwardLeft: number;
  carryForwardRight: number;
  carryForwardEnabled: boolean;
  calculatedAt: string;
}

export interface CommissionLedgerEntry {
  id: string;
  distributorId: string;
  cycleId: string;
  periodType: CommissionPeriodType;
  commissionType: string;
  sourceTransactionId?: string;
  leftVolume: number;
  rightVolume: number;
  matchedVolume: number;
  commissionRate: number;
  grossCommission: number;
  tdsDeduction: number;
  adminCharge: number;
  netPayout: number;
  carryForwardLeft: number;
  carryForwardRight: number;
  status: 'CALCULATED' | 'POSTED' | 'SETTLED' | 'REVERSED' | 'PAID' | 'APPROVED' | 'PENDING';
  createdAt: string;
  notes?: string;
}

export interface PostCommissionResult {
  success: boolean;
  ledgerId: string;
  distributorId: string;
  cycleId: string;
  netPayout: number;
  walletBalance?: number;
  message: string;
}
