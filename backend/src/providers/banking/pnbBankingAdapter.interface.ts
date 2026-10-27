/**
 * ============================================================================
 * PUNJAB NATIONAL BANK (PNB) BANKING ADAPTER INTERFACE
 * ============================================================================
 * Provider-independent abstraction for Punjab National Bank corporate disbursements.
 *
 * Supports multiple rails:
 * 1. PNB Corporate Internet Banking (CIB) Bulk Upload (CSV/TXT with SHA-256)
 * 2. Direct PNB Corporate Open Banking REST API (When activated by bank)
 * 3. Mock Sandbox Adapter for isolated testing
 *
 * CRITICAL ZERO-CREDENTIAL SECURITY INVARIANTS:
 * - NEVER accept, store, or log net banking passwords, OTPs, or PINs.
 * - All payloads strictly use masked account displays on client endpoints.
 */

export type PnbRailType = 'PNB_PORTAL_BULK' | 'PNB_DIRECT_API' | 'MOCK_SANDBOX';

export interface PnbBeneficiaryItem {
  itemId: string;
  distributorId: string;
  distributorCode: string;
  distributorName: string;
  accountHolderName: string;
  accountNumber: string; // Unmasked only in memory during payload generation
  ifscCode: string;
  bankName: string;
  amount: number;
  paymentMode?: 'NEFT' | 'RTGS' | 'IMPS';
  customerReference: string; // e.g. "KV-PB26-ITEM-001"
  narration?: string;
}

export interface BankBatchFileResult {
  fileName: string;
  fileContent: string; // CSV or formatted text
  checksumSha256: string;
  totalRecords: number;
  totalAmount: number;
  fileType: 'PNB_BULK_UPLOAD_CSV' | 'PNB_BULK_UPLOAD_TXT';
  generatedAt: Date;
}

export interface DisbursalResult {
  batchId: string;
  batchNumber: string;
  channel: PnbRailType;
  status: 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';
  submittedCount: number;
  quarantinedCount: number;
  fileResult?: BankBatchFileResult;
  directApiTrackingId?: string;
  notes?: string;
}

export interface TransferStatusResult {
  referenceId: string;
  status: 'SETTLED' | 'SUBMITTED' | 'FAILED' | 'QUARANTINED';
  utrNumber?: string;
  settledAt?: Date;
  bankFailureCode?: string;
  bankFailureMessage?: string;
}

export interface MisParsedRow {
  customerReference: string;
  beneficiaryAccount: string;
  amount: number;
  status: 'SUCCESS' | 'REJECTED' | 'RETURNED';
  utrNumber?: string;
  reasonCode?: string;
  reasonMessage?: string;
  processedDate?: string;
}

export interface ReconciliationMisResult {
  totalRecordsProcessed: number;
  matchedCount: number;
  settledCount: number;
  settledAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  settledItems: {
    itemId: string;
    customerReference: string;
    utrNumber: string;
    amount: number;
  }[];
  quarantinedItems: {
    itemId: string;
    customerReference: string;
    amount: number;
    reason: string;
  }[];
  unmatchedRecords: MisParsedRow[];
}

export interface IPnbBankingAdapter {
  readonly railType: PnbRailType;
  readonly corporateAccountNumber: string;
  readonly corporateIfsc: string;

  /**
   * Generates a validated PNB corporate bulk disbursement file (CSV/TXT) with SHA-256 hash.
   */
  generateBulkBatchFile(
    batchNumber: string,
    beneficiaries: PnbBeneficiaryItem[]
  ): Promise<BankBatchFileResult>;

  /**
   * Initiates payment execution through the adapter's active rail.
   */
  initiateDisbursal(
    batchNumber: string,
    beneficiaries: PnbBeneficiaryItem[]
  ): Promise<DisbursalResult>;

  /**
   * Queries status of an individual item or batch reference.
   */
  queryTransferStatus(referenceId: string): Promise<TransferStatusResult>;

  /**
   * Ingests and parses a PNB reverse MIS statement (CSV / TXT) to extract UTRs and reconcile records.
   */
  parseReconciliationMisFile(
    fileBuffer: Buffer | string,
    batchItems: { id: string; payoutReference: string; amount: number }[]
  ): Promise<ReconciliationMisResult>;

  /**
   * Verifies inbound bank webhook cryptographic signature (if direct API is used).
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
}
