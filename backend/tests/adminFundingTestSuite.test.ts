import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { FundingWorkflowService } from '../src/services/fundingWorkflow.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { FundingReconciliationService } from '../src/services/fundingReconciliation.service';
import { FundingProviderFactory, MockFundingProvider } from '../src/providers/funding';
import { createAdminToken, createTestToken } from './helpers/testHelpers';
import { AppError } from '../src/utils/appError';

/**
 * ============================================================================
 * PROMPT 41 — COMPLETE ADMIN FUNDING AUTOMATED TEST SUITE
 * ============================================================================
 *
 * Automated verification of the 15 critical financial & governance invariants:
 * TEST 1:  Admin creates ₹10,000 funding request (Status: PENDING; Treasury unchanged)
 * TEST 2:  Provider confirms success (Treasury increases exactly ₹10,000; 1 ledger entry)
 * TEST 3:  Same success webhook arrives three times (Treasury increases only once)
 * TEST 4:  Provider reports failure (Treasury does not increase; Status: FAILED)
 * TEST 5:  Provider reports amount ₹9,000 vs request ₹10,000 (Status: RECONCILIATION_REQUIRED; No auto credit)
 * TEST 6:  Invalid webhook signature (Rejected; No financial change)
 * TEST 7:  Non-admin calls funding API (403 Forbidden)
 * TEST 8:  Admin attempts negative amount (Validation failure)
 * TEST 9:  Admin attempts zero amount (Validation failure)
 * TEST 10: Admin attempts excessively large amount beyond limit (Validation failure)
 * TEST 11: Same provider transaction ID processed twice (One treasury credit)
 * TEST 12: Funding reversal (Original immutable; Reversal transaction created)
 * TEST 13: Database failure during treasury credit (Entire transaction rolls back)
 * TEST 14: Concurrent duplicate funding processing (One credit only)
 * TEST 15: Audit log (Every financial action generates an audit record)
 */
describe('PROMPT 41 — COMPLETE ADMIN FUNDING TEST SUITE', () => {
  let inMemoryWallets: Map<string, any>;
  let inMemoryTreasuryTx: Map<string, any>;
  let inMemoryAccounts: Map<string, any>;
  let inMemoryFundingTx: Map<string, any>;
  let inMemoryWebhookEvents: Map<string, any>;
  let inMemoryAuditLogs: any[];

  const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
  const WEBHOOK_SECRET = 'secret_webhook_production_key_kashvimlm_32chars';
  const adminToken = createAdminToken({ id: TEST_ADMIN_ID });
  const distributorToken = createTestToken({ role: 'DISTRIBUTOR' });

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

    // Register Mock Provider
    mockProvider = new MockFundingProvider(WEBHOOK_SECRET);
    FundingProviderFactory.registerProvider('MOCK', mockProvider);
    FundingProviderFactory.registerProvider('RAZORPAYX', mockProvider);
    FundingProviderFactory.registerProvider('MOCK_SANDBOX', mockProvider);

    // Seed Primary Treasury Wallet
    const primaryWallet = {
      id: 'wallet-treasury-001',
      walletCode: 'PRIMARY_TREASURY',
      currency: 'INR',
      availableBalance: new Prisma.Decimal('100000.00'),
      pendingBalance: new Prisma.Decimal('0.00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryWallets.set(primaryWallet.id, primaryWallet);

    // Seed Corporate Funding Account
    const defaultAccount = {
      id: 'fa-test-corporate-001',
      provider: 'RAZORPAYX',
      providerAccountId: 'acc_mock_rzpx_corp',
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

    // Mock platformWallet
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
        availableBalance: new Prisma.Decimal(args.data.availableBalance ?? existing.availableBalance),
        updatedAt: new Date(),
      };
      inMemoryWallets.set(updated.id, updated);
      return { ...updated };
    });

    // Mock platformWalletTransaction
    vi.spyOn(prisma.platformWalletTransaction, 'findMany').mockImplementation(async (args: any) => {
      const where = args?.where || {};
      let list = Array.from(inMemoryTreasuryTx.values());

      if (where.type) {
        if (where.type.in) {
          list = list.filter((t) => where.type.in.includes(t.type));
        } else {
          list = list.filter((t) => t.type === where.type);
        }
      }

      if (where.OR) {
        list = list.filter((t) => {
          return where.OR.some((condition: any) => {
            if (condition.referenceType && condition.referenceId) {
              return t.referenceType === condition.referenceType && t.referenceId === condition.referenceId;
            }
            if (condition.providerTransactionId) {
              return t.providerTransactionId === condition.providerTransactionId;
            }
            if (condition.externalTransactionId) {
              return t.externalTransactionId === condition.externalTransactionId;
            }
            if (condition.idempotencyKey) {
              return t.idempotencyKey === condition.idempotencyKey;
            }
            return false;
          });
        });
      }

      return list.map((t) => ({ ...t }));
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
      if (args.where?.OR) {
        for (const tx of inMemoryTreasuryTx.values()) {
          for (const condition of args.where.OR) {
            if (condition.externalTransactionId && tx.externalTransactionId === condition.externalTransactionId) {
              return { ...tx };
            }
            if (condition.providerTransactionId && tx.providerTransactionId === condition.providerTransactionId) {
              return { ...tx };
            }
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.platformWalletTransaction, 'create').mockImplementation(async (args: any) => {
      if (args.data.idempotencyKey) {
        for (const existing of inMemoryTreasuryTx.values()) {
          if (existing.idempotencyKey === args.data.idempotencyKey) {
            const err = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
            (err as any).code = 'P2002';
            throw err;
          }
        }
      }
      const newTx = {
        id: `pwtx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryTreasuryTx.set(newTx.id, newTx);
      return { ...newTx };
    });

    // Mock fundingAccount
    vi.spyOn(prisma.fundingAccount, 'findUnique').mockImplementation(async (args: any) => {
      return inMemoryAccounts.get(args.where.id) || null;
    });

    vi.spyOn(prisma.fundingAccount, 'findFirst').mockImplementation(async () => {
      return Array.from(inMemoryAccounts.values())[0] || null;
    });

    vi.spyOn(prisma.fundingAccount, 'findMany').mockImplementation(async () => {
      return Array.from(inMemoryAccounts.values());
    });

    // Mock fundingTransaction
    vi.spyOn(prisma.fundingTransaction, 'findUnique').mockImplementation(async (args: any) => {
      const tx = inMemoryFundingTx.get(args.where.id);
      if (!tx) return null;
      return {
        ...tx,
        fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
        initiatedByAdmin: { id: tx.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Admin' },
      };
    });

    vi.spyOn(prisma.fundingTransaction, 'findFirst').mockImplementation(async (args: any) => {
      for (const tx of inMemoryFundingTx.values()) {
        if (args.where.providerTransactionId && tx.providerTransactionId === args.where.providerTransactionId) {
          return {
            ...tx,
            fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
            initiatedByAdmin: { id: tx.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Admin' },
          };
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingTransaction, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryFundingTx.values());
      if (args?.where?.provider) {
        list = list.filter((t) => t.provider === args.where.provider);
      }
      if (args?.where?.status) {
        list = list.filter((t) => t.status === args.where.status);
      }
      if (args?.where?.providerTransactionId) {
        list = list.filter((t) => t.providerTransactionId === args.where.providerTransactionId);
      }
      return list.map((tx) => ({
        ...tx,
        fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
        initiatedByAdmin: { id: tx.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Admin' },
      }));
    });

    vi.spyOn(prisma.fundingTransaction, 'count').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryFundingTx.values());
      if (args?.where?.status) {
        list = list.filter((t) => t.status === args.where.status);
      }
      if (args?.where?.providerTransactionId) {
        list = list.filter((t) => t.providerTransactionId === args.where.providerTransactionId);
      }
      return list.length;
    });

    vi.spyOn(prisma.fundingTransaction, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryFundingTx.get(args.where.id);
      if (!existing) throw new Error('Funding transaction not found');
      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      inMemoryFundingTx.set(updated.id, updated);
      return {
        ...updated,
        fundingAccount: inMemoryAccounts.get(updated.fundingAccountId),
        initiatedByAdmin: { id: updated.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Admin' },
      };
    });

    vi.spyOn(prisma.fundingTransaction, 'create').mockImplementation(async (args: any) => {
      const created = {
        id: `ftx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryFundingTx.set(created.id, created);
      return {
        ...created,
        fundingAccount: inMemoryAccounts.get(created.fundingAccountId),
        initiatedByAdmin: { id: created.initiatedByAdminId, email: 'admin@kashvimlm.com', fullName: 'Admin' },
      };
    });

    // Mock auditLog
    vi.spyOn(prisma.auditLog, 'create').mockImplementation(async (args: any) => {
      const log = { id: `audit-${Date.now()}-${Math.random()}`, ...args.data, createdAt: new Date() };
      inMemoryAuditLogs.push(log);
      return log;
    });

    // Mock webhookEvent
    vi.spyOn(prisma.webhookEvent, 'findUnique').mockImplementation(async (args: any) => {
      const compound = args?.where?.provider_externalEventId;
      if (compound) {
        for (const event of inMemoryWebhookEvents.values()) {
          if (
            event.provider === compound.provider &&
            event.externalEventId === compound.externalEventId
          ) {
            return { ...event };
          }
        }
      }
      if (args?.where?.id) {
        return inMemoryWebhookEvents.get(args.where.id) || null;
      }
      return null;
    });

    vi.spyOn(prisma.webhookEvent, 'findFirst').mockImplementation(async (args: any) => {
      for (const event of inMemoryWebhookEvents.values()) {
        if (
          event.provider === args.where.provider &&
          event.externalEventId === args.where.externalEventId
        ) {
          return { ...event };
        }
      }
      return null;
    });

    vi.spyOn(prisma.webhookEvent, 'create').mockImplementation(async (args: any) => {
      const ev = { id: `whe-${Date.now()}-${Math.random()}`, ...args.data, createdAt: new Date() };
      inMemoryWebhookEvents.set(ev.id, ev);
      return ev;
    });

    // Mock $transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback(prisma);
    });
  });

  // Helper to generate HMAC-SHA256 signature
  const signPayload = (payload: string, secret: string = WEBHOOK_SECRET): string => {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  };

  // =========================================================================
  // TEST 1: Admin creates ₹10,000 funding request
  // =========================================================================
  it('TEST 1: Admin creates ₹10,000 funding request -> Status: PENDING, Treasury does NOT increase yet', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const result = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
      description: 'Corporate Float Replenishment',
    });

    // Expected: FundingTransaction = PENDING
    expect(result.transaction.status).toBe('PENDING');
    expect(result.transaction.amount).toBe(10000);

    // Expected: Treasury does NOT increase yet
    const currentBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(currentBalance).toBe(initialBalance);

    // Expected: No PlatformWalletTransaction created yet
    const ledgerEntries = Array.from(inMemoryTreasuryTx.values()).filter(
      (t) => t.referenceId === result.transaction.id
    );
    expect(ledgerEntries).toHaveLength(0);
  });

  // =========================================================================
  // TEST 2: Provider confirms success
  // =========================================================================
  it('TEST 2: Provider confirms success -> Treasury increases exactly ₹10,000, One ledger transaction', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    // Step A: Initiate ₹10,000 funding
    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    // Step B: Seed provider success
    mockProvider.seedStatus(providerTxId, {
      status: 'SUCCEEDED',
      amount: 10000,
      currency: 'INR',
      utrNumber: 'UTR_TEST2_10000',
    });

    // Step C: Verify & settle
    const settleResult = await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId, {
      utrNumber: 'UTR_TEST2_10000',
    });

    expect(settleResult.isCredited).toBe(true);
    expect(settleResult.transaction.status).toBe('SUCCEEDED');

    // Expected: Treasury increases exactly ₹10,000
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance + 10000);

    // Expected: Exactly one ledger transaction
    const ledgerEntries = Array.from(inMemoryTreasuryTx.values()).filter(
      (t) => t.referenceId === txId && t.type === 'FUNDING'
    );
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0].amount.toNumber()).toBe(10000);
    expect(ledgerEntries[0].status).toBe('COMPLETED');
  });

  // =========================================================================
  // TEST 3: Same success webhook arrives three times
  // =========================================================================
  it('TEST 3: Same success webhook arrives three times -> Treasury increases only once', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    // Initiate funding
    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const providerTxId = initResult.transaction.providerTransactionId!;

    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      id: 'evt_dup_webhook_001',
      payload: {
        payment: {
          entity: {
            id: providerTxId,
            amount: 10000,
            currency: 'INR',
            status: 'captured',
            acquirer_data: { rrn: 'RRN_TRIPLE_01' },
          },
        },
      },
    });

    const signature = signPayload(webhookPayload);

    // First Webhook Arrival
    const res1 = await FundingWorkflowService.handleProviderWebhook(webhookPayload, signature, 'RAZORPAYX');
    expect(res1.acknowledged).toBe(true);
    expect(res1.isCredited).toBe(true);

    // Second Webhook Arrival (Exact Duplicate)
    const res2 = await FundingWorkflowService.handleProviderWebhook(webhookPayload, signature, 'RAZORPAYX');
    expect(res2.acknowledged).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.isCredited).toBe(false);

    // Third Webhook Arrival (Exact Duplicate)
    const res3 = await FundingWorkflowService.handleProviderWebhook(webhookPayload, signature, 'RAZORPAYX');
    expect(res3.acknowledged).toBe(true);
    expect(res3.isDuplicate).toBe(true);
    expect(res3.isCredited).toBe(false);

    // Expected: Treasury increases only once (by ₹10,000, not ₹30,000)
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance + 10000);

    // Exactly one ledger credit created
    const ledgerCredits = Array.from(inMemoryTreasuryTx.values()).filter(
      (t) => t.referenceId === initResult.transaction.id
    );
    expect(ledgerCredits).toHaveLength(1);
  });

  // =========================================================================
  // TEST 4: Provider reports failure
  // =========================================================================
  it('TEST 4: Provider reports failure -> Treasury does NOT increase, Status = FAILED', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    // Provider reports failure
    mockProvider.seedStatus(providerTxId, {
      status: 'FAILED',
      amount: 10000,
      currency: 'INR',
      failureReason: 'Customer account has insufficient funds',
    });

    const result = await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId);

    // Expected: Treasury does not increase
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance);
    expect(result.isCredited).toBe(false);

    // Expected: Status = FAILED
    expect(result.transaction.status).toBe('FAILED');
    expect(result.transaction.failureReason).toContain('insufficient funds');

    // No ledger transaction created
    const ledgerCredits = Array.from(inMemoryTreasuryTx.values()).filter(
      (t) => t.referenceId === txId
    );
    expect(ledgerCredits).toHaveLength(0);
  });

  // =========================================================================
  // TEST 5: Provider reports amount ₹9,000 while request was ₹10,000
  // =========================================================================
  it('TEST 5: Provider reports amount ₹9,000 vs request ₹10,000 -> Status = RECONCILIATION_REQUIRED, No auto credit', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    // Provider settled ₹9,000 instead of ₹10,000
    mockProvider.seedStatus(providerTxId, {
      status: 'SUCCEEDED',
      amount: 9000,
      currency: 'INR',
      utrNumber: 'UTR_DISCREPANCY_9000',
    });

    // Run reconciliation check
    const reconResult = await FundingReconciliationService.reconcileFundingTransaction(txId, {
      adminId: TEST_ADMIN_ID,
    });

    // Expected: Do not automatically credit
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance);
    expect(reconResult.isMatched).toBe(false);

    // Expected: Status = RECONCILIATION_REQUIRED
    expect(reconResult.status).toBe('RECONCILIATION_REQUIRED');
    expect(reconResult.discrepancies.some((d) => d.type === 'AMOUNT_MISMATCH')).toBe(true);

    const updatedTx = inMemoryFundingTx.get(txId);
    expect(updatedTx.status).toBe('RECONCILIATION_REQUIRED');
    expect(updatedTx.failureReason).toContain('Amount mismatch detected');
  });

  // =========================================================================
  // TEST 6: Invalid webhook signature
  // =========================================================================
  it('TEST 6: Invalid webhook signature -> Reject with 401 Unauthorized, No financial change', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const payload = JSON.stringify({
      event: 'payment.captured',
      id: 'evt_forged_001',
      payload: {
        payment: {
          entity: {
            id: 'fund_forged_999',
            amount: 50000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    });

    const forgedSignature = 'deadbeefcafebabe0123456789abcdef0123456789abcdef0123456789abcdef';

    // Expected: Reject
    await expect(
      FundingWorkflowService.handleProviderWebhook(payload, forgedSignature, 'RAZORPAYX')
    ).rejects.toThrow('Invalid provider webhook cryptographic signature');

    // Expected: No financial change
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance);
    expect(inMemoryTreasuryTx.size).toBe(0);
  });

  // =========================================================================
  // TEST 7: Non-admin calls funding API
  // =========================================================================
  it('TEST 7: Non-admin calls funding API -> 403 Forbidden', async () => {
    // Attempt funding creation with regular distributor token
    const resCreate = await request(app)
      .post('/api/admin/funding')
      .set('Authorization', `Bearer ${distributorToken}`)
      .send({ amount: 10000 });

    expect(resCreate.status).toBe(403);
    expect(resCreate.body.success).toBe(false);

    // Attempt treasury balance view with regular distributor token
    const resTreasury = await request(app)
      .get('/api/admin/treasury')
      .set('Authorization', `Bearer ${distributorToken}`);

    expect(resTreasury.status).toBe(403);

    // Attempt reconciliation with regular distributor token
    const resRecon = await request(app)
      .post('/api/admin/funding/reconcile/period')
      .set('Authorization', `Bearer ${distributorToken}`)
      .send({ startDate: new Date(), endDate: new Date() });

    expect(resRecon.status).toBe(403);
  });

  // =========================================================================
  // TEST 8: Admin attempts negative amount
  // =========================================================================
  it('TEST 8: Admin attempts negative amount -> Validation failure (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/admin/funding')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: -5000,
        currency: 'INR',
        description: 'Negative funding attempt',
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // TEST 9: Admin attempts zero amount
  // =========================================================================
  it('TEST 9: Admin attempts zero amount -> Validation failure (400/422 Unprocessable)', async () => {
    const res = await request(app)
      .post('/api/admin/funding')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 0,
        currency: 'INR',
        description: 'Zero funding attempt',
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  // =========================================================================
  // TEST 10: Admin attempts excessively large amount beyond configured limit
  // =========================================================================
  it('TEST 10: Admin attempts excessively large amount beyond configured limit -> Validation failure', async () => {
    // Configured max limit is ₹10,000,000 (1 Crore). Admin attempts ₹50,000,000 (5 Crore).
    const excessivelyLargeAmount = 50_000_000;

    const res = await request(app)
      .post('/api/admin/funding')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: excessivelyLargeAmount,
        currency: 'INR',
        description: 'Excessive funding exceeding limit',
      });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);

    // Also verify via service directly throws AppError.badRequest
    await expect(
      FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
        amount: excessivelyLargeAmount,
        currency: 'INR',
      })
    ).rejects.toThrow('Funding amount exceeds maximum configured limit');
  });

  // =========================================================================
  // TEST 11: Same provider transaction ID processed twice
  // =========================================================================
  it('TEST 11: Same provider transaction ID processed twice -> One treasury credit only', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    mockProvider.seedStatus(providerTxId, {
      status: 'SUCCEEDED',
      amount: 10000,
      currency: 'INR',
    });

    // First Processing
    const firstProcess = await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId);
    expect(firstProcess.isCredited).toBe(true);
    expect((await PlatformTreasuryService.getTreasuryBalance()).availableBalance).toBe(initialBalance + 10000);

    // Second Processing (Exact same transaction ID)
    const secondProcess = await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId);
    expect(secondProcess.isCredited).toBe(false);
    expect(secondProcess.message).toContain('already been verified and credited');

    // Expected: One treasury credit total
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance + 10000);

    const credits = Array.from(inMemoryTreasuryTx.values()).filter((t) => t.referenceId === txId);
    expect(credits).toHaveLength(1);
  });

  // =========================================================================
  // TEST 12: Funding reversal
  // =========================================================================
  it('TEST 12: Funding reversal -> Original transaction remains immutable, Reversal transaction is created', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    // Settle a ₹10,000 funding transaction
    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    mockProvider.seedStatus(providerTxId, { status: 'SUCCEEDED', amount: 10000, currency: 'INR' });
    await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId);

    const balanceAfterCredit = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(balanceAfterCredit).toBe(initialBalance + 10000);

    // Execute Reversal
    const reversalResult = await FundingWorkflowService.processFundingReversal(
      TEST_ADMIN_ID,
      txId,
      'Authorized chargeback notice received from banking partner'
    );

    // Expected: Original funding transaction transitions to REVERSED
    expect(reversalResult.transaction.status).toBe('REVERSED');

    // Expected: Reversal transaction is created in ledger (FUNDING_REVERSAL)
    const reversalLedgerTx = Array.from(inMemoryTreasuryTx.values()).find(
      (t) => t.type === 'FUNDING_REVERSAL' && t.referenceId === txId
    );
    expect(reversalLedgerTx).toBeDefined();
    expect(reversalLedgerTx?.amount.toNumber()).toBe(10000);

    // Expected: Original credit ledger entry remains intact (immutable append-only history)
    const originalCreditLedgerTx = Array.from(inMemoryTreasuryTx.values()).find(
      (t) => t.type === 'FUNDING' && t.referenceId === txId
    );
    expect(originalCreditLedgerTx).toBeDefined();

    // Expected: Treasury balance returns to initial
    const balanceAfterReversal = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(balanceAfterReversal).toBe(initialBalance);
  });

  // =========================================================================
  // TEST 13: Database failure during treasury credit
  // =========================================================================
  it('TEST 13: Database failure during treasury credit -> Entire transaction rolls back', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    mockProvider.seedStatus(providerTxId, { status: 'SUCCEEDED', amount: 10000, currency: 'INR' });

    // Simulate database failure during atomic credit
    vi.spyOn(PlatformTreasuryService, 'creditTreasury').mockRejectedValueOnce(
      new Error('Prisma database connection timeout during atomic write')
    );

    await expect(
      FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId)
    ).rejects.toThrow('Prisma database connection timeout');

    // Expected: Entire transaction rolls back
    // Transaction status does NOT become SUCCEEDED; remains PENDING
    const txInDb = inMemoryFundingTx.get(txId);
    expect(txInDb.status).toBe('PENDING');

    // Treasury balance does NOT increase
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance);

    // No ledger transaction persisted
    const ledgerCredits = Array.from(inMemoryTreasuryTx.values()).filter((t) => t.referenceId === txId);
    expect(ledgerCredits).toHaveLength(0);
  });

  // =========================================================================
  // TEST 14: Concurrent duplicate funding processing
  // =========================================================================
  it('TEST 14: Concurrent duplicate funding processing -> One credit only', async () => {
    const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    mockProvider.seedStatus(providerTxId, { status: 'SUCCEEDED', amount: 10000, currency: 'INR' });

    // Concurrently trigger two verification requests
    const [resultA, resultB] = await Promise.all([
      FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId),
      FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId),
    ]);

    // Exactly one must have credited
    const creditedCount = [resultA.isCredited, resultB.isCredited].filter(Boolean).length;
    expect(creditedCount).toBe(1);

    // Treasury balance increases exactly once
    const finalBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
    expect(finalBalance).toBe(initialBalance + 10000);

    // Exactly one ledger credit created
    const ledgerCredits = Array.from(inMemoryTreasuryTx.values()).filter(
      (t) => t.referenceId === txId && t.type === 'FUNDING'
    );
    expect(ledgerCredits).toHaveLength(1);
  });

  // =========================================================================
  // TEST 15: Audit log
  // =========================================================================
  it('TEST 15: Audit log -> Every financial admin action generates an audit record', async () => {
    // 1. Funding Initiation Action
    const initResult = await FundingWorkflowService.initiateFunding(TEST_ADMIN_ID, {
      amount: 10000,
      currency: 'INR',
      description: 'Audit Compliance Float Inflow',
    });
    const txId = initResult.transaction.id;
    const providerTxId = initResult.transaction.providerTransactionId!;

    const initAudit = inMemoryAuditLogs.find(
      (l) => l.action === 'FUNDING_TRANSACTION_INITIATED' && l.entityId === txId
    );
    expect(initAudit).toBeDefined();
    expect(initAudit.userId).toBe(TEST_ADMIN_ID);
    expect(initAudit.newData.amount).toBe(10000);

    // 2. Settlement Action
    mockProvider.seedStatus(providerTxId, { status: 'SUCCEEDED', amount: 10000, currency: 'INR' });
    await FundingWorkflowService.verifyAndProcessFunding(TEST_ADMIN_ID, txId);

    const settleAudit = inMemoryAuditLogs.find(
      (l) => l.action === 'FUNDING_TRANSACTION_SUCCEEDED' && l.entityId === txId
    );
    expect(settleAudit).toBeDefined();
    expect(settleAudit.userId).toBe(TEST_ADMIN_ID);

    // 3. Reversal Action
    await FundingWorkflowService.processFundingReversal(TEST_ADMIN_ID, txId, 'Audit verified chargeback');
    const reversalAudit = inMemoryAuditLogs.find(
      (l) => l.action === 'FUNDING_TRANSACTION_REVERSED' && l.entityId === txId
    );
    expect(reversalAudit).toBeDefined();
    expect(reversalAudit.userId).toBe(TEST_ADMIN_ID);
    expect(reversalAudit.newData.reason).toContain('Audit verified chargeback');

    // 4. Administrative Adjustment Action
    await PlatformTreasuryService.adjustTreasury({
      adminId: TEST_ADMIN_ID,
      type: 'CREDIT',
      amount: 5000,
      reason: 'Quarterly interest deposit credit verified',
    });
    const adjustAudit = inMemoryAuditLogs.find(
      (l) => l.action === 'PLATFORM_TREASURY_CREDIT_ADJUSTMENT'
    );
    expect(adjustAudit).toBeDefined();
    expect(adjustAudit.userId).toBe(TEST_ADMIN_ID);
    expect(adjustAudit.newData.reason).toContain('Quarterly interest deposit credit verified');
  });
});
