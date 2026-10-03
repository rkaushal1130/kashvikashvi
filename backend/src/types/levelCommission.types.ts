import { LevelCommissionStatus, Prisma } from '@prisma/client';

export interface CommissionLevelRate {
  level: number;
  ratePercentage: number; // 24, 8, 13, 5, 4
}

export const CANONICAL_LEVEL_RATES: readonly CommissionLevelRate[] = Object.freeze([
  { level: 1, ratePercentage: 24.0 },
  { level: 2, ratePercentage: 8.0 },
  { level: 3, ratePercentage: 13.0 },
  { level: 4, ratePercentage: 5.0 },
  { level: 5, ratePercentage: 4.0 },
]);

export const TOTAL_THEORETICAL_DISTRIBUTION_PERCENT = 54.0;

export interface UplineSponsorNode {
  level: number;
  distributorId: string;
  distributorCode: string;
  displayName: string;
  status: string; // ACTIVE, INACTIVE, SUSPENDED
  isDirect: boolean;
}

export interface CalculatedLevelItem {
  id?: string;
  level: number;
  beneficiaryId: string;
  beneficiaryCode: string;
  beneficiaryName: string;
  ratePercentage: number;
  commissionableBusinessVolume?: number;
  commissionAmount: number;
  status: LevelCommissionStatus;
  businessReference: string;
}

export interface SkippedLevelItem {
  level: number;
  ratePercentage: number;
  reason: 'NO_UPLINE_EXISTS' | 'UPLINE_INACTIVE' | 'ZERO_BV' | 'ORDER_NOT_QUALIFIED' | 'ORDER_CANCELLED';
}

export interface CalculateOrderLevelCommissionResult {
  orderId: string;
  orderNumber: string;
  orderBV: number;
  commissionableBusinessVolume?: number;
  totalDistributedPercentage: number;
  totalCommissionAmount: number;
  commissions: CalculatedLevelItem[];
  skippedLevels: SkippedLevelItem[];
}

export interface ReverseCommissionResult {
  orderId: string;
  orderNumber: string;
  reversedCount: number;
  totalReversedAmount: number;
  walletDeductions: Array<{
    distributorId: string;
    amount: number;
    walletTransactionId?: string;
  }>;
}

export interface LevelCommissionSummaryResult {
  distributorId: string;
  distributorCode: string;
  totalEarned: number;
  totalPending: number;
  levelBreakdown: Record<number, { count: number; totalAmount: number; ratePercentage: number }>;
  recentCommissions: Array<{
    id: string;
    commissionNumber: string;
    level: number;
    ratePercentage: number;
    orderBV: number;
    commissionAmount: number;
    status: LevelCommissionStatus;
    sourceMemberCode: string;
    sourceMemberName: string;
    orderNumber: string;
    createdAt: Date;
  }>;
}
