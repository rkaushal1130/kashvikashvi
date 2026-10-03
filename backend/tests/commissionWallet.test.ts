/**
 * Automated Test Suite: Commission Wallet Integration (Prompt 20)
 *
 * Verifies:
 * 1. Safe Commission Crediting:
 *    - Atomically creates formal WalletTransaction containing all 8 mandated fields:
 *      memberId, amount, type = COMMISSION, commissionTransactionId, orderId,
 *      description, status, createdAt.
 *    - Derives and updates availableBalance and lifetimeEarned atomically.
 *    - Updates CommissionTransaction to PAID with link to wallet transaction.
 * 2. Status Lifecycle & Withdrawal Invariants:
 *    - PENDING commissions cannot be credited to available wallet balance.
 *    - REVERSED commissions cannot be credited to wallet balance.
 *    - CANCELLED commissions cannot be credited to wallet balance.
 *    - PENDING commissions cannot be withdrawn (enforced by validateWithdrawalEligibility).
 *    - REVERSED commissions cannot be withdrawn (enforced by validateWithdrawalEligibility).
 * 3. Duplicate Credit Prevention:
 *    - Calling creditCommissionToWallet on already PAID commission throws 400.
 *    - Calling creditCommissionToWallet on commission already linked to wallet throws 400.
 * 4. Reconciliation Engine (Commission Ledger vs Wallet Ledger):
 *    - Reconciled state: 0 discrepancies.
 *    - Detects UNPOSTED_COMMISSION (marked PAID in ledger, missing in wallet).
 *    - Detects DUPLICATE_WALLET_CREDIT (multiple wallet credits for same commission).
 *    - Detects AMOUNT_MISMATCH (commission ledger amount != wallet credit amount).
 *    - Detects RECIPIENT_MISMATCH (credited wallet belongs to different member).
 *    - Detects ORPHANED_WALLET_TRANSACTION (wallet credit without ledger entry).
 *    - Detects MISSING_REVERSAL_DEBIT (reversed commission without compensatory debit).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { CommissionWalletService } from '../src/services/commissionWallet.service';
import { AppError } from '../src/utils/appError';

describe('COMMISSION WALLET INTEGRATION ENGINE (PROMPT 20 TEST SUITE)', () => {
  let inMemoryDistributors: Map<string, any>;
  let inMemoryWallets: Map<string, any>;
  let inMemoryCommissionTx: Map<string, any>;
  let inMemoryWalletTx: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    inMemoryDistributors = new Map();
    inMemoryWallets = new Map();
    inMemoryCommissionTx = new Map();
    inMemoryWalletTx = new Map();

    // 1. Setup mock distributors
    inMemoryDistributors.set('dist-1', {
      id: 'dist-1',
      userId: 'user-1',
      distributorId: 'dist-1',
      distributorCode: 'DST-10001',
      firstName: 'Aarav',
      lastName: 'Patel',
      status: 'ACTIVE',
    });

    inMemoryDistributors.set('dist-2', {
      id: 'dist-2',
      userId: 'user-2',
      distributorId: 'dist-2',
      distributorCode: 'DST-10002',
      firstName: 'Bhavna',
      lastName: 'Shah',
      status: 'ACTIVE',
    });

    // 2. Setup mock wallets
    inMemoryWallets.set('dist-1', {
      id: 'wallet-dist-1',
      distributorId: 'dist-1',
      userId: 'user-1',
      availableBalance: new Prisma.Decimal(1000),
      pendingBalance: new Prisma.Decimal(0),
      lifetimeEarned: new Prisma.Decimal(1000),
      lifetimePaid: new Prisma.Decimal(0),
      currency: 'INR',
      isLocked: false,
    });

    // 3. Mock Prisma interactive transactions
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Mock row-level locking
    vi.spyOn(prisma, '$executeRawUnsafe').mockResolvedValue(1 as any);

    // Mock prisma.distributorProfile
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
      const orList = args.where?.OR || [];
      for (const cond of orList) {
        if (cond.id && inMemoryDistributors.has(cond.id)) return inMemoryDistributors.get(cond.id);
        if (cond.distributorId && inMemoryDistributors.has(cond.distributorId)) return inMemoryDistributors.get(cond.distributorId);
        if (cond.distributorCode) {
          for (const d of inMemoryDistributors.values()) {
            if (d.distributorCode === cond.distributorCode) return d;
          }
        }
      }
      return null;
    });

    // Mock prisma.wallet
    vi.spyOn(prisma.wallet, 'findFirst').mockImplementation(async (args: any) => {
      const orList = args.where?.OR || [];
      for (const cond of orList) {
        if (cond.distributorId && inMemoryWallets.has(cond.distributorId)) {
          return inMemoryWallets.get(cond.distributorId);
        }
        if (cond.userId) {
          for (const w of inMemoryWallets.values()) {
            if (w.userId === cond.userId) return w;
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.wallet, 'create').mockImplementation(async (args: any) => {
      const walletId = `wallet-${args.data.distributorId}`;
      const wallet = {
        id: walletId,
        distributorId: args.data.distributorId,
        userId: args.data.userId,
        availableBalance: new Prisma.Decimal(args.data.availableBalance || 0),
        pendingBalance: new Prisma.Decimal(args.data.pendingBalance || 0),
        lifetimeEarned: new Prisma.Decimal(args.data.lifetimeEarned || 0),
        lifetimePaid: new Prisma.Decimal(args.data.lifetimePaid || 0),
        currency: args.data.currency || 'INR',
        isLocked: args.data.isLocked || false,
      };
      inMemoryWallets.set(args.data.distributorId, wallet);
      return wallet;
    });

    vi.spyOn(prisma.wallet, 'update').mockImplementation(async (args: any) => {
      for (const [distId, w] of inMemoryWallets.entries()) {
        if (w.id === args.where.id) {
          if (args.data.availableBalance !== undefined) {
            w.availableBalance = new Prisma.Decimal(args.data.availableBalance);
          }
          if (args.data.lifetimeEarned?.increment) {
            w.lifetimeEarned = w.lifetimeEarned.add(new Prisma.Decimal(args.data.lifetimeEarned.increment));
          }
          return w;
        }
      }
      return null;
    });

    // Mock prisma.commissionTransaction
    vi.spyOn(prisma.commissionTransaction, 'findUnique').mockImplementation(async (args: any) => {
      const comm = inMemoryCommissionTx.get(args.where.id);
      if (!comm) return null;
      const recipient = inMemoryDistributors.get(comm.recipientMemberId) || {
        id: comm.recipientMemberId,
        userId: 'user-default',
        distributorCode: 'DST-DEFAULT',
        firstName: 'Test',
        lastName: 'User',
      };
      return {
        ...comm,
        recipient,
        order: { id: comm.orderId, orderNumber: `ORD-${comm.orderId}` },
      };
    });

    vi.spyOn(prisma.commissionTransaction, 'findMany').mockImplementation(async (args: any) => {
      let results = Array.from(inMemoryCommissionTx.values());
      if (args.where?.recipientMemberId) {
        results = results.filter((c) => c.recipientMemberId === args.where.recipientMemberId);
      }
      if (args.where?.orderId) {
        results = results.filter((c) => c.orderId === args.where.orderId);
      }
      if (args.where?.status) {
        results = results.filter((c) => c.status === args.where.status);
      }
      return results.map((c) => {
        const recipient = inMemoryDistributors.get(c.recipientMemberId) || {
          id: c.recipientMemberId,
          userId: 'user-default',
          distributorCode: 'DST-DEFAULT',
        };
        const walletTransaction = inMemoryWalletTx.get(c.walletTransactionId) || null;
        return {
          ...c,
          recipient,
          walletTransaction,
        };
      });
    });

    vi.spyOn(prisma.commissionTransaction, 'update').mockImplementation(async (args: any) => {
      const comm = inMemoryCommissionTx.get(args.where.id);
      if (!comm) return null;
      Object.assign(comm, args.data);
      return comm;
    });

    // Mock prisma.walletTransaction
    vi.spyOn(prisma.walletTransaction, 'create').mockImplementation(async (args: any) => {
      const id = `wtx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const record = {
        id,
        ...args.data,
      };
      inMemoryWalletTx.set(id, record);
      return record;
    });

    vi.spyOn(prisma.walletTransaction, 'findMany').mockImplementation(async (args: any) => {
      let results = Array.from(inMemoryWalletTx.values());
      if (args.where?.type) {
        results = results.filter((w) => w.type === args.where.type);
      }
      if (args.where?.memberId) {
        results = results.filter((w) => w.memberId === args.where.memberId);
      }
      if (args.where?.orderId) {
        results = results.filter((w) => w.orderId === args.where.orderId);
      }
      return results.map((w) => {
        let wallet = null;
        for (const wall of inMemoryWallets.values()) {
          if (wall.id === w.walletId) {
            wallet = wall;
            break;
          }
        }
        return {
          ...w,
          wallet,
        };
      });
    });

    vi.spyOn(prisma.walletTransaction, 'findFirst').mockImplementation(async (args: any) => {
      for (const w of inMemoryWalletTx.values()) {
        let matches = true;
        if (args.where?.referenceId && w.referenceId !== args.where.referenceId) matches = false;
        if (args.where?.type && w.type !== args.where.type) matches = false;
        if (matches) return w;
      }
      return null;
    });
  });

  // ==========================================================================
  // SECTION 1: WALLET TRANSACTION CREATION & 8 MANDATED FIELDS
  // ==========================================================================
  describe('1. Wallet Transaction Creation & 8 Mandated Fields', () => {
    it('should safely credit APPROVED commission to wallet and populate all 8 mandated fields', async () => {
      const commTxId = 'comm-approved-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-100',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'APPROVED',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-100-dist-1-1',
        walletTransactionId: null,
      });

      const result = await CommissionWalletService.creditCommissionToWallet(commTxId);

      // Verify returned result
      expect(result.commissionTransactionId).toBe(commTxId);
      expect(result.amount).toBe(2400);
      expect(result.memberId).toBe('dist-1');
      expect(result.orderId).toBe('ord-100');
      expect(result.type).toBe('COMMISSION');
      expect(result.status).toBe('COMPLETED');
      expect(result.balanceBefore).toBe(1000);
      expect(result.balanceAfter).toBe(3400);
      expect(result.createdAt).toBeInstanceOf(Date);

      // Verify WalletTransaction created in memory with ALL 8 mandated fields:
      // 1. memberId
      // 2. amount
      // 3. type = COMMISSION
      // 4. commissionTransactionId
      // 5. orderId
      // 6. description
      // 7. status
      // 8. createdAt
      const createdWtx = inMemoryWalletTx.get(result.walletTransactionId);
      expect(createdWtx).toBeDefined();
      expect(createdWtx.memberId).toBe('dist-1');
      expect(Number(createdWtx.amount)).toBe(2400);
      expect(createdWtx.type).toBe('COMMISSION');
      expect(createdWtx.commissionTransactionId).toBe(commTxId);
      expect(createdWtx.orderId).toBe('ord-100');
      expect(createdWtx.description).toContain('Level 1 Commission (24%) from Order ORD-ord-100');
      expect(createdWtx.status).toBe('COMPLETED');
      expect(createdWtx.createdAt).toBeInstanceOf(Date);

      // Verify wallet balance updated
      const wallet = inMemoryWallets.get('dist-1');
      expect(Number(wallet.availableBalance)).toBe(3400);
      expect(Number(wallet.lifetimeEarned)).toBe(3400);

      // Verify CommissionTransaction updated to PAID with walletTransactionId link
      const comm = inMemoryCommissionTx.get(commTxId);
      expect(comm.status).toBe('PAID');
      expect(comm.walletTransactionId).toBe(result.walletTransactionId);
      expect(comm.paidAt).toBeInstanceOf(Date);
    });

    it('should create wallet if recipient wallet does not yet exist', async () => {
      const commTxId = 'comm-new-wallet-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-2', // dist-2 has no pre-existing wallet
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-200',
        commissionLevel: 2,
        businessVolume: new Prisma.Decimal(5000),
        percentage: new Prisma.Decimal(8),
        grossCommissionAmount: new Prisma.Decimal(400),
        status: 'AVAILABLE',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-200-dist-2-2',
        walletTransactionId: null,
      });

      const result = await CommissionWalletService.creditCommissionToWallet(commTxId);

      expect(result.amount).toBe(400);
      expect(result.balanceBefore).toBe(0);
      expect(result.balanceAfter).toBe(400);

      const wallet = inMemoryWallets.get('dist-2');
      expect(wallet).toBeDefined();
      expect(Number(wallet.availableBalance)).toBe(400);
    });
  });

  // ==========================================================================
  // SECTION 2: STATUS LIFECYCLE & WITHDRAWAL GUARDS
  // ==========================================================================
  describe('2. Status Lifecycle & Withdrawal Guards', () => {
    it('should reject crediting a PENDING commission to available wallet balance', async () => {
      const commTxId = 'comm-pending-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-pending',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PENDING',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-pending',
      });

      await expect(CommissionWalletService.creditCommissionToWallet(commTxId)).rejects.toThrow(
        /Cannot credit wallet for PENDING commission/i
      );
    });

    it('should reject crediting a REVERSED commission to wallet balance', async () => {
      const commTxId = 'comm-reversed-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-reversed',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'REVERSED',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-reversed',
      });

      await expect(CommissionWalletService.creditCommissionToWallet(commTxId)).rejects.toThrow(
        /Cannot credit wallet for REVERSED commission/i
      );
    });

    it('should reject crediting a CANCELLED commission to wallet balance', async () => {
      const commTxId = 'comm-cancelled-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-cancelled',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'CANCELLED',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-cancelled',
      });

      await expect(CommissionWalletService.creditCommissionToWallet(commTxId)).rejects.toThrow(
        /Cannot credit wallet for CANCELLED commission/i
      );
    });

    it('should strictly bar PENDING and REVERSED commissions from withdrawal eligibility', async () => {
      // Setup member with 1,000 available balance
      // Plus 2,400 in PENDING commissions and 500 in REVERSED commissions
      inMemoryCommissionTx.set('comm-p1', {
        id: 'comm-p1',
        recipientMemberId: 'dist-1',
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PENDING',
      });

      inMemoryCommissionTx.set('comm-r1', {
        id: 'comm-r1',
        recipientMemberId: 'dist-1',
        grossCommissionAmount: new Prisma.Decimal(500),
        status: 'REVERSED',
      });

      // 1. Trying to withdraw 1,000 (equal to available balance) -> Allowed
      const checkValid = await CommissionWalletService.validateWithdrawalEligibility('dist-1', 1000);
      expect(checkValid.canWithdraw).toBe(true);
      expect(checkValid.availableBalance).toBe(1000);
      expect(checkValid.pendingCommissionsTotal).toBe(2400);
      expect(checkValid.pendingCommissionsCount).toBe(1);
      expect(checkValid.reversedCommissionsTotal).toBe(500);
      expect(checkValid.reversedCommissionsCount).toBe(1);

      // 2. Trying to withdraw 1,001 (exceeding available balance, e.g. trying to tap into PENDING) -> Rejected
      const checkInvalid = await CommissionWalletService.validateWithdrawalEligibility('dist-1', 1001);
      expect(checkInvalid.canWithdraw).toBe(false);
      expect(checkInvalid.reason).toContain('Insufficient available balance');
      expect(checkInvalid.reason).toContain('PENDING commissions cannot be withdrawn until cleared');
    });

    it('should reject withdrawal when wallet is locked', async () => {
      inMemoryWallets.get('dist-1').isLocked = true;

      const check = await CommissionWalletService.validateWithdrawalEligibility('dist-1', 500);
      expect(check.canWithdraw).toBe(false);
      expect(check.reason).toContain('Wallet is locked');
    });
  });

  // ==========================================================================
  // SECTION 3: DUPLICATE CREDIT PREVENTION
  // ==========================================================================
  describe('3. Duplicate Credit Prevention', () => {
    it('should prevent duplicate wallet credit if commission is already PAID', async () => {
      const commTxId = 'comm-paid-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-paid',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PAID',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-paid-1',
        walletTransactionId: 'wtx-existing-1',
      });

      await expect(CommissionWalletService.creditCommissionToWallet(commTxId)).rejects.toThrow(
        /already PAID. Duplicate wallet credit prevented/i
      );
    });

    it('should prevent duplicate credit if commission already has a walletTransactionId', async () => {
      const commTxId = 'comm-linked-1';
      inMemoryCommissionTx.set(commTxId, {
        id: commTxId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-linked',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'APPROVED',
        source: 'ORDER_PURCHASE',
        idempotencyKey: 'idemp-linked-1',
        walletTransactionId: 'wtx-existing-2',
      });

      await expect(CommissionWalletService.creditCommissionToWallet(commTxId)).rejects.toThrow(
        /already linked to wallet transaction/i
      );
    });
  });

  // ==========================================================================
  // SECTION 4: RECONCILIATION ENGINE (COMMISSION LEDGER vs WALLET LEDGER)
  // ==========================================================================
  describe('4. Commission Ledger & Wallet Ledger Reconciliation', () => {
    it('should report perfectly reconciled ledgers when all paid commissions match wallet credits', async () => {
      const commId = 'comm-match-1';
      const wtxId = 'wtx-match-1';

      inMemoryCommissionTx.set(commId, {
        id: commId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-recon-1',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PAID',
        walletTransactionId: wtxId,
      });

      inMemoryWalletTx.set(wtxId, {
        id: wtxId,
        walletId: 'wallet-dist-1',
        memberId: 'dist-1',
        commissionTransactionId: commId,
        orderId: 'ord-recon-1',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(2400),
        netAmount: new Prisma.Decimal(2400),
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(true);
      expect(report.discrepancyCount).toBe(0);
      expect(report.criticalDiscrepancyCount).toBe(0);
      expect(report.totalPaidCommissions).toBe(1);
      expect(report.totalPaidCommissionAmount).toBe(2400);
      expect(report.totalWalletCommissionAmount).toBe(2400);
    });

    it('should detect UNPOSTED_COMMISSION when commission is marked PAID but missing wallet transaction', async () => {
      const commId = 'comm-unposted-1';

      inMemoryCommissionTx.set(commId, {
        id: commId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-unposted',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PAID',
        walletTransactionId: null,
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(false);
      expect(report.criticalDiscrepancyCount).toBe(1);
      const disc = report.discrepancies.find((d) => d.type === 'UNPOSTED_COMMISSION');
      expect(disc).toBeDefined();
      expect(disc?.severity).toBe('CRITICAL');
      expect(disc?.commissionTransactionId).toBe(commId);
      expect(disc?.expectedAmount).toBe(2400);
    });

    it('should detect DUPLICATE_WALLET_CREDIT when multiple wallet credits exist for one commission', async () => {
      const commId = 'comm-dup-1';
      const wtx1 = 'wtx-dup-1';
      const wtx2 = 'wtx-dup-2';

      inMemoryCommissionTx.set(commId, {
        id: commId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-dup',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PAID',
        walletTransactionId: wtx1,
      });

      inMemoryWalletTx.set(wtx1, {
        id: wtx1,
        walletId: 'wallet-dist-1',
        memberId: 'dist-1',
        commissionTransactionId: commId,
        orderId: 'ord-dup',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(2400),
      });

      inMemoryWalletTx.set(wtx2, {
        id: wtx2,
        walletId: 'wallet-dist-1',
        memberId: 'dist-1',
        commissionTransactionId: commId,
        orderId: 'ord-dup',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(2400),
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(false);
      const disc = report.discrepancies.find((d) => d.type === 'DUPLICATE_WALLET_CREDIT');
      expect(disc).toBeDefined();
      expect(disc?.severity).toBe('CRITICAL');
      expect(disc?.actualAmount).toBe(4800);
      expect(disc?.expectedAmount).toBe(2400);
    });

    it('should detect AMOUNT_MISMATCH between commission ledger and wallet ledger', async () => {
      const commId = 'comm-mismatch-1';
      const wtxId = 'wtx-mismatch-1';

      inMemoryCommissionTx.set(commId, {
        id: commId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-mismatch',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400), // Ledger has 2,400
        status: 'PAID',
        walletTransactionId: wtxId,
      });

      inMemoryWalletTx.set(wtxId, {
        id: wtxId,
        walletId: 'wallet-dist-1',
        memberId: 'dist-1',
        commissionTransactionId: commId,
        orderId: 'ord-mismatch',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(1800), // Wallet only credited 1,800!
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(false);
      const disc = report.discrepancies.find((d) => d.type === 'AMOUNT_MISMATCH');
      expect(disc).toBeDefined();
      expect(disc?.severity).toBe('HIGH');
      expect(disc?.expectedAmount).toBe(2400);
      expect(disc?.actualAmount).toBe(1800);
    });

    it('should detect RECIPIENT_MISMATCH when wallet credited belongs to a different member', async () => {
      const commId = 'comm-recip-1';
      const wtxId = 'wtx-recip-1';

      // Commission is for dist-1
      inMemoryCommissionTx.set(commId, {
        id: commId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-recip',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PAID',
        walletTransactionId: wtxId,
      });

      // Wallet belongs to dist-2!
      inMemoryWallets.set('dist-2', {
        id: 'wallet-dist-2',
        distributorId: 'dist-2',
        userId: 'user-2',
        availableBalance: new Prisma.Decimal(0),
      });

      inMemoryWalletTx.set(wtxId, {
        id: wtxId,
        walletId: 'wallet-dist-2', // Wrong wallet!
        memberId: 'dist-2',
        commissionTransactionId: commId,
        orderId: 'ord-recip',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(2400),
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(false);
      const disc = report.discrepancies.find((d) => d.type === 'RECIPIENT_MISMATCH');
      expect(disc).toBeDefined();
      expect(disc?.severity).toBe('CRITICAL');
      expect(disc?.memberId).toBe('dist-1');
    });

    it('should detect ORPHANED_WALLET_TRANSACTION referencing a non-existent commission', async () => {
      const wtxOrphanId = 'wtx-orphan-1';

      inMemoryWalletTx.set(wtxOrphanId, {
        id: wtxOrphanId,
        walletId: 'wallet-dist-1',
        memberId: 'dist-1',
        commissionTransactionId: 'comm-ghost-999', // Does not exist in commissionTransaction table!
        orderId: 'ord-ghost',
        type: 'COMMISSION',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(500),
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(false);
      const disc = report.discrepancies.find((d) => d.type === 'ORPHANED_WALLET_TRANSACTION');
      expect(disc).toBeDefined();
      expect(disc?.walletTransactionId).toBe(wtxOrphanId);
      expect(disc?.actualAmount).toBe(500);
    });

    it('should detect MISSING_REVERSAL_DEBIT when a paid commission was REVERSED without compensatory wallet debit', async () => {
      const commRevId = 'comm-rev-missing-debit';

      inMemoryCommissionTx.set(commRevId, {
        id: commRevId,
        recipientMemberId: 'dist-1',
        sourceMemberId: 'dist-buyer',
        orderId: 'ord-rev',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'REVERSED',
        walletTransactionId: 'wtx-original-credit', // Was previously credited
      });

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers();

      expect(report.isReconciled).toBe(false);
      const disc = report.discrepancies.find((d) => d.type === 'MISSING_REVERSAL_DEBIT');
      expect(disc).toBeDefined();
      expect(disc?.commissionTransactionId).toBe(commRevId);
      expect(disc?.expectedAmount).toBe(2400);
    });
  });
});
