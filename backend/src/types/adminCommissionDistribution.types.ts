export type PayoutApprovalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type PayoutBatchStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export type PayoutItemTransferStatus =
  | 'PENDING_APPROVAL'
  | 'READY_FOR_DISBURSAL'
  | 'SUBMITTED'
  | 'SETTLED'
  | 'FAILED'
  | 'QUARANTINED';

export interface CommissionDistributionSummary {
  eligibleCommissionsTotal: number;
  readyForPnbDisbursalTotal: number;
  quarantinedTotal: number;
  totalBeneficiariesCount: number;
  verifiedBankCount: number;
  unverifiedBankCount: number;
  corporatePnbBalance: number;
  corporateAccountNumber: string;
  corporateIfsc: string;
  activeCycleCode: string;
}

export interface EligibleBeneficiaryPreviewItem {
  distributorId: string;
  distributorCode: string;
  name: string;
  rankCode: string;
  rankName: string;
  rankPercentage: number;
  qualifyingBV: number;
  matchingVolume: number;
  approvedCommissionAmount: number;
  commissionCount: number;
  bankAccount: {
    id?: string;
    bankName: string;
    accountHolderName: string;
    maskedAccountNumber: string;
    ifscCode: string;
    status: string; // "VERIFIED", "PENDING_VERIFICATION", "NO_ACCOUNT"
    isVerified: boolean;
  };
  eligibilityStatus: 'READY_FOR_PNB' | 'REQUIRES_BANK_VERIFICATION' | 'QUARANTINED';
}

export interface DistributionPreviewResponse {
  periodId: string;
  totalEligibleAmount: number;
  readyAmount: number;
  quarantinedAmount: number;
  totalCount: number;
  readyCount: number;
  quarantinedCount: number;
  beneficiaries: EligibleBeneficiaryPreviewItem[];
}

export interface CreateBatchInput {
  periodId?: string;
  payoutMode?: 'PNB_BANK_TRANSFER' | 'WALLET_CREDIT';
  excludeUnverifiedBanks?: boolean;
  notes?: string;
}

export interface ApproveBatchInput {
  checkerNotes?: string;
  confirmationToken?: string;
}

export interface RejectBatchInput {
  reason: string;
}

export interface BatchListFilters {
  status?: string;
  approvalStatus?: string;
  periodId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface RemediateItemInput {
  action: 'UPDATE_BANK_AND_RETRY' | 'EXCLUDE_FROM_BATCH' | 'DIVERT_TO_WALLET';
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  notes?: string;
}

export interface QuarantineItemResponse {
  itemId: string;
  batchId: string;
  batchNumber: string;
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  amount: number;
  quarantineReason: string;
  quarantinedAt: string;
  currentBankDetails: {
    bankName?: string;
    accountHolderName?: string;
    maskedAccountNumber?: string;
    ifscCode?: string;
  };
  retryCount: number;
}
