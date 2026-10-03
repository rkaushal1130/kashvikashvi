/**
 * Commission Wallet Integration Types (Prompt 20)
 *
 * Types for integrating commission transactions safely with wallets,
 * enforcing withdrawal guards, preventing duplicate credits, and
 * executing full reconciliation between the Commission Ledger and Wallet Ledger.
 */

import { CommissionTransactionStatus } from './commissionLedger.types';

export interface WalletCreditCommissionInput {
  commissionTransactionId: string;
}

export interface WalletCreditCommissionResult {
  commissionTransactionId: string;
  walletTransactionId: string;
  walletTransactionNumber: string;
  walletId: string;
  memberId: string;
  orderId: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  type: 'COMMISSION';
  status: string;
  createdAt: Date;
}

export interface WithdrawalEligibilityCheckResult {
  canWithdraw: boolean;
  memberId: string;
  walletId: string;
  requestedAmount: number;
  availableBalance: number;
  pendingBalance: number;
  pendingCommissionsTotal: number;
  pendingCommissionsCount: number;
  reversedCommissionsTotal: number;
  reversedCommissionsCount: number;
  reason?: string;
}

export type DiscrepancyType =
  | 'UNPOSTED_COMMISSION'          // Commission marked PAID but missing wallet transaction
  | 'ORPHANED_WALLET_TRANSACTION'  // Wallet transaction references non-existent commission
  | 'AMOUNT_MISMATCH'              // Commission amount != WalletTransaction amount
  | 'DUPLICATE_WALLET_CREDIT'      // Multiple wallet credits for same commission
  | 'RECIPIENT_MISMATCH'           // Wallet belongs to someone other than recipientMemberId
  | 'MISSING_REVERSAL_DEBIT'       // REVERSED commission without compensating debit
  | 'UNRECORDED_BALANCE_DRIFT';    // Wallet balance does not match sum of ledger entries

export interface ReconciliationDiscrepancy {
  type: DiscrepancyType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  commissionTransactionId?: string;
  walletTransactionId?: string;
  orderId?: string;
  memberId?: string;
  walletId?: string;
  expectedAmount?: number;
  actualAmount?: number;
  description: string;
  detectedAt: Date;
}

export interface CommissionWalletReconciliationReport {
  auditedMemberId?: string;
  auditedOrderId?: string;
  totalCommissionTransactions: number;
  totalPaidCommissions: number;
  totalPendingCommissions: number;
  totalReversedCommissions: number;
  totalWalletCommissionTransactions: number;
  totalPaidCommissionAmount: number;
  totalWalletCommissionAmount: number;
  isReconciled: boolean;
  discrepancyCount: number;
  criticalDiscrepancyCount: number;
  discrepancies: ReconciliationDiscrepancy[];
  auditedAt: Date;
}
