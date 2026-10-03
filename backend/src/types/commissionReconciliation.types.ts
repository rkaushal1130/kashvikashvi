/**
 * ============================================================================
 * COMMISSION RECONCILIATION TYPES (PROMPT 27)
 * ============================================================================
 * Type definitions for the commission reconciliation system.
 */

export type CommissionDiscrepancyType =
  | 'MISSING_COMMISSION'
  | 'DUPLICATE_COMMISSION'
  | 'INCORRECT_COMMISSION_AMOUNT'
  | 'INCORRECT_RECIPIENT'
  | 'INCORRECT_COMMISSION_LEVEL'
  | 'WALLET_MISMATCH'
  | 'REVERSAL_MISMATCH';

export type DiscrepancySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CommissionDiscrepancy {
  id: string;
  type: CommissionDiscrepancyType;
  severity: DiscrepancySeverity;
  orderId?: string;
  orderNumber?: string;
  commissionId?: string;
  memberId?: string;
  distributorCode?: string;
  level?: number;
  expectedValue?: any;
  actualValue?: any;
  discrepancyAmount?: number;
  description: string;
  details?: Record<string, any>;
  autoCorrectable?: boolean;
  correctionApplied?: boolean;
}

export interface OrderReconciliationResult {
  orderId: string;
  orderNumber?: string;
  orderStatus: string;
  orderBV: number;
  expectedCommissionsCount: number;
  actualCommissionsCount: number;
  expectedTotalCommission: number;
  actualTotalCommission: number;
  hasDiscrepancies: boolean;
  discrepancyCount: number;
  discrepancies: CommissionDiscrepancy[];
  autoCorrected: boolean;
  reconciledAt: Date;
  durationMs: number;
}

export interface MemberReconciliationSummary {
  memberId: string;
  distributorCode?: string;
  totalOrdersAnalyzed: number;
  totalCommissionsAnalyzed: number;
  walletBalance: number;
  walletLedgerSum: number;
  hasDiscrepancies: boolean;
  discrepancyCount: number;
  discrepancies: CommissionDiscrepancy[];
  reconciledAt: Date;
  durationMs: number;
}

export interface PeriodReconciliationSummary {
  startDate: Date;
  endDate: Date;
  ordersAnalyzed: number;
  commissionsAnalyzed: number;
  reversalsAnalyzed: number;
  totalDiscrepancies: number;
  discrepanciesByType: Record<CommissionDiscrepancyType, number>;
  ordersWithDiscrepancies: string[];
  discrepancies: CommissionDiscrepancy[];
  reconciledAt: Date;
  durationMs: number;
}

export interface ReconciliationOptions {
  autoCorrect?: boolean;
  actor?: string;
  ipAddress?: string;
  userAgent?: string;
}
