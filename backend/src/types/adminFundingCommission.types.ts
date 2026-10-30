/**
 * Types and Interfaces for Admin-Only Funding Portal and One-Click Commission Distribution
 */

export interface DailyFinancialSummary {
  dateRange: {
    startDate?: string;
    endDate?: string;
    label: string;
  };
  totalEmployees: number;
  totalQualifyingBV: number;
  totalPaymentVolume: number;
  totalCalculatedCommissions: number;
  totalPendingCommissions: number;
  totalApprovedCommissions: number;
  totalPaidCommissions: number;
  totalFailedPayouts: number;
  totalReversedCommissions: number;
  financialDistinction: {
    orderPaymentVolume: number;
    businessVolumeBV: number;
    commissionLiability: number;
    walletCreditsDisbursed: number;
    bankPayoutsSettled: number;
  };
}

export interface EmployeeDailyCommissionRecord {
  id: string;
  distributorId?: string;
  distributorCode?: string;
  distributorName?: string;
  employeeId: string;
  employeeName: string;
  sponsorId: string;
  currentRank: string;
  transactionDate: string;
  orderReference: string;
  paymentStatus: string;
  purchaseAmount: number;
  qualifyingBV: number;
  leftMatchingVolume: number;
  rightMatchingVolume: number;
  commissionTier: string;
  commissionPercentage: number;
  eligibleCommissionBase: number;
  commissionAmount: number;
  previousPaidCommission: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  failedOrReversedCommission: number;
  payoutBatchId: string | null;
  payoutReference: string | null;
  lastUpdated: string;
}

export interface CommissionReportFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
  sponsorId?: string;
  rank?: string;
  tier?: string;
  paymentStatus?: string;
  commissionStatus?: string;
  payoutBatchId?: string;
  payoutStatus?: 'SUCCESS' | 'PENDING' | 'FAILED' | 'ALL';
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CommissionReportResponse {
  records: EmployeeDailyCommissionRecord[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summaryTotals: {
    totalPurchaseAmount: number;
    totalQualifyingBV: number;
    totalCalculatedAmount: number;
    totalPendingAmount: number;
    totalApprovedAmount: number;
    totalPaidAmount: number;
    totalReversedAmount: number;
  };
}

export interface DistributionPreview {
  calculationPeriod: string;
  eligibleEmployeeCount: number;
  totalCommissionAmount: number;
  pendingCommissionsAmount: number;
  previouslyPaidAmount: number;
  excludedCommissionsAmount: number;
  eligibleEmployees: Array<{
    distributorId: string;
    distributorCode: string;
    name: string;
    rank: string;
    approvedAmount: number;
    commissionCount: number;
    paymentStatus: string;
    hasActiveWallet: boolean;
  }>;
}

export interface BatchItemExecutionResult {
  id?: string;
  distributorId: string;
  distributorCode: string;
  name: string;
  amount: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  walletTransactionId?: string;
  payoutReference?: string;
  failureReason?: string;
}

export interface DistributionBatchResult {
  batchId: string;
  batchNumber: string;
  periodId: string;
  initiatedByAdminId: string;
  totalEmployees: number;
  successfulCount: number;
  failedCount: number;
  pendingCount: number;
  totalAmount: number;
  successfulAmount: number;
  failedAmount: number;
  status: 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';
  payoutMethod: string;
  items: BatchItemExecutionResult[];
  createdAt: string;
  completedAt?: string;
}
