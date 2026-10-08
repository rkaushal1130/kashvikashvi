/**
 * ============================================================================
 * FUNDING PROVIDER ABSTRACTION INTERFACE (PROMPT 32)
 * ============================================================================
 *
 * Pluggable abstraction for connecting the company's bank/payment accounts
 * through regulated banking/payment rails (e.g. RazorpayX, Cashfree, Stripe).
 *
 * CRITICAL ZERO-CREDENTIAL SECURITY INVARIANTS:
 * - NEVER accept, store, or log bank passwords, PINs, OTPs, CVVs, or internet banking logins.
 * - Platform NEVER logs into online banking directly.
 * - All integrations utilize external provider secure tokens and OAuth/API keys.
 * - Secrets (API keys, webhook secrets) MUST be loaded from environment variables.
 */

export type ProviderAccountStatus =
  | 'ACTIVE'
  | 'PENDING_VERIFICATION'
  | 'SUSPENDED'
  | 'DISCONNECTED'
  | 'ERROR';

export type ProviderFundingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

export interface ConnectAccountInput {
  accountHolderName: string;
  maskedAccountNumber: string;
  bankName: string;
  ifscOrRoutingCode: string;
  accountType?: 'CURRENT' | 'ESCROW' | 'VIRTUAL_ACCOUNT' | string;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface ConnectedAccountResult {
  provider: string;
  providerAccountId: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  status: ProviderAccountStatus;
  currency: string;
  connectedAt: Date;
  metadata?: Record<string, any>;
}

export interface AccountStatusResult {
  providerAccountId: string;
  provider: string;
  status: ProviderAccountStatus;
  currency: string;
  currentBalance?: number;
  isVerified: boolean;
  lastSyncedAt: Date;
  metadata?: Record<string, any>;
}

export interface CreateFundingRequestInput {
  providerAccountId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  description: string;
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface FundingRequestResult {
  providerTransactionId: string;
  status: ProviderFundingStatus;
  amount: number;
  currency: string;
  paymentLinkUrl?: string;
  virtualAccountDetails?: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    beneficiaryName: string;
  };
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface FundingStatusResult {
  providerTransactionId: string;
  status: ProviderFundingStatus;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  currency: string;
  utrNumber?: string;
  paidAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface VerifyTransactionInput {
  providerTransactionId: string;
  expectedAmount: number;
  currency?: string;
  utrNumber?: string;
}

export interface VerifyTransactionResult {
  verified: boolean;
  providerTransactionId: string;
  status: ProviderFundingStatus;
  amount: number;
  currency: string;
  utrNumber?: string;
  settledAt?: Date;
  rawProviderStatus: string;
  discrepancyReason?: string;
}

export interface WebhookProcessResult {
  isValid: boolean;
  eventType: string;
  providerTransactionId?: string;
  providerAccountId?: string;
  amount?: number;
  currency?: string;
  status?: ProviderFundingStatus;
  utrNumber?: string;
  rawEvent?: any;
  error?: string;
}

export interface ReconciliationResult {
  providerTransactionId: string;
  isMatched: boolean;
  providerStatus: ProviderFundingStatus;
  expectedAmount: number;
  actualAmount: number;
  discrepancy: number;
  utrNumber?: string;
  settledAt?: Date;
}

/**
 * Standard Contract for all Corporate Banking / Funding Providers
 */
export interface IFundingProvider {
  /** Name/identifier of the provider (e.g. "RAZORPAYX", "CASHFREE", "MOCK_SANDBOX") */
  readonly providerName: string;

  /**
   * Connect and verify corporate bank account details via provider's tokenized APIs.
   */
  connectAccount(input: ConnectAccountInput): Promise<ConnectedAccountResult>;

  /**
   * Disconnect an account link.
   */
  disconnectAccount(providerAccountId: string): Promise<{ success: boolean; disconnectedAt: Date }>;

  /**
   * Fetch current account status, verification state, and live balance from provider.
   */
  getAccountStatus(providerAccountId: string): Promise<AccountStatusResult>;

  /**
   * Initiate a funding order / virtual account load request.
   */
  createFundingRequest(input: CreateFundingRequestInput): Promise<FundingRequestResult>;

  /**
   * Query the latest status of an initiated funding transaction from the provider.
   */
  getFundingStatus(providerTransactionId: string): Promise<FundingStatusResult>;

  /**
   * Server-to-server authoritative verification of a specific transaction and amount.
   */
  verifyTransaction(input: VerifyTransactionInput): Promise<VerifyTransactionResult>;

  /**
   * Parse and cryptographically verify incoming provider webhook signature.
   */
  handleWebhook(
    payload: string | Buffer,
    signature: string,
    headers?: Record<string, string>
  ): Promise<WebhookProcessResult>;

  /**
   * Authoritatively reconcile transaction against provider's records.
   */
  reconcileTransaction(
    providerTransactionId: string,
    expectedAmount: number
  ): Promise<ReconciliationResult>;
}
