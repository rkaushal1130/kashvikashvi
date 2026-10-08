import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { FundingWorkflowService } from '../src/services/fundingWorkflow.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { FundingService } from '../src/services/funding.service';
import { FundingProviderFactory, MockFundingProvider } from '../src/providers/funding';
import { AppError } from '../src/utils/appError';

describe('ADMIN FUNDING WORKFLOW & LIFECYCLE (PROMPT 33 TEST SUITE)', () => {
  let inMemoryWallets: Map<string, any>;
  let inMemoryTreasuryTx: Map<string, any>;
  let inMemoryAccounts: Map<string, any>;
  let inMemoryFundingTx: Map<string, any>;
  let inMemoryAuditLogs: any[];

  const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
  const WEBHOOK_SECRET = 'test_webhook_secret_key_32_chars_min';
  let mockProvider: MockFundingProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    FundingProviderFactory.reset();

    inMemoryWallets = new Map();
    inMemoryTreasuryTx = new Map();
    inMemoryAccounts = new Map();
    inMemoryFundingTx = new Map();
    inMemoryAuditLogs = [];

    // Setup Mock Provider as default
    mockProvider = new MockFundingProvider(WEBHOOK_SECRET);
    FundingProviderFactory.registerProvider('MOCK', mockProvider);
    FundingProviderFactory.registerProvider('RAZORPAYX', mockProvider);

    // Seed Primary Treasury Wallet
    const primaryWallet = {
      id: 'wallet-treasury-001',
      walletCode: 'PRIMARY_TREASURY',
      currency: 'INR',
      availableBalance: new Prisma.Decimal(0),
      pendingBalance: new Prisma.Decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryWallets.set(primaryWallet.id, primaryWallet);

    // Seed Active Funding Account
    const defaultAccount = {
      id: 'fa-test-corporate-001',
      provider: 'MOCK',
      providerAccountId: 'acc_mock_hdfc_corp',
      accountType: 'CURRENT',
      accountName: 'Kashvi Corporate Treasury Account',
      maskedAccountNumber: 'XXXXXXXX8921',
      currency: 'INR',
      status: 'ACTIVE',
      isPrimary: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryAccounts.set(defaultAccount.id, defaultAccount);

    // Seed Inactive Funding Account for validation tests
    const inactiveAccount = {
      id: 'fa-test-inactive-002',
      provider: 'MOCK',
      providerAccountId: 'acc_mock_suspended',
      accountType: 'CURRENT',
      accountName: 'Suspended Account',
      maskedAccountNumber: 'XXXXXXXX1111',
      currency: 'INR',
      status: 'SUSPENDED',
      isPrimary: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryAccounts.set(inactiveAccount.id, inactiveAccount);

    // 1. Mock platformWallet
    vi.spyOn(prisma.platformWallet, 'findUnique').mockImplementation(async (args: any) => {
      const code = args.where.walletCode;
      for (const w of inMemoryWallets.values()) {
        if (w.walletCode === code) return { ...w };
      }
      return null;
    });

    vi.spyOn(prisma.platformWallet, 'create').mockImplementation(async (args: any) => {
      const newWallet = {
        id: `wallet-${Date.now()}-${Math.random()}`,
        walletCode: args.data.walletCode || 'PRIMARY_TREASURY',
        currency: args.data.currency || 'INR',
        availableBalance: new Prisma.Decimal(args.data.availableBalance ?? 0),
        pendingBalance: new Prisma.Decimal(args.data.pendingBalance ?? 0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryWallets.set(newWallet.id, newWallet);
      return { ...newWallet };
    });

    vi.spyOn(prisma.platformWallet, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryWallets.get(args.where.id);
      if (!existing) throw new Error('Wallet not found');

      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      inMemoryWallets.set(args.where.id, updated);
      return { ...updated };
    });

    // 2. Mock platformWalletTransaction
    vi.spyOn(prisma.platformWalletTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.idempotencyKey) {
        for (const tx of inMemoryTreasuryTx.values()) {
          if (tx.idempotencyKey === args.where.idempotencyKey) return { ...tx };
        }
      }
      return null;
    });

    vi.spyOn(prisma.platformWalletTransaction, 'findFirst').mockImplementation(async (args: any) => {
      const orClauses = args.where?.OR;
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
      return null;
    });

    vi.spyOn(prisma.platformWalletTransaction, 'create').mockImplementation(async (args: any) => {
      const newTx = {
        id: `pwtx-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryTreasuryTx.set(newTx.id, newTx);
      return { ...newTx };
    });

    vi.spyOn(prisma.platformWalletTransaction, 'count').mockImplementation(async (args: any) => {
      let count = 0;
      for (const tx of inMemoryTreasuryTx.values()) {
        if (!args?.where?.type || tx.type === args.where.type) {
          count++;
        }
      }
      return count;
    });

    vi.spyOn(prisma.platformWalletTransaction, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryTreasuryTx.values());
      if (args?.where?.type) {
        list = list.filter((t) => t.type === args.where.type);
      }
      return list;
    });

    // 3. Mock fundingAccount
    vi.spyOn(prisma.fundingAccount, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) {
        return inMemoryAccounts.get(args.where.id) || null;
      }
      return null;
    });

    vi.spyOn(prisma.fundingAccount, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryAccounts.values());
      if (args?.where?.status) {
        list = list.filter((a) => a.status === args.where.status);
      }
      return list;
    });

    // 4. Mock fundingTransaction
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
      if (args.where.idempotencyKey) {
        for (const tx of inMemoryFundingTx.values()) {
          if (tx.idempotencyKey === args.where.idempotencyKey) {
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
      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      inMemoryFundingTx.set(args.where.id, updated);
      return {
        ...updated,
        fundingAccount: inMemoryAccounts.get(updated.fundingAccountId),
        initiatedByAdmin: { id: TEST_ADMIN_ID, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
      };
    });

    vi.spyOn(prisma.fundingTransaction, 'count').mockImplementation(async () => inMemoryFundingTx.size);

    vi.spyOn(prisma.fundingTransaction, 'findMany').mockImplementation(async () => {
      return Array.from(inMemoryFundingTx.values()).map((t) => ({
        ...t,
        fundingAccount: inMemoryAccounts.get(t.fundingAccountId),
        initiatedByAdmin: { id: TEST_ADMIN_ID, email: 'admin@kashvimlm.com', fullName: 'Super Admin' },
      }));
    });

    vi.spyOn(prisma.fundingTransaction, 'groupBy').mockResolvedValue([] as any);

    // 5. Mock auditLog
    vi.spyOn(prisma.auditLog, 'create').mockImplementation(async (args: any) => {
      const log = { id: `audit-${Date.now()}`, ...args.data, createdAt: new Date() };
      inMemoryAuditLogs.push(log);
      return log as any;
    });

    // 6. Mock webhookEvent (Prompt 36)
    const inMemoryWebhookEvents = new Map();
    if (prisma.webhookEvent) {
      vi.spyOn(prisma.webhookEvent, 'findUnique').mockImplementation(async (args: any) => {
        const key = `${args.where?.provider_externalEventId?.provider}:${args.where?.provider_externalEventId?.externalEventId}`;
        return inMemoryWebhookEvents.get(key) || null;
      });
      vi.spyOn(prisma.webhookEvent, 'create').mockImplementation(async (args: any) => {
        const key = `${args.data?.provider}:${args.data?.externalEventId}`;
        const record = { id: `whe-${Date.now()}`, ...args.data, processedAt: new Date() };
        inMemoryWebhookEvents.set(key, record);
        return record as any;
      });
    }

    // 7. Mock prisma.$transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  describe('1. Funding Portal Dashboard & Initial State', () => {
    it('should view treasury balance, active connected accounts, and summary statistics', async () => {
      const dashboard = await FundingWorkflowService.getFundingDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.treasury.availableBalance).toBe(0);
      expect(dashboard.treasury.currency).toBe('INR');
      expect(dashboard.accounts.length).toBe(2);
      expect(dashboard.accounts[0].accountName).toBe('Kashvi Corporate Treasury Account');
      expect(dashboard.recentTransactions).toHaveLength(0);
      expect(dashboard.stats.totalSucceeded).toBe(0);
      expect(dashboard.stats.totalInitiated).toBe(0);
    });
  });

  describe('2. Intended Funding Amount Validation & Initiation', () => {
    it('should reject non-positive funding amounts', async () => {
      await expect(
        FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
          fundingAccountId: 'fa-test-corporate-001',
          amount: 0,
        })
      ).rejects.toThrow('greater than zero');

      await expect(
        FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
          fundingAccountId: 'fa-test-corporate-001',
          amount: -500,
        })
      ).rejects.toThrow('greater than zero');
    });

    it('should reject funding amounts below minimum threshold (100.00 INR)', async () => {
      await expect(
        FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
          fundingAccountId: 'fa-test-corporate-001',
          amount: 50,
        })
      ).rejects.toThrow('Minimum corporate funding amount is 100.00 INR');
    });

    it('should reject initiation for non-existent or inactive funding accounts', async () => {
      await expect(
        FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
          fundingAccountId: 'non-existent-account-id',
          amount: 50000,
        })
      ).rejects.toThrow('not found');

      await expect(
        FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
          fundingAccountId: 'fa-test-inactive-002',
          amount: 50000,
        })
      ).rejects.toThrow('not in ACTIVE status');
    });

    it('should create PENDING transaction and provider funding request without altering treasury balance', async () => {
      const result = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 250000,
        description: 'Quarterly commission reserve top-up',
      });

      expect(result).toBeDefined();
      expect(result.transaction.status).toBe('PENDING');
      expect(result.transaction.amount).toBe(250000);
      expect(result.transaction.providerTransactionId).toMatch(/^fund_mock_/);
      expect(result.virtualAccountDetails).toBeDefined();

      // INVARIANT: Intended amount is NOT proof of funds; Treasury MUST remain 0.00
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(0);

      // Verify AuditLog entry was emitted
      const initiatedAudit = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_TRANSACTION_INITIATED');
      expect(initiatedAudit).toBeDefined();
      expect(initiatedAudit.entityId).toBe(result.transaction.id);
    });

    it('should enforce idempotency when same idempotencyKey is submitted twice', async () => {
      const idempotencyKey = 'CORP_TOPUP_IDEMP_999';

      const firstCall = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 100000,
        idempotencyKey,
      });

      const secondCall = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 100000,
        idempotencyKey,
      });

      expect(secondCall.transaction.id).toBe(firstCall.transaction.id);
      expect(inMemoryFundingTx.size).toBe(1);
    });
  });

  describe('3. External Settlement Verification Rules (Failed / Pending / Succeeded)', () => {
    it('RULE: Provider reporting FAILED must mark transaction FAILED and NEVER credit treasury', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 50000,
      });

      // Simulate provider verification failure
      vi.spyOn(mockProvider, 'verifyTransaction').mockResolvedValueOnce({
        status: 'FAILED',
        verified: false,
        discrepancyReason: 'Corporate bank declined payment due to insufficient funds',
      });

      const verifyResult = await FundingWorkflowService.verifyAndProcessFunding(
        TEST_ADMIN_ID,
        init.transaction.id
      );

      expect(verifyResult.isCredited).toBe(false);
      expect(verifyResult.transaction.status).toBe('FAILED');
      expect(verifyResult.transaction.failureReason).toContain('Corporate bank declined');

      // ABSOLUTE INVARIANT: Treasury balance MUST NOT change
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(0);
      expect(inMemoryTreasuryTx.size).toBe(0);

      // Verify AuditLog
      const failedAudit = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_TRANSACTION_FAILED');
      expect(failedAudit).toBeDefined();
    });

    it('RULE: Provider reporting PENDING must remain PENDING and NEVER credit treasury', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 75000,
      });

      // Simulate provider still processing (NEFT clearing window)
      vi.spyOn(mockProvider, 'verifyTransaction').mockResolvedValueOnce({
        status: 'PENDING',
        verified: false,
      });

      const verifyResult = await FundingWorkflowService.verifyAndProcessFunding(
        TEST_ADMIN_ID,
        init.transaction.id
      );

      expect(verifyResult.isCredited).toBe(false);
      expect(verifyResult.transaction.status).toBe('PENDING');

      // Treasury remains untouched
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(0);
    });

    it('RULE: Provider reporting SUCCEEDED must atomically credit treasury and link ledger transaction', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 500000,
      });

      const verifyResult = await FundingWorkflowService.verifyAndProcessFunding(
        TEST_ADMIN_ID,
        init.transaction.id,
        { utrNumber: 'HDFCN26098123456' }
      );

      expect(verifyResult.isCredited).toBe(true);
      expect(verifyResult.transaction.status).toBe('SUCCEEDED');
      expect(verifyResult.transaction.platformWalletTransactionId).toBeDefined();
      expect(verifyResult.treasuryBalance).toBe(500000);

      // Platform Treasury wallet balance must reflect the exact verified funds
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(500000);

      // Immutable Treasury Ledger entry created
      expect(inMemoryTreasuryTx.size).toBe(1);
      const ledgerEntry = Array.from(inMemoryTreasuryTx.values())[0];
      expect(ledgerEntry.type).toBe('FUNDING');
      expect(ledgerEntry.amount.toNumber()).toBe(500000);
      expect(ledgerEntry.balanceBefore.toNumber()).toBe(0);
      expect(ledgerEntry.balanceAfter.toNumber()).toBe(500000);
      expect(ledgerEntry.referenceId).toBe(init.transaction.id);

      // AuditLog emitted
      const succeededAudit = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_TRANSACTION_SUCCEEDED');
      expect(succeededAudit).toBeDefined();
    });

    it('RULE: Re-verifying an already SUCCEEDED transaction must be strictly idempotent (no double credit)', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 200000,
      });

      // First verification succeeds
      await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, init.transaction.id);
      expect((await PlatformTreasuryService.getTreasuryBalance()).availableBalance).toBe(200000);

      // Second verification attempt
      const secondResult = await FundingWorkflowService.verifyAndProcessFunding(
        TEST_ADMIN_ID,
        init.transaction.id
      );

      expect(secondResult.isCredited).toBe(false);
      expect(secondResult.message).toContain('already been verified and credited');
      // Treasury balance MUST NOT be credited twice
      expect((await PlatformTreasuryService.getTreasuryBalance()).availableBalance).toBe(200000);
      expect(inMemoryTreasuryTx.size).toBe(1);
    });
  });

  describe('4. Asynchronous Webhook Settlement Lifecycle', () => {
    it('should reject webhook payloads with invalid cryptographic HMAC signatures', async () => {
      const invalidSignature = 'invalid_tampered_signature_hex';
      const payload = JSON.stringify({ event: 'payment.captured' });

      await expect(
        FundingWorkflowService.handleProviderWebhook(payload, invalidSignature, 'MOCK')
      ).rejects.toThrow('Invalid provider webhook cryptographic signature');
    });

    it('should process SUCCEEDED webhook event and credit treasury idempotently', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 300000,
      });

      // Construct authentic webhook payload
      const payloadObj = {
        event: 'payment.captured',
        entity: 'event',
        data: {
          payment: {
            id: init.transaction.providerTransactionId,
            status: 'captured',
            amount: 30000000, // 300,000 INR in paise
            currency: 'INR',
            acquirer_data: {
              rrn: '123456789012',
              bank_transaction_id: 'CMS99887766',
            },
          },
        },
      };

      const rawPayload = JSON.stringify(payloadObj);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const webhookResult = await FundingWorkflowService.handleProviderWebhook(
        rawPayload,
        signature,
        'MOCK'
      );

      expect(webhookResult.acknowledged).toBe(true);
      expect(webhookResult.transactionId).toBe(init.transaction.id);

      // Treasury verified and credited
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(300000);

      // Repeat identical webhook (retry delivery): must acknowledge without double-credit
      const retryResult = await FundingWorkflowService.handleProviderWebhook(
        rawPayload,
        signature,
        'MOCK'
      );
      expect(retryResult.acknowledged).toBe(true);
      expect(retryResult.message).toContain('already settled');
      expect((await PlatformTreasuryService.getTreasuryBalance()).availableBalance).toBe(300000);
    });

    it('should mark transaction FAILED when webhook reports payment failure', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 150000,
      });

      const payloadObj = {
        event: 'payment.failed',
        data: {
          payment: {
            id: init.transaction.providerTransactionId,
            status: 'failed',
            error_description: 'Payment timed out at corporate netbanking gateway',
          },
        },
      };

      const rawPayload = JSON.stringify(payloadObj);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const webhookResult = await FundingWorkflowService.handleProviderWebhook(
        rawPayload,
        signature,
        'MOCK'
      );

      expect(webhookResult.acknowledged).toBe(true);

      const tx = inMemoryFundingTx.get(init.transaction.id);
      expect(tx.status).toBe('FAILED');
      expect(tx.failureReason).toContain('timed out');
      expect((await PlatformTreasuryService.getTreasuryBalance()).availableBalance).toBe(0);
    });
  });

  describe('5. Funding Reversal & Chargeback Lifecycle', () => {
    it('should debit treasury and mark transaction REVERSED upon authorized reversal', async () => {
      // 1. Initial successful funding of 400,000 INR
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 400000,
      });

      await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, init.transaction.id);
      expect((await PlatformTreasuryService.getTreasuryBalance()).availableBalance).toBe(400000);

      // 2. Execute Reversal (e.g. corporate bank clawback or mistaken duplicate transfer)
      const reversalResult = await FundingWorkflowService.processFundingReversal(
        TEST_ADMIN_ID,
        init.transaction.id,
        'Erroneous duplicate corporate bank transfer reversed by treasury manager'
      );

      expect(reversalResult.transaction.status).toBe('REVERSED');
      expect(reversalResult.treasuryBalance).toBe(0);

      // Platform Treasury wallet balance must be reduced back to 0
      const treasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(treasury.availableBalance).toBe(0);

      // Ledger must contain immutable FUNDING_REVERSAL transaction
      const transactions = Array.from(inMemoryTreasuryTx.values());
      expect(transactions).toHaveLength(2);
      const reversalTx = transactions.find((t) => t.type === 'FUNDING_REVERSAL');
      expect(reversalTx).toBeDefined();
      expect(reversalTx?.amount.toNumber()).toBe(400000);
      expect(reversalTx?.balanceBefore.toNumber()).toBe(400000);
      expect(reversalTx?.balanceAfter.toNumber()).toBe(0);

      // AuditLog emitted
      const reversalAudit = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_TRANSACTION_REVERSED');
      expect(reversalAudit).toBeDefined();
    });

    it('should reject reversal on non-succeeded transactions', async () => {
      const init = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 100000,
      });

      // Still PENDING
      await expect(
        FundingWorkflowService.processFundingReversal(
          TEST_ADMIN_ID,
          init.transaction.id,
          'Attempt to reverse pending'
        )
      ).rejects.toThrow('Only SUCCEEDED funding transactions can be reversed');
    });
  });

  describe('6. Platform Treasury Ledger Audit & Reconciliation', () => {
    it('should reconcile treasury ledger correctly with zero variance', async () => {
      // 1. Fund 600,000 INR
      const init1 = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 600000,
      });
      await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, init1.transaction.id);

      // 2. Fund 400,000 INR
      const init2 = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        fundingAccountId: 'fa-test-corporate-001',
        amount: 400000,
      });
      await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, init2.transaction.id);

      // 3. Reconcile
      const report = await PlatformTreasuryService.reconcileTreasury();
      expect(report.isBalanced).toBe(true);
      expect(report.currentBalance).toBe(1000000);
      expect(report.calculatedLedgerBalance).toBe(1000000);
      expect(report.discrepancy).toBe(0);
      expect(report.transactionCount).toBe(2);
    });
  });
});
