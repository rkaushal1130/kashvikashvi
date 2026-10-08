import crypto from 'crypto';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/appError';
import {
  AccountStatusResult,
  ConnectAccountInput,
  ConnectedAccountResult,
  CreateFundingRequestInput,
  FundingRequestResult,
  FundingStatusResult,
  IFundingProvider,
  ReconciliationResult,
  VerifyTransactionInput,
  VerifyTransactionResult,
  WebhookProcessResult,
} from './fundingProvider.interface';

/**
 * Mock Regulated Funding Provider (Sandbox & Testing Environment)
 *
 * Simulates a regulated payment provider (e.g. RazorpayX / Cashfree) with:
 * - Deterministic token generation
 * - HMAC-SHA256 signature verification
 * - In-memory sandbox state
 */
export class MockFundingProvider implements IFundingProvider {
  public readonly providerName = 'MOCK_SANDBOX';
  private accounts: Map<string, any> = new Map();
  private transactions: Map<string, any> = new Map();
  private webhookSecret: string;

  constructor(webhookSecret: string = 'mock_webhook_secret_key_32_chars_min') {
    this.webhookSecret = webhookSecret;
  }

  public setWebhookSecret(secret: string): void {
    this.webhookSecret = secret;
  }

  public async connectAccount(input: ConnectAccountInput): Promise<ConnectedAccountResult> {
    if (!input.accountHolderName?.trim()) {
      throw AppError.badRequest('accountHolderName is required');
    }
    if (!input.maskedAccountNumber?.trim()) {
      throw AppError.badRequest('maskedAccountNumber is required');
    }

    const providerAccountId = `acc_mock_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const record = {
      providerAccountId,
      provider: this.providerName,
      accountHolderName: input.accountHolderName,
      maskedAccountNumber: input.maskedAccountNumber,
      bankName: input.bankName,
      ifscOrRoutingCode: input.ifscOrRoutingCode,
      accountType: input.accountType || 'CURRENT',
      status: 'ACTIVE' as const,
      currency: input.currency || 'INR',
      balance: 1000000.0, // 10 Lakhs mock float
      connectedAt: new Date(),
    };

    this.accounts.set(providerAccountId, record);
    logger.info({ providerAccountId }, 'Mock funding provider connected account');

    return {
      provider: this.providerName,
      providerAccountId,
      accountHolderName: record.accountHolderName,
      maskedAccountNumber: record.maskedAccountNumber,
      status: 'ACTIVE',
      currency: record.currency,
      connectedAt: record.connectedAt,
    };
  }

  public async disconnectAccount(
    providerAccountId: string
  ): Promise<{ success: boolean; disconnectedAt: Date }> {
    const account = this.accounts.get(providerAccountId);
    if (!account) {
      throw AppError.notFound(`Account ${providerAccountId} not found in provider`);
    }
    account.status = 'DISCONNECTED';
    return { success: true, disconnectedAt: new Date() };
  }

  public async getAccountStatus(providerAccountId: string): Promise<AccountStatusResult> {
    const account = this.accounts.get(providerAccountId);
    if (!account) {
      // Sane fallback for test mocks
      return {
        providerAccountId,
        provider: this.providerName,
        status: 'ACTIVE',
        currency: 'INR',
        currentBalance: 500000.0,
        isVerified: true,
        lastSyncedAt: new Date(),
      };
    }

    return {
      providerAccountId,
      provider: this.providerName,
      status: account.status,
      currency: account.currency,
      currentBalance: account.balance,
      isVerified: account.status === 'ACTIVE',
      lastSyncedAt: new Date(),
    };
  }

  public async createFundingRequest(
    input: CreateFundingRequestInput
  ): Promise<FundingRequestResult> {
    if (input.amount <= 0) {
      throw AppError.badRequest('Funding amount must be greater than zero');
    }

    const providerTransactionId = `fund_mock_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const utrNumber = `UTR-MOCK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const txRecord = {
      providerTransactionId,
      providerAccountId: input.providerAccountId,
      amount: input.amount,
      currency: input.currency || 'INR',
      status: 'SUCCEEDED' as const, // In mock, immediately succeeds
      utrNumber,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date(),
    };

    this.transactions.set(providerTransactionId, txRecord);

    return {
      providerTransactionId,
      status: 'SUCCEEDED',
      amount: input.amount,
      currency: input.currency || 'INR',
      paymentLinkUrl: `https://sandbox.bank-provider.com/checkout/${providerTransactionId}`,
      virtualAccountDetails: {
        bankName: 'HDFC Corporate Smart Collect',
        accountNumber: 'KASHVIMLM98811',
        ifsc: 'HDFC0000060',
        beneficiaryName: 'Kashvi Marketing Pvt Ltd - Float Pool',
      },
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  public async getFundingStatus(providerTransactionId: string): Promise<FundingStatusResult> {
    const tx = this.transactions.get(providerTransactionId);
    if (!tx) {
      return {
        providerTransactionId,
        status: 'SUCCEEDED',
        amount: 100000,
        currency: 'INR',
        utrNumber: `UTR-MOCK-${providerTransactionId.slice(-6)}`,
        paidAt: new Date(),
      };
    }

    return {
      providerTransactionId: tx.providerTransactionId,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      utrNumber: tx.utrNumber,
      paidAt: tx.createdAt,
    };
  }

  public async verifyTransaction(
    input: VerifyTransactionInput
  ): Promise<VerifyTransactionResult> {
    const tx = this.transactions.get(input.providerTransactionId);

    // If recorded in sandbox, verify against stored amount
    if (tx) {
      const isAmountValid = Math.abs(tx.amount - input.expectedAmount) < 0.01;
      return {
        verified: isAmountValid && tx.status === 'SUCCEEDED',
        providerTransactionId: tx.providerTransactionId,
        status: isAmountValid ? tx.status : 'FAILED',
        amount: tx.amount,
        currency: tx.currency,
        utrNumber: tx.utrNumber,
        settledAt: tx.createdAt,
        rawProviderStatus: tx.status,
        discrepancyReason: isAmountValid ? undefined : `Amount mismatch. Expected: ${input.expectedAmount}, Got: ${tx.amount}`,
      };
    }

    // Fallback: verify input has valid positive expectedAmount
    const verified = input.expectedAmount > 0;
    return {
      verified,
      providerTransactionId: input.providerTransactionId,
      status: verified ? 'SUCCEEDED' : 'FAILED',
      amount: input.expectedAmount,
      currency: input.currency || 'INR',
      utrNumber: input.utrNumber || `UTR-MOCK-VERIFIED`,
      settledAt: new Date(),
      rawProviderStatus: verified ? 'CAPTURED' : 'FAILED',
    };
  }

  public async handleWebhook(
    payload: string | Buffer,
    signature: string,
    _headers?: Record<string, string>
  ): Promise<WebhookProcessResult> {
    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf-8');

    // Compute expected HMAC-SHA256 signature
    const computedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadString)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    let isValid = false;
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const compBuf = Buffer.from(computedSignature, 'hex');
      isValid = sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf);
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return {
        isValid: false,
        eventType: 'UNKNOWN',
        error: 'Invalid webhook signature',
      };
    }

    try {
      const parsed = JSON.parse(payloadString);
      const paymentEntity =
        parsed.payload?.payment?.entity ||
        parsed.data?.payment ||
        parsed.data?.entity ||
        parsed.data ||
        parsed;
      const eventType = parsed.event || 'funding.settled';

      let status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'REVERSED' = 'SUCCEEDED';
      if (
        eventType.includes('failed') ||
        paymentEntity?.status === 'failed' ||
        parsed.status === 'FAILED'
      ) {
        status = 'FAILED';
      } else if (
        eventType.includes('reversed') ||
        eventType.includes('refund') ||
        paymentEntity?.status === 'reversed'
      ) {
        status = 'REVERSED';
      } else if (
        eventType.includes('pending') ||
        eventType.includes('processing') ||
        paymentEntity?.status === 'pending'
      ) {
        status = 'PENDING';
      }

      return {
        isValid: true,
        eventType,
        providerTransactionId:
          paymentEntity?.id ||
          parsed.data?.id ||
          parsed.id ||
          paymentEntity?.providerTransactionId,
        amount: paymentEntity?.amount ? (paymentEntity.amount > 100000 && parsed.event?.includes('razorpay') ? paymentEntity.amount / 100 : paymentEntity.amount) : parsed.amount,
        currency: paymentEntity?.currency || parsed.currency || 'INR',
        status,
        utrNumber:
          paymentEntity?.acquirer_data?.rrn ||
          paymentEntity?.acquirer_data?.bank_transaction_id ||
          paymentEntity?.utr ||
          parsed.utr,
        error:
          paymentEntity?.error_description ||
          parsed.data?.payment?.error_description ||
          parsed.error,
        rawEvent: parsed,
      };
    } catch {
      return {
        isValid: false,
        eventType: 'MALFORMED_JSON',
        error: 'Webhook payload is not valid JSON',
      };
    }
  }

  public async reconcileTransaction(
    providerTransactionId: string,
    expectedAmount: number
  ): Promise<ReconciliationResult> {
    const tx = this.transactions.get(providerTransactionId);
    const actualAmount = tx ? tx.amount : expectedAmount;
    const discrepancy = actualAmount - expectedAmount;
    const isMatched = Math.abs(discrepancy) < 0.01;

    return {
      providerTransactionId,
      isMatched,
      providerStatus: 'SUCCEEDED',
      expectedAmount,
      actualAmount,
      discrepancy,
      utrNumber: tx?.utrNumber || `UTR-${providerTransactionId}`,
      settledAt: tx?.createdAt || new Date(),
    };
  }
}
