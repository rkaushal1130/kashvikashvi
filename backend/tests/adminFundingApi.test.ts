/**
 * Test Suite: Admin Funding & Treasury REST APIs (Prompt 34)
 * Uses Vitest & Supertest
 *
 * Covers:
 * 1.  GET  /api/admin/funding/accounts
 * 2.  POST /api/admin/funding/accounts/connect
 * 3.  POST /api/admin/funding/accounts/:id/disconnect
 * 4.  GET  /api/admin/funding/accounts/:id/status
 * 5.  POST /api/admin/funding (Validates amount, creates PENDING tx, NEVER credits treasury immediately)
 * 6.  GET  /api/admin/funding/:id
 * 7.  GET  /api/admin/funding (Filterable by status, date range, amount, provider, txId, admin)
 * 8.  GET  /api/admin/treasury
 * 9.  GET  /api/admin/treasury/transactions
 * 10. POST /api/admin/funding/:id/reconcile
 * 11. Security Guards: Block direct balance mutation & reject non-admin access (401/403)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { FundingService } from '../src/services/funding.service';
import { FundingWorkflowService } from '../src/services/fundingWorkflow.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 34: SECURE ADMIN FUNDING & TREASURY REST APIs', () => {
  const adminToken = createAdminToken();
  const memberToken = createTestToken({ role: 'DISTRIBUTOR' });

  const mockAccountId = '00000000-0000-0000-0000-000000000010';
  const mockTransactionId = '00000000-0000-0000-0000-000000000020';

  const mockAccount = {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTransaction = {
    id: mockTransactionId,
    fundingAccountId: mockAccountId,
    initiatedByAdminId: 'usr-admin-001',
    amount: 100000,
    currency: 'INR',
    status: 'PENDING',
    provider: 'RAZORPAYX',
    providerTransactionId: 'fund_rzpx_123456',
    idempotencyKey: 'FDR_IDEMP_TEST_001',
    platformWalletTransactionId: null,
    failureReason: null,
    metadata: {
      virtualAccount: {
        accountNumber: 'KASHVIMLM001',
        ifsc: 'HDFC0000060',
      },
    },
    initiatedAt: new Date().toISOString(),
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fundingAccount: mockAccount,
    initiatedByAdmin: {
      id: 'usr-admin-001',
      email: 'admin@kashvimlm.com',
      fullName: 'Super Admin',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. RBAC & Member Access Protection', () => {
    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/funding/accounts');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject regular distributor access with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/funding/accounts')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block non-admins from creating funding requests with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/funding')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ amount: 100000, currency: 'INR' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Get Funding Accounts (GET /api/admin/funding/accounts)', () => {
    it('should return list of corporate funding accounts for authorized admin', async () => {
      vi.spyOn(FundingService, 'listFundingAccounts').mockResolvedValue([mockAccount as any]);

      const res = await request(app)
        .get('/api/admin/funding/accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].accountName).toBe('Kashvi Corporate Operating Current Account');
    });
  });

  describe('3. Connect Funding Account (POST /api/admin/funding/accounts/connect)', () => {
    it('should connect corporate account successfully without accepting banking PIN/passwords', async () => {
      vi.spyOn(FundingService, 'registerFundingAccount').mockResolvedValue(mockAccount as any);

      const res = await request(app)
        .post('/api/admin/funding/accounts/connect')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'RAZORPAYX',
          providerAccountId: 'acc_rzpx_corp_001',
          accountType: 'CURRENT',
          accountName: 'Kashvi Corporate Operating Current Account',
          maskedAccountNumber: 'XXXXXXXX8921',
          currency: 'INR',
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockAccountId);
      expect(res.body.data.maskedAccountNumber).toBe('XXXXXXXX8921');
    });

    it('should reject connection request with missing required parameters', async () => {
      const res = await request(app)
        .post('/api/admin/funding/accounts/connect')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'RAZORPAYX',
          // missing accountName and maskedAccountNumber
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Disconnect Funding Account (POST /api/admin/funding/accounts/:id/disconnect)', () => {
    it('should disconnect corporate account and update status to DISCONNECTED', async () => {
      const disconnectedAccount = {
        ...mockAccount,
        status: 'DISCONNECTED',
        isPrimary: false,
      };
      vi.spyOn(FundingService, 'disconnectFundingAccount').mockResolvedValue(disconnectedAccount as any);

      const res = await request(app)
        .post(`/api/admin/funding/accounts/${mockAccountId}/disconnect`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DISCONNECTED');
      expect(res.body.data.isPrimary).toBe(false);
    });
  });

  describe('5. Get Account Status (GET /api/admin/funding/accounts/:id/status)', () => {
    it('should retrieve real-time provider account status, balance, and KYC state', async () => {
      const statusResult = {
        account: mockAccount,
        providerStatus: {
          providerAccountId: 'acc_rzpx_corp_001',
          provider: 'RAZORPAYX',
          status: 'ACTIVE',
          currency: 'INR',
          currentBalance: 500000,
          isVerified: true,
          lastSyncedAt: new Date().toISOString(),
        },
      };
      vi.spyOn(FundingService, 'getFundingAccountStatus').mockResolvedValue(statusResult as any);

      const res = await request(app)
        .get(`/api/admin/funding/accounts/${mockAccountId}/status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providerStatus.status).toBe('ACTIVE');
      expect(res.body.data.providerStatus.currentBalance).toBe(500000);
      expect(res.body.data.providerStatus.isVerified).toBe(true);
    });
  });

  describe('6. Create Funding Request (POST /api/admin/funding)', () => {
    it('should validate amount, create PENDING transaction, and communicate with provider', async () => {
      const workflowResult = {
        transaction: mockTransaction,
        paymentLinkUrl: 'https://sandbox.bank-provider.com/checkout/fund_rzpx_123456',
        virtualAccountDetails: {
          accountNumber: 'KASHVIMLM001',
          ifsc: 'HDFC0000060',
        },
      };
      vi.spyOn(FundingWorkflowService, 'initiateFunding').mockResolvedValue(workflowResult as any);

      const res = await request(app)
        .post('/api/admin/funding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 100000,
          currency: 'INR',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.status).toBe('PENDING');
      expect(res.body.data.transaction.amount).toBe(100000);
      expect(res.body.data.virtualAccountDetails).toBeDefined();

      // INVARIANT CHECK: Status is strictly PENDING; never SUCCEEDED upon creation
      expect(res.body.data.transaction.status).not.toBe('SUCCEEDED');
      expect(res.body.data.transaction.platformWalletTransactionId).toBeNull();
    });

    it('should reject invalid non-positive or sub-minimum funding amounts', async () => {
      const res = await request(app)
        .post('/api/admin/funding')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 50, // Less than minimum 100 INR
          currency: 'INR',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('7. Get Funding Transaction (GET /api/admin/funding/:id)', () => {
    it('should retrieve single funding transaction details with provider metadata', async () => {
      vi.spyOn(FundingService, 'getFundingTransactionById').mockResolvedValue(mockTransaction as any);

      const res = await request(app)
        .get(`/api/admin/funding/${mockTransactionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockTransactionId);
      expect(res.body.data.providerTransactionId).toBe('fund_rzpx_123456');
      expect(res.body.data.amount).toBe(100000);
    });
  });

  describe('8. List Funding History (GET /api/admin/funding)', () => {
    it('should return paginated transactions filtered by status, provider, date range, amount, and admin', async () => {
      vi.spyOn(prisma.fundingTransaction, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.fundingTransaction, 'findMany').mockResolvedValue([mockTransaction as any]);

      const res = await request(app)
        .get('/api/admin/funding')
        .query({
          status: 'PENDING',
          provider: 'RAZORPAYX',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          minAmount: 50000,
          maxAmount: 200000,
          transactionId: 'fund_rzpx_123456',
          admin: 'admin@kashvimlm.com',
          page: 1,
          limit: 10,
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.page).toBe(1);
    });
  });

  describe('9. Get Treasury Balance (GET /api/admin/treasury)', () => {
    it('should return live platform treasury available and pending balances', async () => {
      const treasuryBalance = {
        id: 'wallet-001',
        walletCode: 'PRIMARY_TREASURY',
        currency: 'INR',
        availableBalance: 750000.5,
        pendingBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vi.spyOn(PlatformTreasuryService, 'getTreasuryBalance').mockResolvedValue(treasuryBalance as any);

      const res = await request(app)
        .get('/api/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.walletCode).toBe('PRIMARY_TREASURY');
      expect(res.body.data.availableBalance).toBe(750000.5);
      expect(res.body.data.currency).toBe('INR');
    });
  });

  describe('10. Get Treasury Transactions (GET /api/admin/treasury/transactions)', () => {
    it('should return paginated immutable platform treasury ledger transactions', async () => {
      const treasuryTxResult = {
        transactions: [
          {
            id: 'pwtx-101',
            walletId: 'wallet-001',
            transactionNumber: 'TXN-TREAS-00001',
            type: 'FUNDING',
            amount: 500000,
            balanceBefore: 0,
            balanceAfter: 500000,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };
      vi.spyOn(PlatformTreasuryService, 'getTreasuryTransactions').mockResolvedValue(treasuryTxResult as any);

      const res = await request(app)
        .get('/api/admin/treasury/transactions')
        .query({ type: 'FUNDING', page: 1, limit: 20 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('FUNDING');
      expect(res.body.data[0].amount).toBe(500000);
    });
  });

  describe('11. Reconcile Funding Transaction (POST /api/admin/funding/:id/reconcile)', () => {
    it('should reconcile transaction with provider and credit treasury upon confirmed settlement', async () => {
      const reconcileResult = {
        transaction: {
          ...mockTransaction,
          status: 'SUCCEEDED',
          platformWalletTransactionId: 'pwtx-101',
        },
        reconciliation: {
          isMatched: true,
          providerStatus: 'SUCCEEDED',
          expectedAmount: 100000,
          actualAmount: 100000,
          discrepancy: 0,
          utrNumber: 'HDFCN260998877',
        },
        isCredited: true,
        treasuryBalance: 100000,
        message: 'Funding transaction successfully reconciled and settled. Treasury credited.',
      };
      vi.spyOn(FundingWorkflowService, 'reconcileFundingTransaction').mockResolvedValue(reconcileResult as any);

      const res = await request(app)
        .post(`/api/admin/funding/${mockTransactionId}/reconcile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ utrNumber: 'HDFCN260998877' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCredited).toBe(true);
      expect(res.body.data.transaction.status).toBe('SUCCEEDED');
      expect(res.body.data.reconciliation.isMatched).toBe(true);
    });
  });

  describe('12. Security Guards: Block Arbitrary Direct Balance Mutations', () => {
    it('should strictly prohibit direct balance mutations with 403 Forbidden', async () => {
      const postRes = await request(app)
        .post('/api/admin/funding/balance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ availableBalance: 10000000 });
      expect(postRes.status).toBe(403);
      expect(postRes.body.success).toBe(false);

      const putRes = await request(app)
        .put('/api/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ availableBalance: 10000000 });
      expect(putRes.status).toBe(403);
      expect(putRes.body.success).toBe(false);
    });
  });
});
