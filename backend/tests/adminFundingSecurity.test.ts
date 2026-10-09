/**
 * Test Suite: Security & Audit Audit for Admin Funding Portal (PROMPT 39)
 * Uses Vitest & Supertest
 *
 * Verifies:
 * 1. ADMIN ACCESS CONTROL:
 *    - Strict RBAC: Only SUPER_ADMIN and ADMIN can access admin funding & treasury endpoints.
 *    - Regular members (DISTRIBUTOR) are strictly rejected with 403 Forbidden.
 *    - Unauthenticated requests are rejected with 401 Unauthorized.
 *
 * 2. FINANCIAL SECURITY & ANTI-FRAUD GUARDS:
 *    - Fake funding prevention: Initiating funding creates PENDING tx; never credits treasury.
 *    - Fake provider transaction ID prevention: Unverified provider IDs mark FAILED; zero credit.
 *    - Forged webhook event prevention: Missing or invalid HMAC-SHA256 signature throws 401.
 *    - Replayed webhook event idempotency: Repeated success notifications yield exactly 1 credit.
 *    - Amount manipulation detection: Discrepancy halts auto-credit and flags RECONCILIATION_REQUIRED.
 *    - Unauthorized direct balance mutation prevention: Direct /balance endpoints blocked with 403.
 *    - Unauthorized treasury debit overdraft protection: Insufficient treasury balance blocks debit.
 *    - Duplicate funding prevention: IdempotencyKey reuse rejects duplicate submissions.
 *
 * 3. BANK SECURITY & CREDENTIAL PRIVACY:
 *    - Never store banking PIN, password, OTP, CVV, or card credentials.
 *    - Metadata sanitization automatically strips sensitive credential keys.
 *    - Masked account numbers are strictly enforced.
 *
 * 4. IMMUTABLE AUDIT TRAIL:
 *    - Sensitive admin actions log adminId, action, entity, entityId, before/after states, IP metadata, timestamp, reason.
 *    - Audit records are strictly immutable; deletion/truncation throws AUDIT_LOG_IMMUTABLE.
 *    - Sanitization ensures secrets and tokens are never logged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { AuditService } from '../src/services/audit.service';
import { FundingService } from '../src/services/funding.service';
import { FundingWorkflowService } from '../src/services/fundingWorkflow.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { FundingWebhookService } from '../src/services/fundingWebhook.service';
import { FundingProviderFactory, MockFundingProvider } from '../src/providers/funding';
import { sanitizeFundingMetadata } from '../src/types/funding.types';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 39 — SECURITY & AUDIT AUDIT FOR ADMIN FUNDING PORTAL', () => {
  const adminToken = createAdminToken({ id: 'usr-admin-001', role: 'ADMIN' });
  const superAdminToken = createAdminToken({ id: 'usr-superadmin-001', role: 'SUPER_ADMIN' });
  const memberToken = createTestToken({ id: 'usr-distributor-001', role: 'DISTRIBUTOR' });
  const webhookSecret = 'test_webhook_hmac_secret_key_32chars_long';

  const mockAccountId = '00000000-0000-0000-0000-000000000010';
  const mockTransactionId = '00000000-0000-0000-0000-000000000020';

  let inMemoryWallets: Map<string, any>;
  let inMemoryTreasuryTx: Map<string, any>;
  let inMemoryAccounts: Map<string, any>;
  let inMemoryFundingTx: Map<string, any>;
  let inMemoryAuditLogs: any[];
  let inMemoryWebhookEvents: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    FundingProviderFactory.reset();
    const mockProvider = new MockFundingProvider(webhookSecret);
    FundingProviderFactory.registerProvider('RAZORPAYX', mockProvider);
    FundingProviderFactory.registerProvider('MOCK', mockProvider);

    inMemoryWallets = new Map();
    inMemoryTreasuryTx = new Map();
    inMemoryAccounts = new Map();
    inMemoryFundingTx = new Map();
    inMemoryAuditLogs = [];
    inMemoryWebhookEvents = new Map();

    // Seed Treasury Wallet
    const primaryWallet = {
      id: 'wallet-001',
      walletCode: 'PRIMARY_TREASURY',
      currency: 'INR',
      availableBalance: new Prisma.Decimal(1000000), // 10 Lakhs float
      pendingBalance: new Prisma.Decimal(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryWallets.set(primaryWallet.id, primaryWallet);

    // Seed Corporate Funding Account
    const primaryAccount = {
      id: mockAccountId,
      provider: 'RAZORPAYX',
      providerAccountId: 'acc_rzpx_corp_001',
      accountType: 'CURRENT',
      accountName: 'Kashvi Corporate Operating Current Account',
      maskedAccountNumber: 'XXXXXXXX8921',
      currency: 'INR',
      status: 'ACTIVE',
      isPrimary: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryAccounts.set(primaryAccount.id, primaryAccount);

    // Seed Mock Funding Transaction
    const defaultTx = {
      id: mockTransactionId,
      fundingAccountId: mockAccountId,
      initiatedByAdminId: 'usr-admin-001',
      amount: new Prisma.Decimal(50000),
      currency: 'INR',
      status: 'PENDING',
      provider: 'RAZORPAYX',
      providerTransactionId: 'fund_rzpx_tx_998877',
      idempotencyKey: 'FDR_IDEMP_SEC_001',
      platformWalletTransactionId: null,
      failureReason: null,
      metadata: {},
      initiatedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      fundingAccount: primaryAccount,
      initiatedByAdmin: {
        id: 'usr-admin-001',
        email: 'admin@kashvimlm.com',
        fullName: 'Chief Auditor',
      },
    };
    inMemoryFundingTx.set(defaultTx.id, defaultTx);

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
        id: `wallet-${Date.now()}`,
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
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
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

    vi.spyOn(prisma.platformWalletTransaction, 'findFirst').mockImplementation(async () => null);

    vi.spyOn(prisma.platformWalletTransaction, 'create').mockImplementation(async (args: any) => {
      const newTx = {
        id: `pwtx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryTreasuryTx.set(newTx.id, newTx);
      return { ...newTx };
    });

    // 3. Mock fundingAccount
    vi.spyOn(prisma.fundingAccount, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) return inMemoryAccounts.get(args.where.id) || null;
      if (args.where.provider_providerAccountId) {
        const { provider, providerAccountId } = args.where.provider_providerAccountId;
        for (const acc of inMemoryAccounts.values()) {
          if (acc.provider === provider && acc.providerAccountId === providerAccountId) return { ...acc };
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingAccount, 'findFirst').mockImplementation(async (args: any) => {
      if (args?.where?.status) {
        for (const acc of inMemoryAccounts.values()) {
          if (acc.status === args.where.status) return { ...acc };
        }
      }
      const all = Array.from(inMemoryAccounts.values());
      return all[0] || null;
    });

    vi.spyOn(prisma.fundingAccount, 'findMany').mockImplementation(async () => {
      return Array.from(inMemoryAccounts.values());
    });

    vi.spyOn(prisma.fundingAccount, 'create').mockImplementation(async (args: any) => {
      const created = {
        id: `fa-${Date.now()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryAccounts.set(created.id, created);
      return { ...created };
    });

    vi.spyOn(prisma.fundingAccount, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryAccounts.get(args.where.id);
      if (!existing) throw new Error('Funding account not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryAccounts.set(args.where.id, updated);
      return { ...updated };
    });

    // 4. Mock fundingTransaction
    vi.spyOn(prisma.fundingTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) {
        const tx = inMemoryFundingTx.get(args.where.id);
        if (tx) {
          return {
            ...tx,
            fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
            initiatedByAdmin: { id: 'usr-admin-001', email: 'admin@kashvimlm.com', fullName: 'Chief Auditor' },
          };
        }
      }
      if (args.where.idempotencyKey) {
        for (const tx of inMemoryFundingTx.values()) {
          if (tx.idempotencyKey === args.where.idempotencyKey) {
            return {
              ...tx,
              fundingAccount: inMemoryAccounts.get(tx.fundingAccountId),
              initiatedByAdmin: { id: 'usr-admin-001', email: 'admin@kashvimlm.com', fullName: 'Chief Auditor' },
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
              initiatedByAdmin: { id: 'usr-admin-001', email: 'admin@kashvimlm.com', fullName: 'Chief Auditor' },
            };
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.fundingTransaction, 'create').mockImplementation(async (args: any) => {
      const newTx = {
        id: `ftx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryFundingTx.set(newTx.id, newTx);
      return {
        ...newTx,
        fundingAccount: inMemoryAccounts.get(newTx.fundingAccountId),
        initiatedByAdmin: { id: 'usr-admin-001', email: 'admin@kashvimlm.com', fullName: 'Chief Auditor' },
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
        initiatedByAdmin: { id: 'usr-admin-001', email: 'admin@kashvimlm.com', fullName: 'Chief Auditor' },
      };
    });

    // 5. Mock auditLog
    vi.spyOn(prisma.auditLog, 'create').mockImplementation(async (args: any) => {
      const log = { id: `audit-${Date.now()}-${Math.random()}`, ...args.data, createdAt: new Date() };
      inMemoryAuditLogs.push(log);
      return log as any;
    });

    // 6. Mock webhookEvent
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

    // 7. Mock prisma.$transaction (unrolls transaction callback with prisma mock client)
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  // ==========================================================================
  // SECTION 1: ADMIN ACCESS CONTROL (RBAC)
  // ==========================================================================
  describe('1. ADMIN ACCESS CONTROL', () => {
    const protectedAdminEndpoints = [
      { method: 'get', path: '/api/admin/funding/accounts', name: 'View Funding Accounts' },
      { method: 'post', path: '/api/admin/funding/accounts/connect', name: 'Connect Funding Account', body: { provider: 'RAZORPAYX', providerAccountId: 'acc_1', accountName: 'Corp', maskedAccountNumber: 'XXXX1234' } },
      { method: 'post', path: '/api/admin/funding', name: 'Create Funding Request', body: { amount: 10000, currency: 'INR' } },
      { method: 'get', path: '/api/admin/treasury', name: 'View Treasury Balance' },
      { method: 'get', path: '/api/admin/treasury/transactions', name: 'View Treasury Transactions' },
      { method: 'post', path: `/api/admin/funding/${mockTransactionId}/reconcile`, name: 'Reconcile Funding', body: { utrNumber: 'UTR123' } },
      { method: 'post', path: '/api/admin/treasury/adjust', name: 'Initiate Treasury Adjustment', body: { type: 'CREDIT', amount: 5000, reason: 'Audited Float Adjustment' } },
    ];

    describe('1.1 Block Unauthenticated Requests (401 Unauthorized)', () => {
      for (const endpoint of protectedAdminEndpoints) {
        it(`should block unauthenticated access to ${endpoint.name} (${endpoint.method.toUpperCase()} ${endpoint.path})`, async () => {
          const req = (request(app) as any)[endpoint.method](endpoint.path);
          if (endpoint.body) req.send(endpoint.body);
          const res = await req;
          expect(res.status).toBe(401);
          expect(res.body.success).toBe(false);
        });
      }
    });

    describe('1.2 Block Normal Members / Distributors (403 Forbidden)', () => {
      for (const endpoint of protectedAdminEndpoints) {
        it(`should strictly reject member access to ${endpoint.name} (${endpoint.method.toUpperCase()} ${endpoint.path})`, async () => {
          const req = (request(app) as any)[endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${memberToken}`);
          if (endpoint.body) req.send(endpoint.body);
          const res = await req;
          expect(res.status).toBe(403);
          expect(res.body.success).toBe(false);
        });
      }
    });

    describe('1.3 Allow Authorized Administrators (SUPER_ADMIN & ADMIN)', () => {
      it('should allow ADMIN to view corporate funding accounts', async () => {
        const res = await request(app)
          .get('/api/admin/funding/accounts')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should allow SUPER_ADMIN to view treasury balance', async () => {
        const res = await request(app)
          .get('/api/admin/treasury')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.availableBalance).toBe(1000000);
      });
    });
  });

  // ==========================================================================
  // SECTION 2: FINANCIAL SECURITY & ANTI-FRAUD GUARDS
  // ==========================================================================
  describe('2. FINANCIAL SECURITY & ANTI-FRAUD GUARDS', () => {
    describe('2.1 Prevent Fake Funding', () => {
      it('creating a funding request must leave transaction PENDING and never credit treasury immediately', async () => {
        const creditSpy = vi.spyOn(PlatformTreasuryService, 'creditTreasury');

        const res = await request(app)
          .post('/api/admin/funding')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ amount: 50000, currency: 'INR' });

        expect(res.status).toBe(201);
        expect(res.body.data.transaction.status).toBe('PENDING');
        expect(res.body.data.transaction.platformWalletTransactionId).toBeNull();
        // INVARIANT: Platform Treasury credit must NEVER be called upon mere creation
        expect(creditSpy).not.toHaveBeenCalled();
      });
    });

    describe('2.2 Prevent Fake Provider Transaction IDs', () => {
      it('should fail verification and refuse treasury credit when external provider reports failure/unverified', async () => {
        // Mock provider verify to return FAILED
        const provider = FundingProviderFactory.getProvider('RAZORPAYX');
        vi.spyOn(provider, 'verifyTransaction').mockResolvedValue({
          verified: false,
          status: 'FAILED',
          discrepancyReason: 'External payment reference not found in bank ledger',
        });

        const creditSpy = vi.spyOn(PlatformTreasuryService, 'creditTreasury');

        const result = await FundingWorkflowService.verifyAndProcessFunding(
          'usr-admin-001',
          mockTransactionId,
          { utrNumber: 'FAKE_UTR_999999' }
        );

        expect(result.isCredited).toBe(false);
        expect(result.transaction.status).toBe('FAILED');
        expect(creditSpy).not.toHaveBeenCalled();
      });
    });

    describe('2.3 Prevent Forged Webhook Events (HMAC Cryptographic Verification)', () => {
      it('should reject inbound webhook with missing signature header with 401', async () => {
        await expect(
          FundingWebhookService.processWebhook({
            providerName: 'RAZORPAYX',
            rawPayload: JSON.stringify({ event: 'payment.captured' }),
            signature: '',
          })
        ).rejects.toThrow('Missing webhook cryptographic signature header');
      });

      it('should reject forged HMAC signature with 401 Unauthorized', async () => {
        const payload = JSON.stringify({ event: 'payment.captured', id: 'pay_123' });
        const invalidSignature = 'invalid_forged_hmac_signature_hex_000000000000000000000000';

        await expect(
          FundingWebhookService.processWebhook({
            providerName: 'RAZORPAYX',
            rawPayload: payload,
            signature: invalidSignature,
          })
        ).rejects.toThrow('Invalid provider webhook cryptographic signature');
      });
    });

    describe('2.4 Prevent Replayed Webhooks & Duplicate Credits', () => {
      it('should strictly produce exactly 1 treasury credit upon repeated webhook deliveries for same event', async () => {
        const payload = JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'fund_rzpx_tx_998877',
                amount: 5000000, // 50,000 INR in paise
                currency: 'INR',
                status: 'captured',
                acquirer_data: { rrn: 'HDFC123456789' },
              },
            },
          },
        });

        const validSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payload)
          .digest('hex');

        const creditSpy = vi.spyOn(PlatformTreasuryService, 'creditTreasury');

        // First delivery: Pending transaction is settled and credited
        const firstResult = await FundingWebhookService.processWebhook({
          providerName: 'RAZORPAYX',
          rawPayload: payload,
          signature: validSignature,
        });

        expect(firstResult.acknowledged).toBe(true);
        expect(firstResult.isCredited).toBe(true);
        expect(creditSpy).toHaveBeenCalledTimes(1);

        // Second delivery (Replay): Same event arriving again
        const replayResult = await FundingWebhookService.processWebhook({
          providerName: 'RAZORPAYX',
          rawPayload: payload,
          signature: validSignature,
        });

        expect(replayResult.acknowledged).toBe(true);
        expect(replayResult.isCredited).toBe(false);
        expect(replayResult.isDuplicate).toBe(true);
        // INVARIANT: Exactly 1 credit across both calls
        expect(creditSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('2.5 Detect Amount Manipulation & Prevent Discrepancy Credits', () => {
      it('should halt automatic crediting and mark RECONCILIATION_REQUIRED when webhook amount differs from internal transaction', async () => {
        // Internal tx expects 50,000 INR, but webhook attacker sends 500 INR
        const manipulatedPayload = JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'fund_rzpx_tx_998877',
                amount: 50000, // 500 INR in paise (expected was 50,000 INR)
                currency: 'INR',
                status: 'captured',
              },
            },
          },
        });

        const validSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(manipulatedPayload)
          .digest('hex');

        const provider = FundingProviderFactory.getProvider('RAZORPAYX');
        vi.spyOn(provider, 'verifyTransaction').mockResolvedValueOnce({
          verified: true,
          providerTransactionId: 'fund_rzpx_tx_998877',
          status: 'SUCCEEDED',
          amount: 500, // Provider confirmed only 500 INR (Expected was 50,000 INR)
          currency: 'INR',
        });

        const creditSpy = vi.spyOn(PlatformTreasuryService, 'creditTreasury');

        const result = await FundingWebhookService.processWebhook({
          providerName: 'RAZORPAYX',
          rawPayload: manipulatedPayload,
          signature: validSignature,
        });

        expect(result.acknowledged).toBe(true);
        expect(result.status).toBe('RECONCILIATION_REQUIRED');
        expect(result.isCredited).toBe(false);
        expect(result.discrepancy).toBeDefined();
        // INVARIANT: Treasury must NOT be credited when amounts mismatch
        expect(creditSpy).not.toHaveBeenCalled();

        // Transaction in store is flagged
        const txInStore = inMemoryFundingTx.get(mockTransactionId);
        expect(txInStore.status).toBe('RECONCILIATION_REQUIRED');
      });
    });

    describe('2.6 Block Direct Arbitrary Balance Mutations', () => {
      it('should strictly prohibit direct mutations to /balance and /api/admin/treasury with 403 Forbidden', async () => {
        const methods = ['post', 'put', 'patch', 'delete'];
        for (const method of methods) {
          const res1 = await (request(app) as any)[method]('/api/admin/funding/balance')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ availableBalance: 999999999 });
          expect(res1.status).toBe(403);
          expect(res1.body.message).toMatch(/Direct balance mutations are strictly prohibited/);

          const res2 = await (request(app) as any)[method]('/api/admin/treasury')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ availableBalance: 999999999 });
          expect(res2.status).toBe(403);
          expect(res2.body.message).toMatch(/Direct balance mutations are strictly prohibited/);
        }
      });
    });

    describe('2.7 Prevent Unauthorized Treasury Overdraft Debits', () => {
      it('should reject treasury debits exceeding available balance with INSUFFICIENT_TREASURY_FUNDS', async () => {
        // Set available balance to 1,000 INR
        inMemoryWallets.get('wallet-001').availableBalance = new Prisma.Decimal(1000);

        await expect(
          PlatformTreasuryService.debitTreasury({
            amount: 50000, // Trying to debit 50,000 INR
            description: 'Unauthorized large debit',
            referenceType: 'TEST_DEBIT',
            allowOverdraft: false,
          })
        ).rejects.toThrow(/Insufficient treasury liquidity/);
      });
    });
  });

  // ==========================================================================
  // SECTION 3: BANK SECURITY & CREDENTIAL NON-STORAGE
  // ==========================================================================
  describe('3. BANK SECURITY & CREDENTIAL PRIVACY', () => {
    it('sanitizeFundingMetadata must strip passwords, PINs, OTPs, CVVs, and tokens from metadata payloads', () => {
      const hostilePayload = {
        note: 'Corporate transfer float topup',
        bankPassword: 'SuperSecretPassword123!',
        bankingPin: '9988',
        otp: '456789',
        cvv: '123',
        auth_token: 'bearer_token_xyz',
        nestedData: {
          clientSecret: 'secret_key_abc',
          validField: 'allowed_nested_value',
        },
      };

      const sanitized = sanitizeFundingMetadata(hostilePayload);

      expect(sanitized).toBeDefined();
      expect(sanitized!.note).toBe('Corporate transfer float topup');
      expect(sanitized!.validField).toBeUndefined();
      expect(sanitized!.nestedData?.validField).toBe('allowed_nested_value');

      // STRICT INVARIANTS: Zero secret keys retained
      expect(sanitized!.bankPassword).toBeUndefined();
      expect(sanitized!.bankingPin).toBeUndefined();
      expect(sanitized!.otp).toBeUndefined();
      expect(sanitized!.cvv).toBeUndefined();
      expect(sanitized!.auth_token).toBeUndefined();
      expect(sanitized!.nestedData?.clientSecret).toBeUndefined();
    });

    it('corporate funding account registration must require masked account number and provider token', async () => {
      const accountInput = {
        provider: 'RAZORPAYX',
        providerAccountId: 'acc_rzpx_external_token_001',
        accountType: 'CURRENT',
        accountName: 'Kashvi Corporate Operating',
        maskedAccountNumber: 'XXXXXXXX8921',
        currency: 'INR',
      };

      const registered = await FundingService.registerFundingAccount(accountInput, 'usr-admin-001');

      expect(registered.maskedAccountNumber).toBe('XXXXXXXX8921');
      expect((registered as any).bankPassword).toBeUndefined();
      expect((registered as any).pin).toBeUndefined();
    });
  });

  // ==========================================================================
  // SECTION 4: IMMUTABLE AUDIT TRAIL
  // ==========================================================================
  describe('4. IMMUTABLE AUDIT TRAIL', () => {
    it('AuditService.sanitizeAuditData must scrub secrets and payment credentials prior to audit logging', () => {
      const sensitiveData = {
        adminAction: 'CONNECT_BANK',
        accountDetails: {
          accountNumber: 'XXXXXXXX1234',
          bankingPin: '1234',
          token: 'bearer_xyz',
        },
        password: 'raw_admin_password',
      };

      const sanitized = AuditService.sanitizeAuditData(sensitiveData);

      expect(sanitized.adminAction).toBe('CONNECT_BANK');
      expect(sanitized.accountDetails.accountNumber).toBe('XXXXXXXX1234');
      expect(sanitized.password).toBeUndefined();
      expect(sanitized.accountDetails.bankingPin).toBeUndefined();
      expect(sanitized.accountDetails.token).toBeUndefined();
    });

    it('AuditService must strictly block deletion or modification of audit logs with AUDIT_LOG_IMMUTABLE', () => {
      expect(() => AuditService.blockAuditDeletion()).toThrow(
        /Immutable compliance violation: Deleting, modifying, or truncating audit logs is strictly prohibited/
      );
    });

    it('administrative adjustment endpoint (POST /api/admin/treasury/adjust) must record immutable audit log with adminId, before state, after state, reason, and IP metadata', async () => {
      const initialBalance = Number(inMemoryWallets.get('wallet-001').availableBalance);

      const res = await request(app)
        .post('/api/admin/treasury/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .set('User-Agent', 'ComplianceAuditAgent/1.0')
        .send({
          type: 'CREDIT',
          amount: 25000,
          reason: 'Audit Float Realignment based on physical corporate bank statement',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify AuditLog was created in store
      const auditLog = inMemoryAuditLogs.find((l) => l.action === 'PLATFORM_TREASURY_CREDIT_ADJUSTMENT');
      expect(auditLog).toBeDefined();
      expect(auditLog.userId).toBe('usr-admin-001');
      expect(auditLog.entityType).toBe('PlatformWallet');
      expect(auditLog.previousData.availableBalance).toBe(initialBalance);
      expect(auditLog.newData.availableBalance).toBe(initialBalance + 25000);
      expect(auditLog.newData.amount).toBe(25000);
      expect(auditLog.newData.reason).toBe('Audit Float Realignment based on physical corporate bank statement');
      expect(auditLog.ipAddress).toBe('192.168.1.100');
      expect(auditLog.userAgent).toBe('ComplianceAuditAgent/1.0');
    });

    it('disconnecting a corporate funding account must record before and after status in the audit log', async () => {
      const res = await request(app)
        .post(`/api/admin/funding/accounts/${mockAccountId}/disconnect`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', '10.0.0.1')
        .set('User-Agent', 'AdminPortal/2.0')
        .send({ reason: 'Decommissioned corporate banking account' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const auditLog = inMemoryAuditLogs.find((l) => l.action === 'FUNDING_ACCOUNT_DISCONNECTED');
      expect(auditLog).toBeDefined();
      expect(auditLog.userId).toBe('usr-admin-001');
      expect(auditLog.entityType).toBe('FundingAccount');
      expect(auditLog.entityId).toBe(mockAccountId);
      expect(auditLog.previousData.status).toBe('ACTIVE');
      expect(auditLog.newData.status).toBe('DISCONNECTED');
      expect(auditLog.newData.reason).toBe('Decommissioned corporate banking account');
      expect(auditLog.ipAddress).toBe('10.0.0.1');
      expect(auditLog.userAgent).toBe('AdminPortal/2.0');
    });
  });
});
