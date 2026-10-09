import { FundingAccountStatus, FundingTransactionStatus, Prisma } from '@prisma/client';

/**
 * Admin Funding Portal Models & Types (Prompt 31)
 *
 * Implements models for connecting regulated payment/banking providers,
 * tracking corporate funding accounts, and auditing corporate funding transactions.
 *
 * CRITICAL SECURITY INVARIANTS:
 * - Never store bank password, PIN, OTP, CVV, or raw banking credentials.
 * - Always use external provider's secure account/token identifiers.
 * - Sensitive metadata must be stripped prior to serialization for standard clients.
 */

export interface FundingAccountDTO {
  id: string;
  provider: string;
  providerAccountId: string;
  accountType: string;
  accountName: string;
  maskedAccountNumber: string;
  currency: string;
  status: FundingAccountStatus;
  isPrimary: boolean;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FundingTransactionDTO {
  id: string;
  fundingAccountId: string;
  initiatedByAdminId: string;
  amount: number;
  currency: string;
  status: FundingTransactionStatus;
  provider: string;
  providerTransactionId: string | null;
  idempotencyKey: string;
  platformWalletTransactionId: string | null;
  failureReason: string | null;
  metadata?: Record<string, any> | null;
  initiatedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fundingAccount?: FundingAccountDTO;
  initiatedByAdmin?: {
    id: string;
    email: string;
    fullName?: string | null;
  };
}

export interface CreateFundingAccountInput {
  provider: string;
  providerAccountId: string;
  accountType: string;
  accountName: string;
  maskedAccountNumber: string;
  currency?: string;
  isPrimary?: boolean;
  metadata?: Record<string, any>;
}

export interface CreateFundingTransactionInput {
  fundingAccountId: string;
  initiatedByAdminId: string;
  amount: number | string | Prisma.Decimal;
  currency?: string;
  provider: string;
  providerTransactionId?: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface InitiateFundingInput {
  fundingAccountId?: string;
  amount: number;
  currency?: string;
  description?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}


/**
 * Sanitizes metadata JSON by stripping any sensitive keys.
 * Enforces the invariant: Never store/expose PIN, password, OTP, CVV, or raw credentials.
 */
export function sanitizeFundingMetadata(data?: Record<string, any> | null): Record<string, any> | null {
  if (!data || typeof data !== 'object') return null;

  const sensitivePattern = /password|pin|otp|cvv|secret|credential|auth_token|bearer/i;
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitivePattern.test(key)) {
      continue; // Strip sensitive key
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeFundingMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * ============================================================================
 * BANK FUNDING RECONCILIATION TYPES (PROMPT 40)
 * ============================================================================
 *
 * Implements 3-way reconciliation types comparing:
 * External Provider <-> FundingTransaction <-> Platform Treasury Ledger
 */
export type FundingDiscrepancyType =
  | 'EXTERNAL_SUCCESS_INTERNAL_PENDING'
  | 'EXTERNAL_SUCCESS_NO_INTERNAL_TX'
  | 'INTERNAL_SUCCESS_EXTERNAL_FAILURE'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'DUPLICATE_PROVIDER_TRANSACTION'
  | 'REVERSAL_NOT_REFLECTED_INTERNALLY';

export interface FundingDiscrepancyDetail {
  type: FundingDiscrepancyType;
  description: string;
  externalData?: {
    status?: string;
    amount?: number;
    currency?: string;
    providerTransactionId?: string;
    utrNumber?: string;
  };
  internalData?: {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    providerTransactionId?: string;
  };
  ledgerData?: {
    hasCredit?: boolean;
    hasDebit?: boolean;
    creditAmount?: number;
    debitAmount?: number;
    ledgerTransactionNumber?: string;
  };
}

export interface ReconcileTransactionResult {
  transaction: FundingTransactionDTO;
  isMatched: boolean;
  status: FundingTransactionStatus;
  discrepancies: FundingDiscrepancyDetail[];
  providerStatus?: string;
  externalAmount?: number;
  internalAmount?: number;
  ledgerAmount?: number;
  ledgerMatched: boolean;
  message: string;
  reconciledAt: Date;
}

export interface ReconcileFundingPeriodResult {
  period: {
    startDate: Date;
    endDate: Date;
  };
  provider?: string;
  totalChecked: number;
  matchedCount: number;
  discrepancyCount: number;
  discrepancies: Array<{
    transactionId?: string;
    providerTransactionId?: string;
    discrepancy: FundingDiscrepancyDetail;
  }>;
  reconciledAt: Date;
}

export type FundingDiscrepancyResolutionAction =
  | 'FORCE_SETTLE_CREDIT'
  | 'REVERSE_DEBIT'
  | 'MARK_FAILED'
  | 'MARK_RESOLVED_NO_ACTION';

export interface ResolveFundingDiscrepancyInput {
  action: FundingDiscrepancyResolutionAction;
  reason: string;
  notes?: string;
  correctionAmount?: number;
}

export interface ResolveDiscrepancyResult {
  transaction: FundingTransactionDTO;
  actionTaken: FundingDiscrepancyResolutionAction;
  treasuryBalance?: number;
  ledgerTransactionNumber?: string;
  message: string;
  resolvedAt: Date;
}
