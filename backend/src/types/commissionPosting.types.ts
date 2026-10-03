/**
 * Atomic Commission Posting Types (Prompt 19)
 *
 * Types for the transaction-safe, atomic, idempotent commission posting engine.
 */

import { Prisma } from '@prisma/client';
import { CommissionTransactionRecord } from './commissionLedger.types';

export type CommissionPostingStatus =
  | 'POSTED'
  | 'ALREADY_POSTED'
  | 'NO_ELIGIBLE_COMMISSIONS'
  | 'SKIPPED_ZERO_BV'
  | 'FAILED';

export interface CommissionPostingRecipient {
  recipientId: string;
  recipientCode?: string;
  recipientName?: string;
  level: number;
  percentage: number;
  commissionAmount: number;
  commissionTransactionId: string;
  walletTransactionId: string;
  walletTransactionNumber: string;
  walletId: string;
  balanceBefore: number;
  balanceAfter: number;
}

export interface SkippedPostingRecipient {
  level: number;
  recipientId?: string;
  recipientCode?: string;
  recipientName?: string;
  percentage: number;
  reason: string;
}

export interface CommissionPostingResult {
  orderId: string;
  orderNumber?: string;
  purchaserMemberId: string;
  businessVolume: number;
  commissionsCreated: number;
  recipients: CommissionPostingRecipient[];
  skippedRecipients: SkippedPostingRecipient[];
  totalCommission: number;
  status: CommissionPostingStatus;
  message?: string;
  timestamp: Date;
  idempotencyKey?: string;
  commissions?: CommissionTransactionRecord[];
}

export interface AtomicCommissionPostingOptions {
  /**
   * Whether to allow orders not yet marked paid (e.g. for testing / pre-settlement preview). Default false.
   */
  allowUnpaid?: boolean;

  /**
   * Custom commission rates if overriding default canonical tiers.
   */
  customRates?: Array<{ level: number; percentage: number }>;

  /**
   * Optional custom idempotency key prefix.
   */
  idempotencyPrefix?: string;

  /**
   * External transaction client if participating in an outer transaction.
   */
  tx?: Prisma.TransactionClient;
}
