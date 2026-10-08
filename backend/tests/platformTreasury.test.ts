import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { AppError } from '../src/utils/appError';

describe('PLATFORM TREASURY WALLET & LEDGER (PROMPT 30 TEST SUITE)', () => {
  let inMemoryWallets: Map<string, any>;
  let inMemoryTransactions: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    inMemoryWallets = new Map();
    inMemoryTransactions = new Map();

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
        ...args.data,
        updatedAt: new Date(),
      };
      inMemoryWallets.set(args.where.id, updated);
      return { ...updated };
    });

    // Mock platformWalletTransaction
    vi.spyOn(prisma.platformWalletTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.idempotencyKey) {
        for (const tx of inMemoryTransactions.values()) {
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
            for (const tx of inMemoryTransactions.values()) {
              if (tx.externalTransactionId === clause.externalTransactionId) return { ...tx };
            }
          }
          if (clause.providerTransactionId) {
            for (const tx of inMemoryTransactions.values()) {
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
      inMemoryTransactions.set(newTx.id, newTx);
      return { ...newTx };
    });

    vi.spyOn(prisma.platformWalletTransaction, 'count').mockImplementation(async (args: any) => {
      let count = 0;
      for (const tx of inMemoryTransactions.values()) {
        if (!args.where?.type || tx.type === args.where.type) {
          count++;
        }
      }
      return count;
    });

    vi.spyOn(prisma.platformWalletTransaction, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryTransactions.values());
      if (args.where?.type) {
        list = list.filter((t) => t.type === args.where.type);
      }
      return list;
    });

    // Mock prisma.$transaction to execute callback immediately
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock auditLog.create
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-1' } as any);
  });

  describe('1. Platform Treasury Balance Initialization & Lookup', () => {
    it('should initialize treasury wallet with 0.00 balance if not previously existing', async () => {
      const balance = await PlatformTreasuryService.getTreasuryBalance();

      expect(balance).toBeDefined();
      expect(balance.walletCode).toBe('PRIMARY_TREASURY');
      expect(balance.availableBalance).toBe(0);
      expect(balance.currency).toBe('INR');
      expect(balance.pendingBalance).toBe(0);
    });

    it('should return existing treasury balance when wallet already exists', async () => {
      // First call initializes
      await PlatformTreasuryService.getTreasuryBalance();
      // Second call returns existing
      const balance = await PlatformTreasuryService.getTreasuryBalance();

      expect(balance.availableBalance).toBe(0);
      expect(inMemoryWallets.size).toBe(1);
    });
  });

  describe('2. Inward Treasury Crediting (creditTreasury)', () => {
    it('should accurately credit treasury with precise decimal amount and create immutable ledger transaction', async () => {
      const result = await PlatformTreasuryService.creditTreasury({
        amount: 100000.5,
        type: 'FUNDING',
        referenceType: 'BANK_TRANSFER',
        referenceId: 'REQ-1001',
        externalTransactionId: 'UTR-HDFC-99887766',
        idempotencyKey: 'IDEMP-FUNDING-001',
        description: 'Initial corporate operating liquidity injection',
        performedById: 'admin-super-1',
      });

      expect(result.wallet.availableBalance).toBe(100000.5);
      expect(result.transaction.amount).toBe(100000.5);
      expect(result.transaction.balanceBefore).toBe(0);
      expect(result.transaction.balanceAfter).toBe(100000.5);
      expect(result.transaction.type).toBe('FUNDING');
      expect(result.transaction.externalTransactionId).toBe('UTR-HDFC-99887766');
      expect(result.transaction.status).toBe('COMPLETED');
      expect(result.transaction.transactionNumber).toMatch(/^PWX-/);
    });

    it('should chain sequential credits and update balanceBefore and balanceAfter accurately', async () => {
      await PlatformTreasuryService.creditTreasury({
        amount: 50000,
        referenceType: 'CAPITAL_SEED',
        description: 'First injection',
      });

      const second = await PlatformTreasuryService.creditTreasury({
        amount: 25000.75,
        referenceType: 'CAPITAL_SEED_2',
        description: 'Second injection',
      });

      expect(second.transaction.balanceBefore).toBe(50000);
      expect(second.transaction.balanceAfter).toBe(75000.75);
      expect(second.wallet.availableBalance).toBe(75000.75);
    });

    it('should reject non-positive credit amounts with badRequest error', async () => {
      await expect(
        PlatformTreasuryService.creditTreasury({
          amount: 0,
          referenceType: 'INVALID',
          description: 'Zero credit',
        })
      ).rejects.toThrow(AppError);

      await expect(
        PlatformTreasuryService.creditTreasury({
          amount: -500,
          referenceType: 'INVALID',
          description: 'Negative credit',
        })
      ).rejects.toThrow(AppError);
    });

    it('should reject missing referenceType or description', async () => {
      await expect(
        PlatformTreasuryService.creditTreasury({
          amount: 1000,
          referenceType: '',
          description: 'Test description',
        })
      ).rejects.toThrow('referenceType is required');

      await expect(
        PlatformTreasuryService.creditTreasury({
          amount: 1000,
          referenceType: 'FUNDING',
          description: '',
        })
      ).rejects.toThrow('description is required');
    });

    it('should prevent duplicate credit with the same idempotencyKey (throw 409 conflict)', async () => {
      await PlatformTreasuryService.creditTreasury({
        amount: 20000,
        referenceType: 'GATEWAY_PAYMENT',
        idempotencyKey: 'IDEMP-UNIQUE-12345',
        description: 'First attempt',
      });

      await expect(
        PlatformTreasuryService.creditTreasury({
          amount: 20000,
          referenceType: 'GATEWAY_PAYMENT',
          idempotencyKey: 'IDEMP-UNIQUE-12345',
          description: 'Replay attempt',
        })
      ).rejects.toThrow('Duplicate treasury transaction: idempotencyKey');
    });

    it('should prevent duplicate funding with the same providerTransactionId (throw 409 conflict)', async () => {
      await PlatformTreasuryService.creditTreasury({
        amount: 30000,
        referenceType: 'RAZORPAYX_TOPUP',
        providerTransactionId: 'pay_rzp_999888111',
        description: 'Gateway credit',
      });

      await expect(
        PlatformTreasuryService.creditTreasury({
          amount: 30000,
          referenceType: 'RAZORPAYX_TOPUP',
          providerTransactionId: 'pay_rzp_999888111',
          description: 'Duplicate webhook or retry attempt',
        })
      ).rejects.toThrow('Duplicate funding transaction detected: provider transaction');
    });
  });

  describe('3. Outward Treasury Debiting (debitTreasury)', () => {
    beforeEach(async () => {
      // Seed wallet with 100,000 INR
      await PlatformTreasuryService.creditTreasury({
        amount: 100000,
        referenceType: 'SEED',
        description: 'Seed liquidity',
      });
    });

    it('should successfully debit treasury and record immutable PAYOUT transaction', async () => {
      const result = await PlatformTreasuryService.debitTreasury({
        amount: 35000,
        type: 'PAYOUT',
        referenceType: 'DISTRIBUTOR_PAYOUT_BATCH',
        referenceId: 'BATCH-20261008-01',
        description: 'Batch distributor payout disbursement',
        performedById: 'admin-super-1',
      });

      expect(result.wallet.availableBalance).toBe(65000);
      expect(result.transaction.amount).toBe(35000);
      expect(result.transaction.balanceBefore).toBe(100000);
      expect(result.transaction.balanceAfter).toBe(65000);
      expect(result.transaction.type).toBe('PAYOUT');
    });

    it('should block overdraft when debit exceeds available balance', async () => {
      await expect(
        PlatformTreasuryService.debitTreasury({
          amount: 150000, // Available is only 100,000
          referenceType: 'PAYOUT_BATCH',
          description: 'Excessive payout',
        })
      ).rejects.toThrow('Insufficient treasury liquidity');
    });

    it('should permit overdraft when allowOverdraft is explicitly set to true', async () => {
      const result = await PlatformTreasuryService.debitTreasury({
        amount: 150000,
        referenceType: 'SPECIAL_EMERGENCY_SETTLEMENT',
        description: 'Authorized overdraft reconciliation',
        allowOverdraft: true,
      });

      expect(result.wallet.availableBalance).toBe(-50000);
      expect(result.transaction.balanceAfter).toBe(-50000);
    });

    it('should reject non-positive debit amounts', async () => {
      await expect(
        PlatformTreasuryService.debitTreasury({
          amount: -100,
          referenceType: 'TEST',
          description: 'Negative debit',
        })
      ).rejects.toThrow('Debit amount must be greater than zero');
    });

    it('should reject duplicate debit with same idempotencyKey', async () => {
      await PlatformTreasuryService.debitTreasury({
        amount: 5000,
        referenceType: 'PAYOUT',
        idempotencyKey: 'DEBIT-IDEMP-999',
        description: 'First debit',
      });

      await expect(
        PlatformTreasuryService.debitTreasury({
          amount: 5000,
          referenceType: 'PAYOUT',
          idempotencyKey: 'DEBIT-IDEMP-999',
          description: 'Second duplicate debit',
        })
      ).rejects.toThrow('Duplicate treasury transaction: idempotencyKey');
    });
  });

  describe('4. Transaction History & Filtering (getTreasuryTransactions)', () => {
    it('should return paginated transaction history filtered by type', async () => {
      await PlatformTreasuryService.creditTreasury({
        amount: 50000,
        type: 'FUNDING',
        referenceType: 'SEED',
        description: 'Funding 1',
      });

      await PlatformTreasuryService.debitTreasury({
        amount: 10000,
        type: 'PAYOUT',
        referenceType: 'PAYOUT',
        description: 'Payout 1',
      });

      const fundingResults = await PlatformTreasuryService.getTreasuryTransactions({
        type: 'FUNDING',
      });

      expect(fundingResults.transactions.length).toBe(1);
      expect(fundingResults.transactions[0].type).toBe('FUNDING');
    });
  });

  describe('5. Authoritative Treasury Reconciliation (reconcileTreasury)', () => {
    it('should report isBalanced = true and 0 discrepancy for a clean transaction sequence', async () => {
      await PlatformTreasuryService.creditTreasury({
        amount: 100000,
        type: 'FUNDING',
        referenceType: 'BANK',
        description: 'Credit 1',
      });

      await PlatformTreasuryService.debitTreasury({
        amount: 25000,
        type: 'PAYOUT',
        referenceType: 'BATCH',
        description: 'Debit 1',
      });

      const report = await PlatformTreasuryService.reconcileTreasury();

      expect(report.isBalanced).toBe(true);
      expect(report.discrepancy).toBe(0);
      expect(report.currentBalance).toBe(75000);
      expect(report.calculatedLedgerBalance).toBe(75000);
      expect(report.totalCredits).toBe(100000);
      expect(report.totalDebits).toBe(25000);
      expect(report.discrepancies.length).toBe(0);
    });

    it('should flag discrepancy if wallet balance diverges from ledger entries', async () => {
      await PlatformTreasuryService.creditTreasury({
        amount: 50000,
        type: 'FUNDING',
        referenceType: 'BANK',
        description: 'Credit',
      });

      // Simulate an unbacked mutation on the wallet directly without a transaction
      const wallet = inMemoryWallets.values().next().value;
      wallet.availableBalance = new Prisma.Decimal(60000); // 10,000 phantom drift

      const report = await PlatformTreasuryService.reconcileTreasury();

      expect(report.isBalanced).toBe(false);
      expect(report.discrepancy).toBe(10000);
      expect(report.discrepancies.length).toBeGreaterThan(0);
      expect(report.discrepancies[0].type).toBe('BALANCE_MISMATCH');
    });
  });
});
