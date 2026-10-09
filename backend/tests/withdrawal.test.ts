import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { WithdrawalService } from '../src/services/withdrawal.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { AppError } from '../src/utils/appError';

describe('TREASURY & MEMBER WITHDRAWAL SYSTEM (PROMPT 38 TEST SUITE)', () => {
  let inMemoryPlatformWallets: Map<string, any>;
  let inMemoryPlatformTx: Map<string, any>;
  let inMemoryWithdrawals: Map<string, any>;
  let inMemoryPayouts: Map<string, any>;
  let inMemoryMemberWallets: Map<string, any>;
  let inMemoryMemberTx: Map<string, any>;
  let inMemoryDistributors: Map<string, any>;
  let inMemoryBankAccounts: Map<string, any>;
  let inMemoryCommissions: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    inMemoryPlatformWallets = new Map();
    inMemoryPlatformTx = new Map();
    inMemoryWithdrawals = new Map();
    inMemoryPayouts = new Map();
    inMemoryMemberWallets = new Map();
    inMemoryMemberTx = new Map();
    inMemoryDistributors = new Map();
    inMemoryBankAccounts = new Map();
    inMemoryCommissions = new Map();

    // 1. Mock platformWallet
    vi.spyOn(prisma.platformWallet, 'findUnique').mockImplementation(async (args: any) => {
      const code = args.where.walletCode;
      for (const w of inMemoryPlatformWallets.values()) {
        if (w.walletCode === code || w.id === args.where.id) return { ...w };
      }
      return null;
    });

    vi.spyOn(prisma.platformWallet, 'create').mockImplementation(async (args: any) => {
      const newWallet = {
        id: `pw-${Date.now()}-${Math.random()}`,
        walletCode: args.data.walletCode || 'PRIMARY_TREASURY',
        currency: args.data.currency || 'INR',
        availableBalance: new Prisma.Decimal(args.data.availableBalance ?? 0),
        pendingBalance: new Prisma.Decimal(args.data.pendingBalance ?? 0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryPlatformWallets.set(newWallet.id, newWallet);
      return { ...newWallet };
    });

    vi.spyOn(prisma.platformWallet, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryPlatformWallets.get(args.where.id);
      if (!existing) throw new Error('Platform wallet not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryPlatformWallets.set(args.where.id, updated);
      return { ...updated };
    });

    // 2. Mock platformWalletTransaction
    vi.spyOn(prisma.platformWalletTransaction, 'create').mockImplementation(async (args: any) => {
      const tx = {
        id: `pwx-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryPlatformTx.set(tx.id, tx);
      return { ...tx };
    });

    vi.spyOn(prisma.platformWalletTransaction, 'findFirst').mockImplementation(async () => null);
    vi.spyOn(prisma.platformWalletTransaction, 'findUnique').mockImplementation(async () => null);
    vi.spyOn(prisma.platformWalletTransaction, 'findMany').mockImplementation(async () =>
      Array.from(inMemoryPlatformTx.values())
    );

    // 3. Mock WithdrawalRequest
    vi.spyOn(prisma.withdrawalRequest, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where?.id) {
        return inMemoryWithdrawals.get(args.where.id) || null;
      }
      if (args.where?.idempotencyKey) {
        for (const w of inMemoryWithdrawals.values()) {
          if (w.idempotencyKey === args.where.idempotencyKey) return { ...w };
        }
      }
      return null;
    });

    vi.spyOn(prisma.withdrawalRequest, 'findFirst').mockImplementation(async (args: any) => {
      for (const w of inMemoryWithdrawals.values()) {
        if (
          args.where?.memberId === w.memberId &&
          Number(args.where?.amount) === Number(w.amount) &&
          args.where?.status?.in?.includes(w.status)
        ) {
          return { ...w };
        }
      }
      return null;
    });

    vi.spyOn(prisma.withdrawalRequest, 'create').mockImplementation(async (args: any) => {
      const w = {
        id: `wd-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryWithdrawals.set(w.id, w);
      return { ...w };
    });

    vi.spyOn(prisma.withdrawalRequest, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryWithdrawals.get(args.where.id);
      if (!existing) throw new Error('Withdrawal request not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryWithdrawals.set(args.where.id, updated);
      return { ...updated };
    });

    vi.spyOn(prisma.withdrawalRequest, 'findMany').mockImplementation(async () =>
      Array.from(inMemoryWithdrawals.values())
    );
    vi.spyOn(prisma.withdrawalRequest, 'count').mockImplementation(async () => inMemoryWithdrawals.size);

    // 4. Mock PayoutRequest
    vi.spyOn(prisma.payoutRequest, 'create').mockImplementation(async (args: any) => {
      const p = {
        id: `por-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryPayouts.set(p.id, p);
      return { ...p };
    });

    vi.spyOn(prisma.payoutRequest, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryPayouts.get(args.where.id);
      if (!existing) return null as any;
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryPayouts.set(args.where.id, updated);
      return { ...updated };
    });

    // 5. Mock Member Wallet
    vi.spyOn(prisma.wallet, 'findFirst').mockImplementation(async (args: any) => {
      const distId =
        args.where?.distributorId ||
        args.where?.OR?.find((c: any) => c.distributorId)?.distributorId;
      const uId =
        args.where?.userId ||
        args.where?.OR?.find((c: any) => c.userId)?.userId;

      for (const w of inMemoryMemberWallets.values()) {
        if ((distId && w.distributorId === distId) || (uId && w.userId === uId)) {
          return { ...w };
        }
      }
      return null;
    });

    vi.spyOn(prisma.wallet, 'findUnique').mockImplementation(async (args: any) => {
      for (const w of inMemoryMemberWallets.values()) {
        if (w.id === args.where?.id || w.distributorId === args.where?.distributorId) {
          return { ...w };
        }
      }
      return null;
    });

    vi.spyOn(prisma.wallet, 'create').mockImplementation(async (args: any) => {
      const w = {
        id: `mw-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryMemberWallets.set(w.id, w);
      return { ...w };
    });

    vi.spyOn(prisma.wallet, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryMemberWallets.get(args.where.id);
      if (!existing) throw new Error('Member wallet not found');
      const updated = { ...existing };
      if (args.data.availableBalance !== undefined) updated.availableBalance = args.data.availableBalance;
      if (args.data.pendingBalance?.increment) {
        updated.pendingBalance = new Prisma.Decimal(
          Number(updated.pendingBalance || 0) + Number(args.data.pendingBalance.increment)
        );
      }
      if (args.data.pendingBalance?.decrement) {
        updated.pendingBalance = new Prisma.Decimal(
          Number(updated.pendingBalance || 0) - Number(args.data.pendingBalance.decrement)
        );
      }
      if (args.data.lifetimePaid?.increment) {
        updated.lifetimePaid = new Prisma.Decimal(
          Number(updated.lifetimePaid || 0) + Number(args.data.lifetimePaid.increment)
        );
      }
      if (args.data.totalWithdrawn?.increment) {
        updated.totalWithdrawn = new Prisma.Decimal(
          Number(updated.totalWithdrawn || 0) + Number(args.data.totalWithdrawn.increment)
        );
      }
      inMemoryMemberWallets.set(args.where.id, updated);
      return { ...updated };
    });

    // 6. Mock member walletTransaction
    vi.spyOn(prisma.walletTransaction, 'create').mockImplementation(async (args: any) => {
      const tx = {
        id: `mtx-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryMemberTx.set(tx.id, tx);
      return { ...tx };
    });

    // 7. Mock distributorProfile
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
      const id = args.where?.id || args.where?.userId || args.where?.OR?.[0]?.id;
      for (const d of inMemoryDistributors.values()) {
        if (d.id === id || d.userId === id) return { ...d };
      }
      return null;
    });

    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
      for (const d of inMemoryDistributors.values()) {
        if (d.id === args.where?.id || d.userId === args.where?.userId) return { ...d };
      }
      return null;
    });

    // 8. Mock bankAccount
    vi.spyOn(prisma.bankAccount, 'findFirst').mockImplementation(async (args: any) => {
      for (const b of inMemoryBankAccounts.values()) {
        if (b.id === args.where?.id && b.distributorId === args.where?.distributorId) {
          return { ...b };
        }
      }
      return null;
    });

    // 9. Mock commissionTransaction aggregate
    vi.spyOn(prisma.commissionTransaction, 'aggregate').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryCommissions.values()).filter(
        (c) => c.recipientMemberId === args.where?.recipientMemberId && c.status === args.where?.status
      );
      const sum = list.reduce((acc, c) => acc + Number(c.grossCommissionAmount || 0), 0);
      return { _sum: { grossCommissionAmount: new Prisma.Decimal(sum) } } as any;
    });

    // 10. Mock auditLog
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-1' } as any);

    // 11. Mock $transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  // Helper setup
  const setupMemberWithFunds = async (
    distributorId = 'dist-1',
    userId = 'user-1',
    availableFunds = 10000,
    companyFunds = 50000,
    bankStatus = 'VERIFIED'
  ) => {
    // 1. Distributor
    const dist = {
      id: distributorId,
      userId,
      distributorCode: 'DST-1001',
      status: 'ACTIVE',
      user: { id: userId, email: 'member@test.com', status: 'ACTIVE' },
    };
    inMemoryDistributors.set(dist.id, dist);

    // 2. Member Wallet
    const mw = {
      id: `wallet-${distributorId}`,
      distributorId,
      userId,
      availableBalance: new Prisma.Decimal(availableFunds),
      pendingBalance: new Prisma.Decimal(0),
      lifetimeEarned: new Prisma.Decimal(availableFunds),
      lifetimePaid: new Prisma.Decimal(0),
      totalWithdrawn: new Prisma.Decimal(0),
      isLocked: false,
      currency: 'INR',
    };
    inMemoryMemberWallets.set(mw.id, mw);

    // 3. Bank Account
    const bank = {
      id: `bank-${distributorId}`,
      distributorId,
      bankName: 'HDFC Bank',
      accountNumber: '1234567890',
      routingNumber: 'HDFC0001234',
      status: bankStatus,
      deletedAt: null,
    };
    inMemoryBankAccounts.set(bank.id, bank);

    // 4. Platform Treasury
    const pw = await PlatformTreasuryService.getOrCreatePlatformWallet();
    if (companyFunds > 0) {
      await PlatformTreasuryService.creditTreasury({
        amount: companyFunds,
        referenceType: 'FLOAT',
        description: 'Seed Treasury',
      });
    }

    return { dist, mw, bank, pw };
  };

  // ==========================================================================
  // SECTION 1: WITHDRAWAL REQUEST CREATION & REQUIRED FIELDS
  // ==========================================================================

  it('should create WithdrawalRequest with all 8 prompt-mandated fields', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-fields', 'user-fields', 5000, 50000);

    const withdrawal = await WithdrawalService.requestWithdrawal(dist.userId, {
      amount: 2500,
      bankAccountId: bank.id,
      payoutProvider: 'RAZORPAYX',
    });

    // Verify all 8 fields requested by Prompt 38
    expect(withdrawal.id).toBeDefined();
    expect(withdrawal.memberId).toBe('dist-fields');
    expect(withdrawal.amount).toBe(2500);
    expect(withdrawal.status).toBe('REQUESTED');
    expect(withdrawal.payoutProvider).toBe('RAZORPAYX');
    expect(withdrawal.externalTransactionId).toBeNull();
    expect(withdrawal.createdAt).toBeInstanceOf(Date);
    expect(withdrawal.processedAt).toBeNull();

    // Verify paired PayoutRequest was also created (integration without replacement)
    expect(withdrawal.payoutRequestId).toBeDefined();
  });

  // ==========================================================================
  // SECTION 2: THE 8 VERIFICATION RULES
  // ==========================================================================

  it('Rule 1: must reject withdrawal if member profile does not exist or is inactive', async () => {
    // Non-existent member
    const check1 = await WithdrawalService.validateWithdrawal('invalid-user', 1000);
    expect(check1.isValid).toBe(false);
    expect(check1.violations[0]).toContain('Distributor profile not found');

    // Inactive member
    await setupMemberWithFunds('dist-inactive', 'user-inactive', 5000, 50000);
    inMemoryDistributors.get('dist-inactive').status = 'SUSPENDED';

    const check2 = await WithdrawalService.validateWithdrawal('user-inactive', 1000);
    expect(check2.isValid).toBe(false);
    expect(check2.violations[0]).toContain('Member account is not active');
  });

  it('Rule 2: must reject withdrawal if amount exceeds available commission balance', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-bal', 'user-bal', 1000, 50000);

    // Try to withdraw 1,500 when available is 1,000
    const check = await WithdrawalService.validateWithdrawal(dist.userId, 1500, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('Insufficient available balance'))).toBe(true);

    await expect(
      WithdrawalService.requestWithdrawal(dist.userId, { amount: 1500, bankAccountId: bank.id })
    ).rejects.toThrow(AppError);
  });

  it('Rule 3: must reject withdrawal if wallet is locked', async () => {
    const { dist, bank, mw } = await setupMemberWithFunds('dist-lock', 'user-lock', 5000, 50000);
    inMemoryMemberWallets.get(mw.id).isLocked = true;

    const check = await WithdrawalService.validateWithdrawal(dist.userId, 1000, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('Member wallet is locked'))).toBe(true);
  });

  it('Rule 4: must reject withdrawal if below minimum amount (500 INR)', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-min', 'user-min', 5000, 50000);

    const check = await WithdrawalService.validateWithdrawal(dist.userId, 400, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('below the minimum threshold of ₹500.00'))).toBe(true);
  });

  it('Rule 5: must reject withdrawal if above maximum amount (100,000 INR)', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-max', 'user-max', 200000, 500000);

    const check = await WithdrawalService.validateWithdrawal(dist.userId, 150000, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('exceeds the maximum transaction limit'))).toBe(true);
  });

  it('Rule 6: must reject withdrawal if bank account is unverified or belongs to someone else', async () => {
    const { dist } = await setupMemberWithFunds('dist-bank', 'user-bank', 5000, 50000, 'PENDING_VERIFICATION');

    const check = await WithdrawalService.validateWithdrawal(dist.userId, 1000, `bank-dist-bank`);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('Designated bank account is not verified'))).toBe(true);
  });

  it('Rule 7: must reject withdrawal if company treasury payout liquidity is insufficient', async () => {
    // Member has 5,000 INR, but company treasury has only 200 INR
    const { dist, bank } = await setupMemberWithFunds('dist-liq', 'user-liq', 5000, 200);

    const check = await WithdrawalService.validateWithdrawal(dist.userId, 1000, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('Insufficient company payout liquidity'))).toBe(true);
  });

  it('Rule 8: duplicate withdrawal prevention within rapid submission window', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-dup', 'user-dup', 10000, 50000);

    // First request succeeds
    await WithdrawalService.requestWithdrawal(dist.userId, {
      amount: 1000,
      bankAccountId: bank.id,
    });

    // Rapid second identical request is blocked
    const check = await WithdrawalService.validateWithdrawal(dist.userId, 1000, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('Duplicate withdrawal request detected'))).toBe(true);
  });

  // ==========================================================================
  // SECTION 3: DO NOT WITHDRAW PENDING, REVERSED, CANCELLED COMMISSIONS
  // ==========================================================================

  it('must NOT allow users to withdraw PENDING, REVERSED, or CANCELLED commissions', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-uncleared', 'user-uncleared', 0, 50000);

    // Member has 10,000 in PENDING commissions and 2,000 in REVERSED
    inMemoryCommissions.set('c-pend', {
      recipientMemberId: dist.id,
      grossCommissionAmount: new Prisma.Decimal(10000),
      status: 'PENDING',
    });
    inMemoryCommissions.set('c-rev', {
      recipientMemberId: dist.id,
      grossCommissionAmount: new Prisma.Decimal(2000),
      status: 'REVERSED',
    });

    const check = await WithdrawalService.validateWithdrawal(dist.userId, 1000, bank.id);
    expect(check.isValid).toBe(false);
    expect(check.violations.some((v) => v.includes('Uncleared commissions (Pending: ₹10000.00) cannot be withdrawn'))).toBe(true);
  });

  // ==========================================================================
  // SECTION 4: NO EARLY DEDUCTION & ATOMIC LEDGER OPERATIONS
  // ==========================================================================

  it('must place funds on HOLD first, then debit Treasury and finalize wallet upon PAID stage', async () => {
    const { dist, bank, mw } = await setupMemberWithFunds('dist-stage', 'user-stage', 5000, 50000);

    // 1. Stage: REQUESTED -> Funds placed on hold
    const withdrawal = await WithdrawalService.requestWithdrawal(dist.userId, {
      amount: 2000,
      bankAccountId: bank.id,
    });

    const walletAfterRequest = inMemoryMemberWallets.get(mw.id);
    expect(Number(walletAfterRequest.availableBalance)).toBe(3000); // 5000 - 2000
    expect(Number(walletAfterRequest.pendingBalance)).toBe(2000);   // on hold
    expect(Number(walletAfterRequest.lifetimePaid)).toBe(0);        // NOT deducted/paid yet!

    // 2. Stage: APPROVE
    const approved = await WithdrawalService.approveWithdrawal(withdrawal.id, 'admin-1', 'KYC verified');
    expect(approved.status).toBe('APPROVED');

    // 3. Stage: PROCESSING
    const processing = await WithdrawalService.dispatchProcessing(withdrawal.id, 'admin-1', 'RAZORPAYX', 'RZP-TX-9988');
    expect(processing.status).toBe('PROCESSING');
    expect(processing.externalTransactionId).toBe('RZP-TX-9988');

    // 4. Stage: DISBURSE (PAID)
    const disbursed = await WithdrawalService.disburseWithdrawal(withdrawal.id, 'admin-1', {
      externalTransactionId: 'RZP-TX-9988',
      referenceNumber: 'UTR-12345678',
    });
    expect(disbursed.status).toBe('PAID');
    expect(disbursed.processedAt).toBeInstanceOf(Date);

    // Member wallet is now finalized:
    const walletAfterDisburse = inMemoryMemberWallets.get(mw.id);
    expect(Number(walletAfterDisburse.pendingBalance)).toBe(0);    // Released from hold
    expect(Number(walletAfterDisburse.lifetimePaid)).toBe(2000);   // Added to paid
    expect(Number(walletAfterDisburse.totalWithdrawn)).toBe(2000);

    // Platform Treasury is debited:
    const finalTreasury = await PlatformTreasuryService.getTreasuryBalance();
    expect(finalTreasury.availableBalance).toBe(48000); // 50000 - 2000

    const treasuryTx = Array.from(inMemoryPlatformTx.values()).find((t) => t.type === 'PAYOUT');
    expect(treasuryTx).toBeDefined();
    expect(Number(treasuryTx.amount)).toBe(2000);
  });

  it('should restore held funds back to available balance when withdrawal is CANCELLED or FAILED', async () => {
    const { dist, bank, mw } = await setupMemberWithFunds('dist-cancel', 'user-cancel', 5000, 50000);

    const withdrawal = await WithdrawalService.requestWithdrawal(dist.userId, {
      amount: 2000,
      bankAccountId: bank.id,
    });

    expect(Number(inMemoryMemberWallets.get(mw.id).availableBalance)).toBe(3000);
    expect(Number(inMemoryMemberWallets.get(mw.id).pendingBalance)).toBe(2000);

    // Member or admin cancels
    const cancelled = await WithdrawalService.cancelOrFailWithdrawal(
      withdrawal.id,
      'CANCELLED',
      'Distributor requested cancellation before dispatch',
      dist.userId
    );

    expect(cancelled.status).toBe('CANCELLED');

    // Funds restored back to available balance:
    const walletAfterCancel = inMemoryMemberWallets.get(mw.id);
    expect(Number(walletAfterCancel.availableBalance)).toBe(5000); // Restored!
    expect(Number(walletAfterCancel.pendingBalance)).toBe(0);      // Hold cleared!

    // Compensating REVERSAL WalletTransaction created
    const revTx = Array.from(inMemoryMemberTx.values()).find((t) => t.type === 'REVERSAL');
    expect(revTx).toBeDefined();
    expect(Number(revTx.amount)).toBe(2000);
  });

  // ==========================================================================
  // SECTION 5: NEVER ALLOW NEGATIVE WALLET BALANCES
  // ==========================================================================

  it('must strictly prohibit operations that would cause negative wallet balances', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-neg', 'user-neg', 100, 50000);

    await expect(
      WithdrawalService.requestWithdrawal(dist.userId, {
        amount: 500, // exceeds available balance of 100
        bankAccountId: bank.id,
      })
    ).rejects.toThrow(AppError);

    // Available balance is unmodified
    const w = await prisma.wallet.findFirst({ where: { distributorId: dist.id } });
    expect(Number(w?.availableBalance)).toBe(100);
  });

  // ==========================================================================
  // SECTION 6: POST-PAYOUT REVERSAL & TREASURY REFUND
  // ==========================================================================

  it('should handle post-payout REVERSED status with compensating Treasury credit', async () => {
    const { dist, bank } = await setupMemberWithFunds('dist-rev-wd', 'user-rev-wd', 5000, 50000);

    const withdrawal = await WithdrawalService.requestWithdrawal(dist.userId, {
      amount: 2000,
      bankAccountId: bank.id,
    });
    await WithdrawalService.approveWithdrawal(withdrawal.id, 'admin-1');
    await WithdrawalService.disburseWithdrawal(withdrawal.id, 'admin-1');

    const treasuryAfterPaid = await PlatformTreasuryService.getTreasuryBalance();
    expect(treasuryAfterPaid.availableBalance).toBe(48000);

    // Post-payout reversal (e.g. bank bounce after batch transmission)
    const reversed = await WithdrawalService.reverseWithdrawal(
      withdrawal.id,
      'Bank returned funds: Beneficiary account frozen',
      'admin-1'
    );

    expect(reversed.status).toBe('REVERSED');

    // Treasury refunded via RECONCILIATION transaction
    const finalTreasury = await PlatformTreasuryService.getTreasuryBalance();
    expect(finalTreasury.availableBalance).toBe(50000); // 48000 + 2000 refunded
  });
});
