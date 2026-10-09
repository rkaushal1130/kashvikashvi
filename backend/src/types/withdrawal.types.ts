import { Prisma, WithdrawalStatus } from '@prisma/client';

/**
 * ============================================================================
 * MEMBER WITHDRAWAL SYSTEM TYPES (PROMPT 38)
 * ============================================================================
 *
 * Enforces:
 * 1. Member identity
 * 2. Available commission balance
 * 3. Withdrawal rules
 * 4. Minimum withdrawal amount
 * 5. Maximum withdrawal amount
 * 6. Account verification
 * 7. Sufficient company payout liquidity
 * 8. Duplicate withdrawal prevention
 *
 * Statuses:
 * REQUESTED, UNDER_REVIEW, APPROVED, PROCESSING, PAID, FAILED, CANCELLED, REVERSED
 */

export { WithdrawalStatus };

export interface WithdrawalRequestDTO {
  id: string;
  memberId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalStatus;
  payoutProvider: string;
  externalTransactionId: string | null;
  createdAt: Date;
  processedAt: Date | null;
  bankAccountId: string | null;
  payoutRequestId: string | null;
  walletTransactionId: string | null;
  platformTransactionId: string | null;
  failureReason: string | null;
  adminNotes: string | null;
  metadata: Record<string, any> | null;
  idempotencyKey: string | null;
}

export interface CreateWithdrawalInput {
  amount: number | string | Prisma.Decimal;
  bankAccountId: string;
  payoutProvider?: string;
  idempotencyKey?: string;
  notes?: string;
}

export interface WithdrawalValidationResult {
  isValid: boolean;
  memberId: string;
  walletId: string;
  requestedAmount: number;
  availableCommissionBalance: number;
  pendingCommissionBalance: number;
  reversedCommissionBalance: number;
  cancelledCommissionBalance: number;
  companyPayoutLiquidity: number;
  minAmount: number;
  maxAmount: number;
  violations: string[];
  warnings: string[];
}

export interface WithdrawalQueryInput {
  status?: WithdrawalStatus;
  memberId?: string;
  payoutProvider?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  page?: number;
  limit?: number;
}

export interface ProcessWithdrawalActionInput {
  action: 'APPROVE' | 'DISPATCH_PROCESSING' | 'MARK_PAID' | 'FAIL' | 'CANCEL' | 'REVERSE';
  adminUserId: string;
  payoutProvider?: string;
  externalTransactionId?: string;
  referenceNumber?: string;
  reason?: string;
  adminNotes?: string;
}
