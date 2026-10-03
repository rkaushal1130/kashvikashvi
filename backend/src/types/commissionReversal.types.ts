import { Prisma } from '@prisma/client';

/**
 * Configured negative-balance / recovery policy for reversed commissions that were already withdrawn (Prompt 22):
 * - REQUIRE_ADMIN_RECONCILIATION: Debits available balance down to 0, flags any shortfall for admin reconciliation.
 *   Guarantees the system never silently loses money or creates unaccounted negative balances. (DEFAULT)
 * - ALLOW_NEGATIVE_BALANCE: Allows the wallet balance to dip below zero when explicitly configured.
 * - HOLD_FUTURE_COMMISSIONS: Automatically reserves the debt against future incoming commission payouts.
 */
export type CommissionRecoveryPolicy =
  | 'REQUIRE_ADMIN_RECONCILIATION'
  | 'ALLOW_NEGATIVE_BALANCE'
  | 'HOLD_FUTURE_COMMISSIONS';

export type CommissionReversalRecoveryStatus =
  | 'COMPLETED'
  | 'REVERSED_UNPAID'
  | 'PENDING_ADMIN_RECONCILIATION'
  | 'NEGATIVE_BALANCE_APPLIED';

export interface OrderCommissionReversalOptions {
  /**
   * Reference ID for the refund event (e.g., refund transaction or gateway ID).
   */
  refundId?: string;

  /**
   * Human-readable or operational reason for the reversal (cancellation, refund, chargeback, dispute).
   */
  reason?: string;

  /**
   * For partial refunds: The monetary amount being refunded on the order.
   */
  refundAmount?: number;

  /**
   * For partial refunds: The specific Business Volume (BV) being returned/reversed.
   */
  refundedBV?: number;

  /**
   * Explicit flag indicating a partial refund operation.
   */
  isPartialRefund?: boolean;

  /**
   * Override for recovery policy for this specific reversal.
   */
  recoveryPolicyOverride?: CommissionRecoveryPolicy;

  /**
   * External transaction client if participating in an outer transaction.
   */
  tx?: Prisma.TransactionClient;
}

export interface SingleCommissionReversalOptions {
  reason?: string;
  refundId?: string;
  recoveryPolicyOverride?: CommissionRecoveryPolicy;
  tx?: Prisma.TransactionClient;
}

export interface SingleCommissionReversalResult {
  reversalId: string;
  originalCommissionId: string;
  orderId: string;
  refundId?: string | null;
  recipientMemberId: string;
  commissionLevel: number;
  reversedBV: number;
  originalAmount: number;
  amount: number; // Compensatory negative amount (Prompt 22, e.g., -2400)
  reversalAmount: number; // Stored as negative or compensatory amount (e.g., -2400)
  recoveryStatus: CommissionReversalRecoveryStatus;
  unrecoveredAmount: number;
  walletTransactionId?: string | null;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  reason: string;
  timestamp: Date;
  isIdempotentSkip: boolean;
}

export interface OrderCommissionReversalSummary {
  orderId: string;
  orderNumber?: string;
  refundId?: string | null;
  reason: string;
  isPartial: boolean;
  totalReversalsCreated: number;
  totalReversedAmount: number;
  totalUnrecoveredAmount: number;
  reversals: SingleCommissionReversalResult[];
  status:
    | 'SUCCESS'
    | 'ALREADY_REVERSED'
    | 'PARTIAL_REVERSAL_COMPLETED'
    | 'PENDING_ADMIN_RECONCILIATION';
  timestamp: Date;
}

export interface AdminReconciliationResolutionInput {
  reversalId: string;
  resolutionType: 'RECOVERED_OFFLINE' | 'DEDUCTED_FROM_PAYOUT' | 'WRITTEN_OFF' | 'ADJUSTED_WALLET';
  notes: string;
  adminUserId: string;
}
