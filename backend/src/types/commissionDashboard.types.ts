/**
 * ============================================================================
 * COMMISSION DASHBOARD TYPES (PROMPT 24)
 * ============================================================================
 * Type definitions for the high-performance database-aggregated Commission
 * Dashboard service.
 */

export interface CommissionLevelDashboardStat {
  level: number;
  percentage: number;
  totalBVProcessed: number;
  totalBV: number; // Convenient alias
  totalCommission: number;
  numberOfTransactions: number;
  transactionCount: number; // Convenient alias
}

export interface RecentCommissionTransactionItem {
  id: string;
  orderId: string;
  orderNumber?: string;
  orderAmount?: number;
  orderStatus?: string;
  commissionLevel: number;
  businessVolume: number;
  percentage: number;
  grossCommissionAmount: number;
  status: string;
  source: string;
  recipientMemberId: string;
  sourceMemberId: string;
  sourceMemberCode?: string;
  sourceMemberName?: string;
  walletTransactionId?: string | null;
  walletTransactionNumber?: string | null;
  createdAt: Date;
  paidAt?: Date | null;
  approvedAt?: Date | null;
  availableAt?: Date | null;
  reversedAt?: Date | null;
  reversalReason?: string | null;
}

export interface CommissionDashboardPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface MemberCommissionDashboardData {
  member: {
    id: string;
    distributorCode: string;
    distributorId?: string | null;
    firstName: string;
    lastName: string;
    displayName?: string | null;
  };
  // Top-level Summary Metrics (Prompt 24)
  totalCommission: number;
  pendingCommission: number;
  availableCommission: number;
  paidCommission: number;
  reversedCommission: number;

  // Commission by level breakdown (Levels 1 to 5)
  commissionByLevel: {
    '1': CommissionLevelDashboardStat;
    '2': CommissionLevelDashboardStat;
    '3': CommissionLevelDashboardStat;
    '4': CommissionLevelDashboardStat;
    '5': CommissionLevelDashboardStat;
    [key: string]: any;
  };
  levels: CommissionLevelDashboardStat[];

  // Paginated recent transactions
  recentTransactions: RecentCommissionTransactionItem[];
  pagination: CommissionDashboardPagination;

  meta: {
    generatedAt: Date;
    calculationMethod: 'DATABASE_AGGREGATION';
    aggregationExecutionTimeMs?: number;
  };
}

export interface CommissionDashboardQueryOptions {
  page?: number;
  limit?: number;
  status?: string;
  level?: number;
  fromDate?: string | Date;
  toDate?: string | Date;
}
