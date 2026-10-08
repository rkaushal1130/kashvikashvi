import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { FundingWorkflowService } from '../src/services/fundingWorkflow.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { FundingProviderFactory, MockFundingProvider } from '../src/providers/funding';
import { FundingWebhookService } from '../src/services/fundingWebhook.service';
import { AppError } from '../src/utils/appError';

describe('PROMPT 36 — SECURE FUNDING WEBHOOK HANDLING TEST SUITE', () => {
  let inMemoryWallets: Map<string, any>;
  let inMemoryTreasuryTx: Map<string, any>;
  let inMemoryAccounts: Map<string, any>;
  let inMemoryFundingTx: Map<string, any>;
  let inMemoryWebhookEvents: Map<string, any>;
  let inMemoryAuditLogs: any[];

  const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
  const WEBHOOK_SECRET = 'secret_webhook_production_key_kashvimlm_32chars';
  let mockProvider: MockFundingProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    FundingProviderFactory.reset();

    inMemoryWallets = new Map();
    inMemoryTreasuryTx = new Map();
    inMemoryAccounts = new Map();
    inMemoryFundingTx = new Map();
    inMemoryWebhookEvents = new Map();
    inMemoryAuditLogs = [];

    // Setup Mock Provider with secret
    mockProvider = new MockFundingProvider(WEBHOOK_SECRET);
    FundingProviderFactory.registerProvider('MOCK', mockProvider);
    FundingProviderFactory.registerProvider('RAZORPAYX', mockProvider);

    // Seed Primary Treasury Wallet
    const primaryWallet = {
      id: 'wallet-treasury-001',
      walletCode: 'PRIMARY_TREASURY',
      currency: 'INR',
      availableBalance: new Prisma.Decimal(1000000), // 10 Lakhs initial float
      pendingBalance: new Prisma.Decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryWallets.set(primaryWallet.id, primaryWallet);

    // Seed Corporate Funding Account
    const defaultAccount = {
      id: 'fa-corporate-hdfc-01',
      provider: 'RAZORPAYX',
      providerAccountId: 'acc_rzpx_corp_8899',
      accountType: 'CURRENT',
      accountName: 'Kashvi Technologies Corporate Float',
      maskedAccountNumber: 'XXXXXXXX8842',
      currency: 'INR',
      status: 'ACTIVE',
      isPrimary: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryAccounts.set(defaultAccount.id, defaultAccount);

    // Mock Prisma Models
    vi.spyOn(prisma.platformWallet, 'findUnique').mockImplementation(async (args: any) => {
      const code = args.where.walletCode;
      for (const w of inMemoryWallets.values()) {
        if (w.walletCode === code) return { ...w };
      }
      return null;
    });

    vi.spyOn(prisma.platformWallet, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryWallets.get(args.where.id);
      if (!existing) throw new Error('Wallet not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryWallets.set(args.where.id, updated);
      return { ...updated };
    });

    vi.spyOn(prisma.platformWalletTransaction, 'create').mockImplementation(async (args: any) => {
      const newTx = {
        id: `pwtx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryTreasuryTx.set(newTx.id, newTx);
      return { ...newTx };
    });

    vi.spyOn(prisma.platformWalletTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.idempotencyKey) {
        for (const tx of inMemoryTreasuryTx.values()) {
          if (tx.idempotencyKey === args.where.idempotencyKey) return { ...tx };
        }
      }
      return null;
    });

    vi.spyOn(prisma.platformWalletTransaction, 'findFirst').mockImplementation(async (args: any) => {
      const orClauses = args?.where?.OR;
      if (Array.isArray(orClauses)) {
        for (const clause of orClauses) {
          if (clause.externalTransactionId) {
            for (const tx of inMemoryTreasuryTx.values()) {
              if (tx.externalTransactionId === clause.externalTransactionId) return { ...tx };
            }
          }
          if (clause.providerTransactionId) {
            for (const tx of inMemoryTreasuryTx.values()) {
              if (tx.providerTransactionId === clause.providerTransactionId) return { ...tx };
            }
          }
        }
      }
      if (args?.where?.externalTransactionId) {
        for (const tx of inMemoryTreasuryTx.values()) {
          if (tx.externalTransactionId === args.where.externalTransactionId) return { ...tx };
        }
      }
      if (args?.where?.providerTransactionId) {
        for (const tx of inMemoryTreasuryTx.values()) {
          if (tx.providerTransactionId === args.where.providerTransactionId) return { ...tx };
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingAccount, 'findUnique').mockImplementation(async (args: any) => {
      return inMemoryAccounts.get(args.where.id) || null;
    });

    vi.spyOn(prisma.fundingTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) {
        const tx = inMemoryFundingTx.get(args.where.id);
        if (!tx) return null;
        return {
          ...tx,
          fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
          initiatedByAdmin: { id: TEST_ADMIN_ID, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
        };
      }
      return null;
    });

    vi.spyOn(prisma.fundingTransaction, 'findFirst').mockImplementation(async (args: any) => {
      if (args.where?.providerTransactionId) {
        for (const tx of inMemoryFundingTx.values()) {
          if (tx.providerTransactionId === args.where.providerTransactionId) {
            return {
              ...tx,
              fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
              initiatedByAdmin: { id: TEST_ADMIN_ID, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
            };
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingTransaction, 'create').mockImplementation(async (args: any) => {
      const newTx = {
        id: `ftx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryFundingTx.set(newTx.id, newTx);
      return {
        ...newTx,
        fundingAccount: inMemoryAccounts.get(newTx.fundingAccountId),
        initiatedByAdmin: { id: TEST_ADMIN_ID, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
      };
    });

    vi.spyOn(prisma.fundingTransaction, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryFundingTx.get(args.where.id);
      if (!existing) throw new Error('Funding transaction not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryFundingTx.set(args.where.id, updated);
      return {
        ...updated,
        fundingAccount: inMemoryAccounts.get(updated.fundingAccountId),
        initiatedByAdmin: { id: TEST_ADMIN_ID, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
      };
    });

    vi.spyOn(prisma.webhookEvent, 'findUnique').mockImplementation(async (args: any) => {
      const key = `${args.where?.provider_externalEventId?.provider}:${args.where?.provider_externalEventId?.externalEventId}`;
      return inMemoryWebhookEvents.get(key) || null;
    });

    vi.spyOn(prisma.webhookEvent, 'create').mockImplementation(async (args: any) => {
      const key = `${args.data?.provider}:${args.data?.externalEventId}`;
      const record = { id: `whe-${Date.now()}-${Math.random()}`, ...args.data, processedAt: new Date() };
      inMemoryWebhookEvents.set(key, record);
      return record as any;
    });

    vi.spyOn(prisma.auditLog, 'create').mockImplementation(async (args: any) => {
      const log = { id: `audit-${Date.now()}-${Math.random()}`, ...args.data, createdAt: new Date() };
      inMemoryAuditLogs.push(log);
      return log as any;
    });

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  // Helper to generate authentic HMAC-SHA256 signature
  const signPayload = (payload: string, secret: string = WEBHOOK_SECRET) => {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  };

  // =========================================================================
  // 1. SIGNATURE VERIFICATION & TAMPER RESISTANCE
  // =========================================================================
  describe('1. Webhook Signature Verification (Requirements 1 & 2)', () => {
    it('should reject webhook when signature header is missing', async () => {
      const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_101' });

      await expect(
        FundingWebhookService.processWebhook({
          rawPayload: payload,
          signature: '',
          providerName: 'MOCK',
        })
      ).rejects.toThrow('Missing webhook cryptographic signature header');
    });

    it('should reject webhook when signature is invalid or forged', async () => {
      const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_102' });
      const forgedSignature = 'bad0000000000000000000000000000000000000000000000000000000000bad';

      await expect(
        FundingWebhookService.processWebhook({
          rawPayload: payload,
          signature: forgedSignature,
          providerName: 'MOCK',
        })
      ).rejects.toThrow('Invalid provider webhook cryptographic signature');
    });

    it('should reject webhook when signature is computed with wrong secret', async () => {
      const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_103' });
      const wrongSignature = signPayload(payload, 'wrong_secret_key_that_does_not_match');

      await expect(
        FundingWebhookService.processWebhook({
          rawPayload: payload,
          signature: wrongSignature,
          providerName: 'MOCK',
        })
      ).rejects.toThrow('Invalid provider webhook cryptographic signature');
    });

    it('should accept webhook when cryptographic HMAC-SHA256 signature is valid', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        id: 'evt_valid_001',
        data: { payment: { id: 'untracked_tx_123', status: 'captured' } },
      });
      const validSignature = signPayload(payload);

      const result = await FundingWebhookService.processWebhook({
        rawPayload: payload,
        signature: validSignature,
        providerName: 'MOCK',
      });

      expect(result.acknowledged).toBe(true);
    });
  });

  // =========================================================================
  // 2. IDEMPOTENCY: EXACTLY ONE TREASURY CREDIT ACROSS MULTIPLE DELIVERIES
  // =========================================================================
  describe('2. Webhook Idempotency (Requirement 6 - The 3x SUCCESS Webhook Rule)', () => {
    it('Example from Prompt: SUCCESS webhook arrives 3 times -> Exactly ONE treasury credit, never three', async () => {
      // Step A: Admin initiates corporate funding of ₹500,000
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-corporate-hdfc-01',
        amount: 500000,
      });

      const initialTreasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(initialTreasury.availableBalance).toBe(1000000); // 10 Lakhs initial
      expect(inMemoryTreasuryTx.size).toBe(0);

      // Webhook payload representing SUCCESS
      const externalEventId = 'evt_payment_captured_998811';
      const payloadObj = {
        event: 'payment.captured',
        id: externalEventId,
        data: {
          payment: {
            id: init.transaction.providerTransactionId,
            status: 'captured',
            amount: 500000, // ₹500,000
            currency: 'INR',
            acquirer_data: { rrn: 'UTR9988221100' },
          },
        },
      };

      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      // --- FIRST WEBHOOK DELIVERY (SUCCESS #1) ---
      const delivery1 = await FundingWebhookService.processWebhook({
        rawPayload,
        signature,
        providerName: 'MOCK',
      });

      expect(delivery1.acknowledged).toBe(true);
      expect(delivery1.isCredited).toBe(true);
      expect(delivery1.status).toBe('SUCCEEDED');
      expect(delivery1.transactionId).toBe(init.transaction.id);

      // Verify Treasury: exactly +500,000
      const treasuryAfter1 = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasuryAfter1.availableBalance).toBe(1500000); // 10L + 5L = 15L
      expect(inMemoryTreasuryTx.size).toBe(1);

      // --- SECOND WEBHOOK DELIVERY (SUCCESS #2 - Duplicate arrival) ---
      const delivery2 = await FundingWebhookService.processWebhook({
        rawPayload,
        signature,
        providerName: 'MOCK',
      });

      expect(delivery2.acknowledged).toBe(true);
      expect(delivery2.isCredited).toBe(false); // NO extra credit
      expect(delivery2.isDuplicate).toBe(true);
      expect(delivery2.message).toContain('already');

      // Verify Treasury: balance MUST NOT change
      const treasuryAfter2 = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasuryAfter2.availableBalance).toBe(1500000);
      expect(inMemoryTreasuryTx.size).toBe(1); // STILL 1, NEVER 2

      // --- THIRD WEBHOOK DELIVERY (SUCCESS #3 - Provider network retry) ---
      const delivery3 = await FundingWebhookService.processWebhook({
        rawPayload,
        signature,
        providerName: 'MOCK',
      });

      expect(delivery3.acknowledged).toBe(true);
      expect(delivery3.isCredited).toBe(false); // NO extra credit
      expect(delivery3.isDuplicate).toBe(true);

      // Verify Treasury: balance MUST NOT change
      const treasuryAfter3 = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasuryAfter3.availableBalance).toBe(1500000);
      expect(inMemoryTreasuryTx.size).toBe(1); // STILL 1, NEVER 3!

      // WebhookEvent record created with unique key
      const eventRecord = inMemoryWebhookEvents.get(`MOCK:${externalEventId}`);
      expect(eventRecord).toBeDefined();
      expect(eventRecord.externalEventId).toBe(externalEventId);
    });
  });

  // =========================================================================
  // 3. AMOUNT CROSS-VERIFICATION & RECONCILIATION_REQUIRED
  // =========================================================================
  describe('3. Amount Discrepancy Guard (Requirement 7)', () => {
    it('should NOT credit automatically when webhook amount differs from expected amount, marking RECONCILIATION_REQUIRED', async () => {
      // Step A: Admin initiates request for ₹200,000
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-corporate-hdfc-01',
        amount: 200000,
      });

      // Step B: Webhook arrives claiming payment of ₹150,000 (discrepancy!)
      const payloadObj = {
        event: 'payment.captured',
        id: 'evt_discrepancy_7766',
        data: {
          payment: {
            id: init.transaction.providerTransactionId,
            status: 'captured',
            amount: 150000, // Expected 200,000, got 150,000
            currency: 'INR',
          },
        },
      };

      // Mock provider verifyTransaction returning discrepancy
      vi.spyOn(mockProvider, 'verifyTransaction').mockResolvedValueOnce({
        verified: true,
        providerTransactionId: init.transaction.providerTransactionId!,
        status: 'SUCCEEDED',
        amount: 150000, // Provider confirmed 150,000
        currency: 'INR',
        rawProviderStatus: 'captured',
      });

      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const result = await FundingWebhookService.processWebhook({
        rawPayload,
        signature,
        providerName: 'MOCK',
      });

      // INVARIANT: DO NOT credit automatically!
      expect(result.acknowledged).toBe(true);
      expect(result.isCredited).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancy).toBeDefined();
      expect(result.discrepancy?.expectedAmount).toBe(200000);
      expect(result.discrepancy?.confirmedAmount).toBe(150000);

      // Verify transaction state updated to RECONCILIATION_REQUIRED
      const tx = inMemoryFundingTx.get(init.transaction.id);
      expect(tx.status).toBe('RECONCILIATION_REQUIRED');
      expect(tx.failureReason).toContain('Amount discrepancy');

      // Verify Treasury untouched
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(1000000); // 10L unchanged
      expect(inMemoryTreasuryTx.size).toBe(0);

      // Verify AuditLog alert emitted
      const alertLog = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_RECONCILIATION_DISCREPANCY');
      expect(alertLog).toBeDefined();
      expect(alertLog.newData.alert).toBe('RECONCILIATION_REQUIRED');
    });
  });

  // =========================================================================
  // 4. ATOMIC TREASURY CREDITING & AUDIT LOGGING
  // =========================================================================
  describe('4. Ledger & Audit Completeness (Requirements 9, 10 & 11)', () => {
    it('should create immutable PlatformWalletTransaction and AuditLog when confirmed successful', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-corporate-hdfc-01',
        amount: 400000,
      });

      const payloadObj = {
        event: 'payment.captured',
        id: 'evt_ledger_check_01',
        data: {
          payment: {
            id: init.transaction.providerTransactionId,
            status: 'captured',
            amount: 400000,
            currency: 'INR',
            acquirer_data: { rrn: 'RRN445566' },
          },
        },
      };

      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const result = await FundingWebhookService.processWebhook({
        rawPayload,
        signature,
        providerName: 'MOCK',
      });

      expect(result.isCredited).toBe(true);

      // Verify Treasury Ledger entry (Requirement 10)
      expect(inMemoryTreasuryTx.size).toBe(1);
      const ledger = Array.from(inMemoryTreasuryTx.values())[0];
      expect(ledger.type).toBe('FUNDING');
      expect(ledger.amount.toNumber()).toBe(400000);
      expect(ledger.balanceBefore.toNumber()).toBe(1000000);
      expect(ledger.balanceAfter.toNumber()).toBe(1400000);
      expect(ledger.referenceId).toBe(init.transaction.id);

      // Verify Audit Log (Requirement 11)
      const audit = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_WEBHOOK_SETTLED');
      expect(audit).toBeDefined();
      expect(audit.entityId).toBe(init.transaction.id);
      expect(audit.newData.amount).toBe(400000);
      expect(audit.newData.newTreasuryBalance).toBe(1400000);
    });

    it('should mark transaction FAILED and not credit treasury on failure event', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-corporate-hdfc-01',
        amount: 100000,
      });

      const payloadObj = {
        event: 'payment.failed',
        id: 'evt_failed_01',
        data: {
          payment: {
            id: init.transaction.providerTransactionId,
            status: 'failed',
            error_description: 'Card or account authorization declined by issuing bank',
          },
        },
      };

      const rawPayload = JSON.stringify(payloadObj);
      const signature = signPayload(rawPayload);

      const result = await FundingWebhookService.processWebhook({
        rawPayload,
        signature,
        providerName: 'MOCK',
      });

      expect(result.acknowledged).toBe(true);
      expect(result.isCredited).toBe(false);
      expect(result.status).toBe('FAILED');

      const tx = inMemoryFundingTx.get(init.transaction.id);
      expect(tx.status).toBe('FAILED');

      // Treasury untouched
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(1000000);
      expect(inMemoryTreasuryTx.size).toBe(0);
    });
  });
});
