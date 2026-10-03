import { Prisma } from '@prisma/client';
import { UplineNode } from '../services/sponsorUpline.service';

/**
 * ============================================================================
 * COMMISSION CALCULATION ENGINE TYPES (PROMPT 16)
 * ============================================================================
 */

export interface CanonicalCommissionTier {
  level: number;
  percentage: number;
}

export const CANONICAL_COMMISSION_TIERS: readonly CanonicalCommissionTier[] = Object.freeze([
  { level: 1, percentage: 24.0 },
  { level: 2, percentage: 8.0 },
  { level: 3, percentage: 13.0 },
  { level: 4, percentage: 5.0 },
  { level: 5, percentage: 4.0 },
]);

export const TOTAL_THEORETICAL_COMMISSION_PERCENTAGE = 54.0;

/**
 * Detailed breakdown item for a single qualified commission recipient.
 * Strictly adheres to Prompt 16 specification:
 * {
 *   level: 1,
 *   recipientId,
 *   businessVolume,
 *   percentage,
 *   commissionAmount
 * }
 */
export interface CommissionBreakdownItem {
  level: number;
  recipientId: string;
  businessVolume: number;
  percentage: number;
  commissionAmount: number;

  // Supplementary audit metadata (preserves array cleanliness while aiding UI/debugging)
  recipientCode?: string;
  recipientName?: string;
  status?: string;
  isEligible?: boolean;
}

export interface SkippedCommissionLevel {
  level: number;
  percentage: number;
  reason:
    | 'NO_UPLINE_EXISTS'
    | 'UPLINE_INACTIVE'
    | 'UPLINE_DELETED'
    | 'ELIGIBILITY_NOT_CONFIRMED'
    | 'RANK_NOT_QUALIFIED'
    | 'ZERO_BV'
    | 'ORDER_NOT_QUALIFIED'
    | 'ORDER_CANCELLED';
  uplineNode?: UplineNode;
}

/**
 * Options to customize eligibility confirmation, rates, and calculation behaviors.
 */
export interface CommissionCalculationOptions {
  /**
   * Custom rank or business rule eligibility validator.
   * "Do not automatically assume every upline is eligible until the rank/eligibility rule has been confirmed."
   */
  confirmEligibility?: (
    upline: UplineNode,
    level: number,
    businessVolume: number
  ) => boolean | Promise<boolean>;

  /**
   * Whether to require upline status === 'ACTIVE'. Default: true.
   */
  requireActive?: boolean;

  /**
   * Custom commission rates to override the default canonical tiers (24%, 8%, 13%, 5%, 4%).
   */
  customRates?: Array<{ level: number; percentage: number }>;

  /**
   * Whether to allow calculation preview for non-paid orders. Default: false.
   */
  allowPreview?: boolean;
}

/**
 * Breakdown return type: An Array of CommissionBreakdownItem carrying
 * non-enumerable / attached summary properties for full developer convenience.
 */
export type CommissionBreakdown = CommissionBreakdownItem[] & {
  orderId?: string;
  orderNumber?: string;
  memberId?: string;
  businessVolume: number;
  totalCommissionAmount: number;
  totalDistributedPercentage: number;
  totalTheoreticalAmount: number;
  totalTheoreticalPercentage: number;
  commissions: CommissionBreakdownItem[];
  skippedLevels: SkippedCommissionLevel[];
};

export interface TheoreticalCommissionResult {
  businessVolume: number;
  totalTheoreticalPercentage: number;
  totalTheoreticalAmount: number;
  tiers: Array<{
    level: number;
    percentage: number;
    commissionAmount: number;
    formula: string;
  }>;
}
