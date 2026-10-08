import { PlatformTransactionStatus, PlatformTransactionType, Prisma } from '@prisma/client';

/**
 * Platform Treasury Wallet & Ledger Types (Prompt 30)
 *
 * Distinct from member, commission, or withdrawal wallets.
 * Represents the company's authoritative available funds and liquidity inside the platform.
 */

export interface PlatformWalletDTO {
  id: string;
  walletCode: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformWalletTransactionDTO {
  id: string;
  walletId: string;
  transactionNumber: string;
  type: PlatformTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string | null;
  externalTransactionId: string | null;
  providerTransactionId: string | null;
  idempotencyKey: string | null;
  status: PlatformTransactionStatus;
  description: string;
  metadata: Record<string, any> | null;
  performedById: string | null;
  createdAt: Date;
}

export interface CreditTreasuryInput {
  amount: number | string | Prisma.Decimal;
  type?: PlatformTransactionType;
  referenceType: string;
  referenceId?: string;
  externalTransactionId?: string;
  providerTransactionId?: string;
  idempotencyKey?: string;
  description: string;
  metadata?: Record<string, any>;
  performedById?: string;
  walletCode?: string;
}

export interface DebitTreasuryInput {
  amount: number | string | Prisma.Decimal;
  type?: PlatformTransactionType;
  referenceType: string;
  referenceId?: string;
  externalTransactionId?: string;
  providerTransactionId?: string;
  idempotencyKey?: string;
  description: string;
  metadata?: Record<string, any>;
  performedById?: string;
  walletCode?: string;
  allowOverdraft?: boolean;
}

export interface GetTreasuryTransactionsQuery {
  walletCode?: string;
  type?: PlatformTransactionType;
  status?: PlatformTransactionStatus;
  referenceType?: string;
  externalTransactionId?: string;
  providerTransactionId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  page?: number;
  limit?: number;
}

export interface TreasuryDiscrepancy {
  type:
    | 'BALANCE_MISMATCH'
    | 'DUPLICATE_PROVIDER_TRANSACTION'
    | 'NEGATIVE_BALANCE_VIOLATION'
    | 'ORPHANED_TRANSACTION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  transactionId?: string;
  transactionNumber?: string;
  expectedBalance?: number;
  actualBalance?: number;
  discrepancyAmount?: number;
  details: string;
}

export interface TreasuryReconciliationReport {
  walletId: string;
  walletCode: string;
  currency: string;
  currentBalance: number;
  calculatedLedgerBalance: number;
  discrepancy: number;
  isBalanced: boolean;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  discrepancies: TreasuryDiscrepancy[];
  reconciledAt: Date;
}
