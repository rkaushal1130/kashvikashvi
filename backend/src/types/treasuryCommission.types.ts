import { Prisma } from '@prisma/client';
import { CommissionTransactionStatus } from './commissionLedger.types';

/**
 * ============================================================================
 * TREASURY & MLM COMMISSION SYSTEM INTEGRATION TYPES (PROMPT 37)
 * ============================================================================
 *
 * Core accounting concepts:
 * 1. PLATFORM TREASURY: The company's corporate funding source (PlatformWallet).
 * 2. COMMISSION PAYABLE: Platform liability owed to members for earned commissions.
 * 3. TREASURY RESERVE: Platform cash specifically segregated to back commission obligations.
 * 4. MEMBER WALLET: Member's personal account (Wallet).
 *
 * CRITICAL SEPARATION:
 * - EARNED COMMISSION: The legal entitlement earned by a member. Not deleted if treasury is low.
 * - AVAILABLE PAYOUT FUNDS: Funded & reserved liquidity in member wallet ready for payout.
 */

/**
 * The 6 canonical commission lifecycle statuses required by Prompt 37:
 */
export type CanonicalCommissionStatus =
  | 'EARNED'
  | 'APPROVED'
  | 'AVAILABLE'
  | 'PAYOUT_PENDING'
  | 'PAID'
  | 'REVERSED';

/**
 * Full accounting balance sheet summary connecting Treasury with Commission Payables.
 */
export interface TreasuryCommissionAccountingSummary {
  currency: string;
  timestamp: Date;
  isSolvent: boolean;
  healthStatus: 'HEALTHY' | 'MODERATE_RESERVE' | 'RESERVE_DEFICIT' | 'INSOLVENT';

  platformTreasury: {
    availableBalance: number;
    reservedBalance: number;
    pendingBalance: number;
    totalFloat: number;
  };

  commissionPayables: {
    unfundedEarnedLiability: number;    // EARNED status (liability, not yet reserved)
    approvedLiability: number;          // APPROVED status (liability awaiting reserve)
    fundedAvailableLiability: number;   // AVAILABLE status (liability backed by reserve)
    payoutPendingLiability: number;     // PAYOUT_PENDING status (in withdrawal queue)
    totalOutstandingPayable: number;    // Sum of all unpaid commission liabilities
    totalLifetimePaid: number;          // Cumulative historical paid commissions
    totalLifetimeReversed: number;      // Cumulative historical reversed commissions
  };

  memberWallets: {
    totalAvailableBalance: number;
    totalPendingWithdrawalBalance: number;
    totalLifetimeEarned: number;
    totalLifetimePaid: number;
  };

  coverageMetrics: {
    /**
     * Reserve Coverage Ratio = Treasury Reserve / Commission Payables
     * Target: >= 1.0 (100% of payables backed by earmarked reserves)
     */
    reserveCoverageRatio: number;

    /**
     * Total Solvency Ratio = Total Treasury Cash / Commission Payables
     * Target: >= 1.0 (Company has sufficient total cash to cover all payables)
     */
    totalSolvencyRatio: number;

    /**
     * Net Treasury Surplus/Deficit = Total Treasury Cash - Commission Payables
     */
    netSurplusDeficit: number;
  };
}

/**
 * Input for recording an earned commission.
 */
export interface RecordEarnedCommissionInput {
  orderId: string;
  orderNumber?: string;
  recipientMemberId: string;
  sourceMemberId: string;
  commissionLevel: number;
  businessVolume: number | Prisma.Decimal;
  percentage: number | Prisma.Decimal;
  grossCommissionAmount: number | Prisma.Decimal;
  idempotencyKey?: string;
  source?: string;
  calculationDetails?: Record<string, any>;
}

/**
 * Result of recording an earned commission.
 */
export interface RecordEarnedCommissionResult {
  commissionId: string;
  recipientMemberId: string;
  orderId: string;
  commissionLevel: number;
  grossCommissionAmount: number;
  status: CanonicalCommissionStatus;
  idempotencyKey: string;
  isLiabilityRecorded: boolean;
  earnedAt: Date;
  message: string;
}

/**
 * Options for funding/reserving commission from platform treasury.
 */
export interface FundCommissionOptions {
  performedById?: string;
  allowPartial?: boolean;
  walletCode?: string;
}

/**
 * Result of attempting to fund and reserve a commission from treasury.
 */
export interface FundCommissionResult {
  commissionId: string;
  recipientMemberId: string;
  grossAmount: number;
  previousStatus: CanonicalCommissionStatus | string;
  newStatus: CanonicalCommissionStatus | string;
  isFunded: boolean;
  platformTransactionId?: string;
  platformTransactionNumber?: string;
  memberWalletTransactionId?: string;
  memberWalletTransactionNumber?: string;
  treasuryReservedAmount: number;
  reason?: string;
  timestamp: Date;
}

/**
 * Result of batch commission funding.
 */
export interface BatchFundCommissionsResult {
  totalEvaluated: number;
  fundedCount: number;
  deferredCount: number;
  totalFundedAmount: number;
  totalDeferredAmount: number;
  remainingTreasuryAvailable: number;
  results: FundCommissionResult[];
  timestamp: Date;
}

/**
 * Payout eligibility check result.
 */
export interface PayoutEligibilityCheckResult {
  isEligible: boolean;
  payoutRequestId: string;
  distributorId: string;
  requestedAmount: number;
  memberAvailableBalance: number;
  memberPendingBalance: number;
  treasuryAvailableBalance: number;
  treasuryReservedBalance: number;
  canPlatformDisburse: boolean;
  blockers: string[];
  warnings: string[];
  checkedAt: Date;
}

/**
 * Input for payout execution via platform treasury.
 */
export interface ExecutePayoutInput {
  payoutId: string;
  adminUserId: string;
  referenceNumber?: string;
  adminNotes?: string;
  walletCode?: string;
}

/**
 * Result of payout execution.
 */
export interface ExecutePayoutResult {
  payoutId: string;
  payoutNumber: string;
  distributorId: string;
  disbursedAmount: number;
  netAmount: number;
  feeAmount: number;
  status: 'PAID';
  platformWalletTransactionId: string;
  platformTransactionNumber: string;
  memberWalletTransactionId: string;
  processedAt: Date;
  message: string;
}

/**
 * Result of commission reversal in treasury context.
 */
export interface TreasuryReverseCommissionResult {
  commissionId: string;
  orderId: string;
  recipientMemberId: string;
  reversedAmount: number;
  status: 'REVERSED';
  reserveReleased: boolean;
  reserveReleaseAmount: number;
  memberBalanceAdjusted: boolean;
  reason: string;
  timestamp: Date;
}
