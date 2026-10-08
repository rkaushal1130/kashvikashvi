import crypto from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FundingProviderFactory,
  MockFundingProvider,
  RazorpayXFundingProvider,
} from '../src/providers/funding';

describe('FUNDING PROVIDER ABSTRACTION & SECURITY (PROMPT 32 TEST SUITE)', () => {
  let mockProvider: MockFundingProvider;

  beforeEach(() => {
    FundingProviderFactory.reset();
    mockProvider = new MockFundingProvider('test_webhook_secret_key_32_chars_min');
  });

  describe('1. MockFundingProvider Sandbox Execution', () => {
    it('should connect corporate account without requiring or storing bank credentials', async () => {
      const result = await mockProvider.connectAccount({
        accountHolderName: 'Kashvi Marketing Pvt Ltd',
        maskedAccountNumber: 'XXXXXXXX8921',
        bankName: 'HDFC Bank Ltd',
        ifscOrRoutingCode: 'HDFC0001234',
        accountType: 'CURRENT',
        currency: 'INR',
      });

      expect(result).toBeDefined();
      expect(result.providerAccountId).toMatch(/^acc_mock_/);
      expect(result.accountHolderName).toBe('Kashvi Marketing Pvt Ltd');
      expect(result.maskedAccountNumber).toBe('XXXXXXXX8921');
      expect(result.status).toBe('ACTIVE');
    });

    it('should retrieve connected account status and float balance', async () => {
      const connected = await mockProvider.connectAccount({
        accountHolderName: 'Kashvi Corporate Operating',
        maskedAccountNumber: 'XXXXXXXX9900',
        bankName: 'ICICI Bank',
        ifscOrRoutingCode: 'ICIC0000002',
      });

      const status = await mockProvider.getAccountStatus(connected.providerAccountId);
      expect(status.status).toBe('ACTIVE');
      expect(status.isVerified).toBe(true);
      expect(status.currentBalance).toBeGreaterThan(0);
    });

    it('should create funding request and return virtual account details', async () => {
      const req = await mockProvider.createFundingRequest({
        providerAccountId: 'acc_mock_123',
        amount: 500000,
        currency: 'INR',
        idempotencyKey: 'IDEMP-TEST-REQ-001',
        description: 'Q4 Operational Float Top-up',
      });

      expect(req.providerTransactionId).toMatch(/^fund_mock_/);
      expect(req.status).toBe('SUCCEEDED');
      expect(req.virtualAccountDetails).toBeDefined();
      expect(req.virtualAccountDetails?.bankName).toBe('HDFC Corporate Smart Collect');
      expect(req.virtualAccountDetails?.ifsc).toBe('HDFC0000060');
    });

    it('should verify transaction when amount matches', async () => {
      const req = await mockProvider.createFundingRequest({
        providerAccountId: 'acc_1',
        amount: 150000,
        currency: 'INR',
        idempotencyKey: 'IDEMP-VERIFY-1',
        description: 'Verify test',
      });

      const verification = await mockProvider.verifyTransaction({
        providerTransactionId: req.providerTransactionId,
        expectedAmount: 150000,
      });

      expect(verification.verified).toBe(true);
      expect(verification.status).toBe('SUCCEEDED');
      expect(verification.amount).toBe(150000);
    });

    it('should detect amount discrepancy during verification', async () => {
      const req = await mockProvider.createFundingRequest({
        providerAccountId: 'acc_1',
        amount: 200000,
        currency: 'INR',
        idempotencyKey: 'IDEMP-VERIFY-DISCREPANCY',
        description: 'Discrepancy test',
      });

      const verification = await mockProvider.verifyTransaction({
        providerTransactionId: req.providerTransactionId,
        expectedAmount: 150000, // Discrepancy: requested 200,000 but expecting 150,000
      });

      expect(verification.verified).toBe(false);
      expect(verification.discrepancyReason).toContain('Amount mismatch');
    });

    it('should verify cryptographic HMAC-SHA256 signature on inbound webhook', async () => {
      const webhookSecret = 'test_webhook_secret_key_32_chars_min';
      mockProvider.setWebhookSecret(webhookSecret);

      const payload = JSON.stringify({
        event: 'funding.settled',
        data: {
          id: 'fund_mock_9988',
          amount: 100000,
          currency: 'INR',
          utr: 'UTR-HDFC-998877',
        },
      });

      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const result = await mockProvider.handleWebhook(payload, validSignature);

      expect(result.isValid).toBe(true);
      expect(result.eventType).toBe('funding.settled');
      expect(result.providerTransactionId).toBe('fund_mock_9988');
      expect(result.amount).toBe(100000);
    });

    it('should reject tampered or invalid webhook signature', async () => {
      const payload = JSON.stringify({ event: 'funding.settled', amount: 50000 });
      const forgedSignature = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      const result = await mockProvider.handleWebhook(payload, forgedSignature);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid webhook signature');
    });

    it('should authoritatively reconcile transaction with zero discrepancy', async () => {
      const req = await mockProvider.createFundingRequest({
        providerAccountId: 'acc_1',
        amount: 75000,
        currency: 'INR',
        idempotencyKey: 'IDEMP-REC-1',
        description: 'Reconcile test',
      });

      const rec = await mockProvider.reconcileTransaction(req.providerTransactionId, 75000);
      expect(rec.isMatched).toBe(true);
      expect(rec.discrepancy).toBe(0);
      expect(rec.actualAmount).toBe(75000);
    });
  });

  describe('2. RazorpayXFundingProvider Webhook Cryptography', () => {
    const webhookSecret = 'razorpayx_secret_test_32_characters_key';
    let rzpProvider: RazorpayXFundingProvider;

    beforeEach(() => {
      rzpProvider = new RazorpayXFundingProvider({
        keyId: 'rzp_test_123',
        keySecret: 'rzp_sec_456',
        webhookSecret,
      });
    });

    it('should verify genuine RazorpayX webhook signature and parse paise to rupees', async () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_990011',
              amount: 5000000, // 50,000.00 INR in paise
              currency: 'INR',
              status: 'captured',
              acquirer_data: { rrn: '998877665544' },
            },
          },
        },
      });

      const validSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      const result = await rzpProvider.handleWebhook(rawPayload, validSignature);

      expect(result.isValid).toBe(true);
      expect(result.eventType).toBe('payment.captured');
      expect(result.providerTransactionId).toBe('pay_rzp_990011');
      expect(result.amount).toBe(50000); // 5,000,000 paise / 100 = 50,000 INR
      expect(result.status).toBe('SUCCEEDED');
      expect(result.utrNumber).toBe('998877665544');
    });

    it('should reject invalid signature on RazorpayX provider', async () => {
      const rawPayload = JSON.stringify({ event: 'payment.failed' });
      const invalidSignature = 'invalid_hex_signature';

      const result = await rzpProvider.handleWebhook(rawPayload, invalidSignature);
      expect(result.isValid).toBe(false);
    });
  });

  describe('3. FundingProviderFactory Dynamic Resolution', () => {
    it('should dynamically resolve MOCK provider by default in test/dev', () => {
      const provider = FundingProviderFactory.getProvider('MOCK');
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('MOCK_SANDBOX');
    });

    it('should resolve RAZORPAYX provider when requested', () => {
      const provider = FundingProviderFactory.getProvider('RAZORPAYX');
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('RAZORPAYX');
    });

    it('should allow setting custom mock provider for test isolation', () => {
      const customMock = new MockFundingProvider('custom_sec');
      FundingProviderFactory.setProvider(customMock);

      const resolved = FundingProviderFactory.getProvider();
      expect(resolved).toBe(customMock);
    });
  });
});
