import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { FundingReconciliationService } from '../src/services/fundingReconciliation.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { FundingProviderFactory, MockFundingProvider } from '../src/providers/funding';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 40: BANK FUNDING RECONCILIATION TEST SUITE', () => {
  let inMemoryWallets: Map<string, any>;
  let inMemoryTreasuryTx: Map<string, any>;
  let inMemoryAccounts: Map<string, any>;
  let inMemoryFundingTx: Map<string, any>;
  let inMemoryAuditLogs: any[];

  const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
  const adminToken = createAdminToken({ id: TEST_ADMIN_ID });
  const memberToken = createTestToken({ role: 'DISTRIBUTOR' });

  let mockProvider: MockFundingProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    FundingProviderFactory.reset();

    inMemoryWallets = new Map();
    inMemoryTreasuryTx = new Map();
    inMemoryAccounts = new Map();
    inMemoryFundingTx = new Map();
    inMemoryAuditLogs = [];

    // Register Mock Provider
    mockProvider = new MockFundingProvider('test_secret');
    FundingProviderFactory.registerProvider('MOCK', mockProvider);
    FundingProviderFactory.registerProvider('RAZORPAYX', mockProvider);
    FundingProviderFactory.registerProvider('MOCK_SANDBOX', mockProvider);

    // Primary Treasury Wallet
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

    // Funding Account
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
      const newTx = {
        id: `pwtx-${Date.now()}-${Math.random()}`,
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
        id: `ftx-${Date.now()}-${Math.random()}`,
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

    // Mock $transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback(prisma);
    });
  });

  // Helper to create internal funding transaction in memory
  const createFundingTx = (data: Partial<any>): any => {
    const tx = {
      id: data.id || `ftx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fundingAccountId: 'fa-test-corporate-001',
      initiatedByAdminId: TEST_ADMIN_ID,
      amount: new Prisma.Decimal(data.amount ?? 50000),
      currency: data.currency || 'INR',
      status: data.status || 'PENDING',
      provider: data.provider || 'MOCK',
      providerTransactionId: data.providerTransactionId || `prov_tx_${Date.now()}`,
      idempotencyKey: data.idempotencyKey || `idemp_${Date.now()}`,
      platformWalletTransactionId: data.platformWalletTransactionId || null,
      failureReason: data.failureReason || null,
      metadata: data.metadata || {},
      initiatedAt: new Date(),
      completedAt: data.completedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    inMemoryFundingTx.set(tx.id, tx);
    return tx;
  };

  // =========================================================================
  // 1. SCENARIO 1: External success but internal pending
  // =========================================================================
  describe('Scenario 1: External success but internal pending (EXTERNAL_SUCCESS_INTERNAL_PENDING)', () => {
    it('should detect discrepancy, mark RECONCILIATION_REQUIRED, and NOT credit treasury', async () => {
      const tx = createFundingTx({
        amount: 25000,
        status: 'PENDING',
        providerTransactionId: 'prov_succ_int_pend_001',
      });

      // Provider confirms success
      mockProvider.seedStatus('prov_succ_int_pend_001', {
        status: 'SUCCEEDED',
        amount: 25000,
        currency: 'INR',
        utrNumber: 'UTR_EXT_PEND_01',
      });

      const initialTreasury = await PlatformTreasuryService.getTreasuryBalance();

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancies.some((d) => d.type === 'EXTERNAL_SUCCESS_INTERNAL_PENDING')).toBe(true);

      // Verify transaction status updated in DB
      const updatedTx = inMemoryFundingTx.get(tx.id);
      expect(updatedTx.status).toBe('RECONCILIATION_REQUIRED');

      // CRITICAL: Treasury MUST NOT be automatically credited!
      const finalTreasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(finalTreasury.availableBalance).toBe(initialTreasury.availableBalance);

      // Verify audit log
      const audit = inMemoryAuditLogs.find(
        (a) => a.action === 'FUNDING_RECONCILIATION_DISCREPANCY_DETECTED' && a.entityId === tx.id
      );
      expect(audit).toBeDefined();
    });
  });

  // =========================================================================
  // 2. SCENARIO 2: External success but no internal transaction
  // =========================================================================
  describe('Scenario 2: External success but no internal transaction (EXTERNAL_SUCCESS_NO_INTERNAL_TX)', () => {
    it('should detect external transaction with no internal record during period reconciliation', async () => {
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date(Date.now() + 3600000);

      // Add settled transaction to mock provider bank feed
      mockProvider.addExternalTransaction({
        providerTransactionId: 'orphan_bank_deposit_999',
        amount: 75000,
        currency: 'INR',
        status: 'SUCCEEDED',
        utrNumber: 'UTR_ORPHAN_999',
        settledAt: new Date(),
      });

      const periodResult = await FundingReconciliationService.reconcileFundingPeriod(startDate, endDate, {
        provider: 'MOCK',
        adminId: TEST_ADMIN_ID,
      });

      expect(periodResult.discrepancyCount).toBeGreaterThanOrEqual(1);
      const orphanDiscrepancy = periodResult.discrepancies.find(
        (d) => d.discrepancy.type === 'EXTERNAL_SUCCESS_NO_INTERNAL_TX'
      );
      expect(orphanDiscrepancy).toBeDefined();
      expect(orphanDiscrepancy?.providerTransactionId).toBe('orphan_bank_deposit_999');

      // Verify an orphan transaction was registered with RECONCILIATION_REQUIRED for admin review
      const orphanTx = Array.from(inMemoryFundingTx.values()).find(
        (t) => t.providerTransactionId === 'orphan_bank_deposit_999'
      );
      expect(orphanTx).toBeDefined();
      expect(orphanTx?.status).toBe('RECONCILIATION_REQUIRED');
    });
  });

  // =========================================================================
  // 3. SCENARIO 3: Internal success but external failure
  // =========================================================================
  describe('Scenario 3: Internal success but external failure (INTERNAL_SUCCESS_EXTERNAL_FAILURE)', () => {
    it('should detect discrepancy, mark RECONCILIATION_REQUIRED, and NOT automatically debit treasury', async () => {
      const tx = createFundingTx({
        amount: 30000,
        status: 'SUCCEEDED',
        providerTransactionId: 'prov_fail_int_succ_001',
      });

      // Internal ledger credit exists
      inMemoryTreasuryTx.set('pwx-succ-01', {
        id: 'pwx-succ-01',
        walletId: 'wallet-treasury-001',
        transactionNumber: 'PWX-TEST-001',
        type: 'FUNDING',
        amount: new Prisma.Decimal('30000.00'),
        referenceType: 'FUNDING_TRANSACTION',
        referenceId: tx.id,
        providerTransactionId: 'prov_fail_int_succ_001',
        status: 'COMPLETED',
        createdAt: new Date(),
      });

      // External provider reports failure
      mockProvider.seedStatus('prov_fail_int_succ_001', {
        status: 'FAILED',
        amount: 30000,
        currency: 'INR',
        failureReason: 'Customer bank rejected transfer',
      });

      const initialTreasury = await PlatformTreasuryService.getTreasuryBalance();

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancies.some((d) => d.type === 'INTERNAL_SUCCESS_EXTERNAL_FAILURE')).toBe(true);

      // Verify transaction marked RECONCILIATION_REQUIRED
      expect(inMemoryFundingTx.get(tx.id).status).toBe('RECONCILIATION_REQUIRED');

      // Treasury must NOT be automatically debited without admin verification
      const finalTreasury = await PlatformTreasuryService.getTreasuryBalance();
      expect(finalTreasury.availableBalance).toBe(initialTreasury.availableBalance);
    });
  });

  // =========================================================================
  // 4. SCENARIO 4: Amount mismatch
  // =========================================================================
  describe('Scenario 4: Amount mismatch (AMOUNT_MISMATCH)', () => {
    it('should detect when external amount does not equal internal transaction amount', async () => {
      const tx = createFundingTx({
        amount: 50000,
        status: 'PENDING',
        providerTransactionId: 'prov_amount_mismatch_001',
      });

      // Provider settled different amount (e.g., 45000 instead of 50000)
      mockProvider.seedStatus('prov_amount_mismatch_001', {
        status: 'SUCCEEDED',
        amount: 45000,
        currency: 'INR',
      });

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancies.some((d) => d.type === 'AMOUNT_MISMATCH')).toBe(true);
    });
  });

  // =========================================================================
  // 5. SCENARIO 5: Currency mismatch
  // =========================================================================
  describe('Scenario 5: Currency mismatch (CURRENCY_MISMATCH)', () => {
    it('should detect when external currency does not match internal currency', async () => {
      const tx = createFundingTx({
        amount: 10000,
        currency: 'INR',
        status: 'PENDING',
        providerTransactionId: 'prov_currency_mismatch_001',
      });

      // Provider settled in USD
      mockProvider.seedStatus('prov_currency_mismatch_001', {
        status: 'SUCCEEDED',
        amount: 10000,
        currency: 'USD',
      });

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancies.some((d) => d.type === 'CURRENCY_MISMATCH')).toBe(true);
    });
  });

  // =========================================================================
  // 6. SCENARIO 6: Duplicate provider transaction
  // =========================================================================
  describe('Scenario 6: Duplicate provider transaction (DUPLICATE_PROVIDER_TRANSACTION)', () => {
    it('should detect when the same external provider transaction is tied to multiple internal records', async () => {
      const duplicateProviderId = 'prov_dup_tx_777';

      const tx1 = createFundingTx({
        id: 'ftx-dup-1',
        amount: 20000,
        status: 'SUCCEEDED',
        providerTransactionId: duplicateProviderId,
      });

      const tx2 = createFundingTx({
        id: 'ftx-dup-2',
        amount: 20000,
        status: 'PENDING',
        providerTransactionId: duplicateProviderId,
      });

      mockProvider.seedStatus(duplicateProviderId, {
        status: 'SUCCEEDED',
        amount: 20000,
        currency: 'INR',
      });

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx1.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancies.some((d) => d.type === 'DUPLICATE_PROVIDER_TRANSACTION')).toBe(true);
    });
  });

  // =========================================================================
  // 7. SCENARIO 7: Reversal not reflected internally
  // =========================================================================
  describe('Scenario 7: Reversal not reflected internally (REVERSAL_NOT_REFLECTED_INTERNALLY)', () => {
    it('should detect when provider reported REVERSED but internal record is SUCCEEDED without ledger reversal', async () => {
      const tx = createFundingTx({
        amount: 60000,
        status: 'SUCCEEDED',
        providerTransactionId: 'prov_rev_unreflected_001',
      });

      // Credit ledger exists
      inMemoryTreasuryTx.set('pwx-credit-60k', {
        id: 'pwx-credit-60k',
        walletId: 'wallet-treasury-001',
        transactionNumber: 'PWX-REV-001',
        type: 'FUNDING',
        amount: new Prisma.Decimal('60000.00'),
        referenceType: 'FUNDING_TRANSACTION',
        referenceId: tx.id,
        providerTransactionId: 'prov_rev_unreflected_001',
        status: 'COMPLETED',
        createdAt: new Date(),
      });

      // Provider reports REVERSED
      mockProvider.seedStatus('prov_rev_unreflected_001', {
        status: 'REVERSED',
        amount: 60000,
        currency: 'INR',
      });

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('RECONCILIATION_REQUIRED');
      expect(result.discrepancies.some((d) => d.type === 'REVERSAL_NOT_REFLECTED_INTERNALLY')).toBe(true);
    });
  });

  // =========================================================================
  // 8. PERFECT MATCH: All 3 Layers Match
  // =========================================================================
  describe('8. Perfect 3-Way Match Across All Layers', () => {
    it('should confirm full match when external provider, funding tx, and platform ledger align perfectly', async () => {
      const tx = createFundingTx({
        amount: 50000,
        status: 'SUCCEEDED',
        providerTransactionId: 'prov_perfect_match_001',
      });

      // Matching ledger credit
      inMemoryTreasuryTx.set('pwx-match-01', {
        id: 'pwx-match-01',
        walletId: 'wallet-treasury-001',
        transactionNumber: 'PWX-MATCH-001',
        type: 'FUNDING',
        amount: new Prisma.Decimal('50000.00'),
        referenceType: 'FUNDING_TRANSACTION',
        referenceId: tx.id,
        providerTransactionId: 'prov_perfect_match_001',
        status: 'COMPLETED',
        createdAt: new Date(),
      });

      // Provider confirms matching success
      mockProvider.seedStatus('prov_perfect_match_001', {
        status: 'SUCCEEDED',
        amount: 50000,
        currency: 'INR',
        utrNumber: 'UTR_PERFECT_001',
      });

      const result = await FundingReconciliationService.reconcileFundingTransaction(tx.id, {
        adminId: TEST_ADMIN_ID,
      });

      expect(result.isMatched).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
      expect(result.ledgerMatched).toBe(true);

      // Audit log check
      const audit = inMemoryAuditLogs.find(
        (a) => a.action === 'FUNDING_RECONCILIATION_CHECK_PASSED' && a.entityId === tx.id
      );
      expect(audit).toBeDefined();
    });
  });

  // =========================================================================
  // 9. ADMIN DISCREPANCY REVIEW & RESOLUTION WORKFLOW
  // =========================================================================
  describe('9. Admin Discrepancy Review & Resolution Workflow', () => {
    it('should list all discrepancies for admin review via getDiscrepancies()', async () => {
      createFundingTx({
        status: 'RECONCILIATION_REQUIRED',
        failureReason: 'Amount mismatch detected',
        metadata: {
          reconciliationDiscrepancies: [{ type: 'AMOUNT_MISMATCH', description: 'Mismatch of 5000' }],
        },
      });

      const res = await FundingReconciliationService.getDiscrepancies();
      expect(res.discrepancies.length).toBeGreaterThanOrEqual(1);
      expect(res.discrepancies[0].status).toBe('RECONCILIATION_REQUIRED');
      expect(res.discrepancies[0].discrepancyDetails).toBeDefined();
    });

    it('should allow admin to resolve discrepancy with FORCE_SETTLE_CREDIT and credit treasury', async () => {
      const tx = createFundingTx({
        amount: 40000,
        status: 'RECONCILIATION_REQUIRED',
        failureReason: 'External success but internal pending',
      });

      const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

      const resolution = await FundingReconciliationService.resolveDiscrepancy(
        tx.id,
        {
          action: 'FORCE_SETTLE_CREDIT',
          reason: 'Verified bank credit slip received from corporate banking manager',
          notes: 'Bank reference #HDFC998231',
        },
        TEST_ADMIN_ID
      );

      expect(resolution.actionTaken).toBe('FORCE_SETTLE_CREDIT');
      expect(resolution.transaction.status).toBe('SUCCEEDED');

      // Verify Treasury credited
      const newBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
      expect(newBalance).toBe(initialBalance + 40000);

      // Verify Audit Log
      const audit = inMemoryAuditLogs.find(
        (a) => a.action === 'FUNDING_DISCREPANCY_RESOLVED_FORCE_SETTLE_CREDIT' && a.entityId === tx.id
      );
      expect(audit).toBeDefined();
      expect(audit.newData.reason).toContain('Verified bank credit slip');
    });

    it('should allow admin to resolve discrepancy with REVERSE_DEBIT and debit treasury', async () => {
      const tx = createFundingTx({
        amount: 35000,
        status: 'RECONCILIATION_REQUIRED',
        failureReason: 'Reversal not reflected internally',
      });

      const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

      const resolution = await FundingReconciliationService.resolveDiscrepancy(
        tx.id,
        {
          action: 'REVERSE_DEBIT',
          reason: 'Confirmed chargeback notification from provider',
        },
        TEST_ADMIN_ID
      );

      expect(resolution.actionTaken).toBe('REVERSE_DEBIT');
      expect(resolution.transaction.status).toBe('REVERSED');

      // Verify Treasury debited
      const newBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
      expect(newBalance).toBe(initialBalance - 35000);
    });

    it('should allow admin to resolve discrepancy with MARK_FAILED without moving money', async () => {
      const tx = createFundingTx({
        amount: 15000,
        status: 'RECONCILIATION_REQUIRED',
      });

      const initialBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;

      const resolution = await FundingReconciliationService.resolveDiscrepancy(
        tx.id,
        {
          action: 'MARK_FAILED',
          reason: 'Abandoned payment by administrator',
        },
        TEST_ADMIN_ID
      );

      expect(resolution.actionTaken).toBe('MARK_FAILED');
      expect(resolution.transaction.status).toBe('FAILED');

      // Treasury remains untouched
      const newBalance = (await PlatformTreasuryService.getTreasuryBalance()).availableBalance;
      expect(newBalance).toBe(initialBalance);
    });

    it('should reject discrepancy resolution when reason is too short', async () => {
      const tx = createFundingTx({ status: 'RECONCILIATION_REQUIRED' });

      await expect(
        FundingReconciliationService.resolveDiscrepancy(
          tx.id,
          {
            action: 'MARK_FAILED',
            reason: 'no', // Too short
          },
          TEST_ADMIN_ID
        )
      ).rejects.toThrow('Resolution reason is required');
    });
  });

  // =========================================================================
  // 10. REST API ENDPOINTS & RBAC AUDIT
  // =========================================================================
  describe('10. REST API Endpoints & RBAC Security', () => {
    it('should block unauthenticated access to reconciliation endpoints (401)', async () => {
      const res = await request(app).post('/api/admin/funding/reconcile/period');
      expect(res.status).toBe(401);
    });

    it('should block regular members from executing reconciliation (403)', async () => {
      const res = await request(app)
        .post('/api/admin/funding/reconcile/period')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('should allow admin to trigger period reconciliation via POST /api/admin/funding/reconcile/period', async () => {
      const res = await request(app)
        .post('/api/admin/funding/reconcile/period')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString(),
          provider: 'MOCK',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.period).toBeDefined();
    });

    it('should allow admin to retrieve discrepancies via GET /api/admin/funding/discrepancies', async () => {
      createFundingTx({
        status: 'RECONCILIATION_REQUIRED',
        failureReason: 'Currency mismatch detected',
      });

      const res = await request(app)
        .get('/api/admin/funding/discrepancies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should allow admin to resolve discrepancy via POST /api/admin/funding/:id/reconcile/resolve', async () => {
      const tx = createFundingTx({
        status: 'RECONCILIATION_REQUIRED',
        amount: 12000,
      });

      const res = await request(app)
        .post(`/api/admin/funding/${tx.id}/reconcile/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'MARK_FAILED',
          reason: 'Payment timed out and was cancelled at provider',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.actionTaken).toBe('MARK_FAILED');
    });
  });
});
