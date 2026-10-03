/**
 * Commission Ledger Types
 * 
 * Strict immutable ledger types for commission transactions.
 * Traceable, auditable, idempotent.
 */

export type CommissionTransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'AVAILABLE'
  | 'PAID'
  | 'REVERSED'
  | 'CANCELLED';

export interface CommissionTransactionRecord {
  id: string;
  recipientMemberId: string;
  sourceMemberId: string;
  orderId: string;
  commissionLevel: number;
  businessVolume: number;
  percentage: number;
  grossCommissionAmount: number;
  status: CommissionTransactionStatus;
  source: string;
  idempotencyKey: string;
  walletTransactionId?: string | null;
  calculationDetails?: Record<string, any> | null;
  reversalReason?: string | null;
  approvedAt?: Date | null;
  availableAt?: Date | null;
  paidAt?: Date | null;
  reversedAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  recipient?: {
    id: string;
    distributorId?: string | null;
    distributorCode?: string;
    firstName?: string;
    lastName?: string;
    userId: string;
    user?: {
      email?: string;
    };
  };
  sourceMember?: {
    id: string;
    distributorId?: string | null;
    distributorCode?: string;
    firstName?: string;
    lastName?: string;
    userId: string;
    user?: {
      email?: string;
    };
  };
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: any;
    totalBV: any;
  };
}

export interface CommissionLedgerEntryInput {
  recipientMemberId: string;
  sourceMemberId: string;
  orderId: string;
  commissionLevel: number;
  businessVolume: number;
  percentage: number;
  grossCommissionAmount: number;
  source?: string;
  idempotencyKey?: string;
  calculationDetails?: Record<string, any>;
}

export interface BatchRecordCommissionInput {
  orderId: string;
  sourceMemberId: string;
  source?: string;
  breakdown: Array<{
    level: number;
    recipientId: string;
    businessVolume: number;
    percentage: number;
    commissionAmount: number;
    calculationDetails?: Record<string, any>;
  }>;
}

export interface BatchRecordCommissionResult {
  orderId: string;
  totalRecordsProcessed: number;
  createdCount: number;
  skippedCount: number;
  totalGrossCommission: number;
  transactions: CommissionTransactionRecord[];
  skippedKeys: string[];
}

export interface CommissionLedgerFilter {
  recipientMemberId?: string;
  sourceMemberId?: string;
  orderId?: string;
  status?: CommissionTransactionStatus;
  commissionLevel?: number;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface PaginatedCommissionLedgerResult {
  transactions: CommissionTransactionRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatusTransitionResult {
  id: string;
  previousStatus: CommissionTransactionStatus;
  newStatus: CommissionTransactionStatus;
  reason?: string;
  timestamp: Date;
}

export interface WalletCreditResult {
  commissionTransactionId: string;
  walletTransactionId: string;
  walletId: string;
  creditedAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: CommissionTransactionStatus;
}
