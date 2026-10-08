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
