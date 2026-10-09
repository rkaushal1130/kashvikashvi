import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import { TreasuryCommissionService } from '../src/services/treasuryCommission.service';
import { PlatformTreasuryService } from '../src/services/platformTreasury.service';
import { AppError } from '../src/utils/appError';

describe('TREASURY & MLM COMMISSION SYSTEM INTEGRATION (PROMPT 37 TEST SUITE)', () => {
  let inMemoryPlatformWallets: Map<string, any>;
  let inMemoryPlatformTx: Map<string, any>;
  let inMemoryCommissions: Map<string, any>;
  let inMemoryMemberWallets: Map<string, any>;
  let inMemoryMemberTx: Map<string, any>;
  let inMemoryPayouts: Map<string, any>;
  let inMemoryDistributors: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();
    inMemoryPlatformWallets = new Map();
    inMemoryPlatformTx = new Map();
    inMemoryCommissions = new Map();
    inMemoryMemberWallets = new Map();
    inMemoryMemberTx = new Map();
    inMemoryPayouts = new Map();
    inMemoryDistributors = new Map();

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

    vi.spyOn(prisma.platformWalletTransaction, 'findMany').mockImplementation(async (args?: any) => {
      let list = Array.from(inMemoryPlatformTx.values());
      if (args?.where?.type) {
        list = list.filter((t) => t.type === args.where.type);
      }
      if (args?.where?.status) {
        list = list.filter((t) => t.status === args.where.status);
      }
      return list.map((t) => ({ ...t }));
    });

    vi.spyOn(prisma.platformWalletTransaction, 'aggregate').mockImplementation(async (args?: any) => {
      let list = Array.from(inMemoryPlatformTx.values());
      if (args?.where?.type) {
        list = list.filter((t) => t.type === args.where.type);
      }
      const sum = list.reduce((acc, t) => acc + Number(t.amount || 0), 0);
      return { _sum: { amount: new Prisma.Decimal(sum) } } as any;
    });

    // 3. Mock commissionTransaction
    vi.spyOn(prisma.commissionTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where.id) {
        const item = inMemoryCommissions.get(args.where.id);
        return item ? { ...item } : null;
      }
      if (args.where.idempotencyKey) {
        for (const c of inMemoryCommissions.values()) {
          if (c.idempotencyKey === args.where.idempotencyKey) return { ...c };
        }
      }
      return null;
    });

    vi.spyOn(prisma.commissionTransaction, 'create').mockImplementation(async (args: any) => {
      const comm = {
        id: `comm-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inMemoryCommissions.set(comm.id, comm);
      return { ...comm };
    });

    vi.spyOn(prisma.commissionTransaction, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryCommissions.get(args.where.id);
      if (!existing) throw new Error('Commission not found');
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      inMemoryCommissions.set(args.where.id, updated);
      return { ...updated };
    });

    vi.spyOn(prisma.commissionTransaction, 'updateMany').mockImplementation(async (args: any) => {
      let count = 0;
      for (const [id, comm] of inMemoryCommissions.entries()) {
        if (
          args.where.recipientMemberId === comm.recipientMemberId &&
          (!args.where.status || args.where.status.in?.includes(comm.status))
        ) {
          inMemoryCommissions.set(id, { ...comm, ...args.data });
          count++;
        }
      }
      return { count } as any;
    });

    vi.spyOn(prisma.commissionTransaction, 'findMany').mockImplementation(async (args?: any) => {
      let list = Array.from(inMemoryCommissions.values());
      if (args?.where?.status?.in) {
        list = list.filter((c) => args.where.status.in.includes(c.status));
      }
      if (args?.where?.walletTransactionId === null) {
        list = list.filter((c) => !c.walletTransactionId);
      }
      return list.map((c) => ({ ...c }));
    });

    vi.spyOn(prisma.commissionTransaction, 'aggregate').mockImplementation(async (args?: any) => {
      let list = Array.from(inMemoryCommissions.values());
      if (args?.where?.status) {
        list = list.filter((c) => c.status === args.where.status);
      }
      const sum = list.reduce((acc, c) => acc + Number(c.grossCommissionAmount || 0), 0);
      return { _sum: { grossCommissionAmount: new Prisma.Decimal(sum) } } as any;
    });

    // 4. Mock Member Wallet
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
        if (w.id === args.where.id || w.distributorId === args.where.distributorId) {
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
      if (args.data.availableBalance) updated.availableBalance = args.data.availableBalance;
      if (args.data.pendingBalance?.decrement) {
        updated.pendingBalance = new Prisma.Decimal(
          Number(updated.pendingBalance || 0) - Number(args.data.pendingBalance.decrement)
        );
      }
      if (args.data.lifetimeEarned?.increment) {
        updated.lifetimeEarned = new Prisma.Decimal(
          Number(updated.lifetimeEarned || 0) + Number(args.data.lifetimeEarned.increment)
        );
      }
      if (args.data.lifetimeEarned?.decrement) {
        updated.lifetimeEarned = new Prisma.Decimal(
          Number(updated.lifetimeEarned || 0) - Number(args.data.lifetimeEarned.decrement)
        );
      }
      if (args.data.lifetimePaid?.increment) {
        updated.lifetimePaid = new Prisma.Decimal(
          Number(updated.lifetimePaid || 0) + Number(args.data.lifetimePaid.increment)
        );
      }
      inMemoryMemberWallets.set(args.where.id, updated);
      return { ...updated };
    });

    vi.spyOn(prisma.wallet, 'aggregate').mockImplementation(async () => {
      const list = Array.from(inMemoryMemberWallets.values());
      const sumAvail = list.reduce((acc, w) => acc + Number(w.availableBalance || 0), 0);
      const sumPending = list.reduce((acc, w) => acc + Number(w.pendingBalance || 0), 0);
      const sumEarned = list.reduce((acc, w) => acc + Number(w.lifetimeEarned || 0), 0);
      const sumPaid = list.reduce((acc, w) => acc + Number(w.lifetimePaid || 0), 0);
      return {
        _sum: {
          availableBalance: new Prisma.Decimal(sumAvail),
          pendingBalance: new Prisma.Decimal(sumPending),
          lifetimeEarned: new Prisma.Decimal(sumEarned),
          lifetimePaid: new Prisma.Decimal(sumPaid),
        },
      } as any;
    });

    // 5. Mock member walletTransaction
    vi.spyOn(prisma.walletTransaction, 'create').mockImplementation(async (args: any) => {
      const tx = {
        id: `mtx-${Date.now()}-${Math.random()}`,
        ...args.data,
        createdAt: new Date(),
      };
      inMemoryMemberTx.set(tx.id, tx);
      return { ...tx };
    });

    // 6. Mock distributorProfile
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async (args: any) => {
      const d = inMemoryDistributors.get(args.where.id);
      return d ? { ...d } : { id: args.where.id, userId: `user-${args.where.id}`, distributorCode: 'DST-1' };
    });

    // 7. Mock PayoutRequest
    vi.spyOn(prisma.payoutRequest, 'findUnique').mockImplementation(async (args: any) => {
      const p = inMemoryPayouts.get(args.where.id);
      return p ? { ...p } : null;
    });

    vi.spyOn(prisma.payoutRequest, 'update').mockImplementation(async (args: any) => {
      const existing = inMemoryPayouts.get(args.where.id);
      if (!existing) throw new Error('Payout request not found');
      const updated = { ...existing, ...args.data };
      inMemoryPayouts.set(args.where.id, updated);
      return { ...updated };
    });

    vi.spyOn(prisma.payoutRequest, 'aggregate').mockImplementation(async () => {
      const list = Array.from(inMemoryPayouts.values()).filter((p) =>
        ['REQUESTED', 'UNDER_REVIEW', 'PROCESSING'].includes(p.status)
      );
      const sum = list.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      return { _sum: { amount: new Prisma.Decimal(sum) } } as any;
    });

    // 8. Mock auditLog
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-1' } as any);

    // 9. Mock platformWalletTransaction findFirst and findUnique
    vi.spyOn(prisma.platformWalletTransaction, 'findFirst').mockImplementation(async () => null);
    vi.spyOn(prisma.platformWalletTransaction, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where?.id) return inMemoryPlatformTx.get(args.where.id) || null;
      if (args.where?.idempotencyKey) {
        for (const tx of inMemoryPlatformTx.values()) {
          if (tx.idempotencyKey === args.where.idempotencyKey) return { ...tx };
        }
      }
      return null;
    });

    // 10. Mock prisma.$transaction to execute callback immediately
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });
  });

  // ==========================================================================
  // SECTION 1: SEPARATION OF EARNED COMMISSION FROM AVAILABLE PAYOUT FUNDS
  // ==========================================================================

  it('should record EARNED commission without requiring platform treasury funds', async () => {
    // Treasury has 0 balance
    const wallet = await PlatformTreasuryService.getOrCreatePlatformWallet();
    expect(wallet.availableBalance.toNumber()).toBe(0);

    // Member earns a commission of 2,400 INR
    const result = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'order-101',
      orderNumber: 'ORD-101',
      recipientMemberId: 'dist-1',
      sourceMemberId: 'dist-buyer',
      commissionLevel: 1,
      businessVolume: 10000,
      percentage: 24,
      grossCommissionAmount: 2400,
    });

    expect(result.status).toBe('EARNED');
    expect(result.grossCommissionAmount).toBe(2400);
    expect(result.isLiabilityRecorded).toBe(true);

    // Verify member wallet: lifetime earned increased, but available balance is STILL 0
    const memberWallet = await prisma.wallet.findFirst({ where: { distributorId: 'dist-1' } });
    expect(memberWallet).toBeDefined();
    expect(Number(memberWallet?.lifetimeEarned)).toBe(2400);
    expect(Number(memberWallet?.availableBalance)).toBe(0); // Not released yet!
  });

  it('must NOT delete or fail earned commission when platform treasury is low', async () => {
    // Treasury has only 100 INR
    await PlatformTreasuryService.creditTreasury({
      amount: 100,
      referenceType: 'INITIAL_FLOAT',
      description: 'Seed Float',
    });

    // Member earns 5,000 INR
    const earned = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'order-202',
      recipientMemberId: 'dist-2',
      sourceMemberId: 'dist-buyer',
      commissionLevel: 1,
      businessVolume: 20000,
      percentage: 25,
      grossCommissionAmount: 5000,
    });

    expect(earned.status).toBe('EARNED');

    // Attempting to fund should NOT delete or throw an unhandled error
    const fundResult = await TreasuryCommissionService.fundAndReserveCommission(earned.commissionId);

    expect(fundResult.isFunded).toBe(false);
    expect(fundResult.newStatus).toBe('EARNED');
    expect(fundResult.reason).toContain('Insufficient treasury available liquidity');

    // The earned commission record MUST still exist and remain safe in the database!
    const commissionRecord = await prisma.commissionTransaction.findUnique({
      where: { id: earned.commissionId },
    });
    expect(commissionRecord).not.toBeNull();
    expect(Number(commissionRecord?.grossCommissionAmount)).toBe(5000);
    expect(commissionRecord?.status).toBe('PENDING'); // Database representation of EARNED
  });

  // ==========================================================================
  // SECTION 2: SAFE FLOW (TREASURY -> RESERVE -> COMMISSION -> WALLET -> PAYOUT)
  // ==========================================================================

  it('should execute the full safe flow from Platform Treasury to Member Wallet to Withdrawal', async () => {
    // 1. Fund the company treasury with 50,000 INR
    await PlatformTreasuryService.creditTreasury({
      amount: 50000,
      referenceType: 'CORPORATE_FUNDING',
      description: 'RazorpayX Corporate Deposit',
    });

    const treasuryBefore = await PlatformTreasuryService.getTreasuryBalance();
    expect(treasuryBefore.availableBalance).toBe(50000);

    // 2. Member earns commission (2,400 INR)
    const earned = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'order-flow-1',
      recipientMemberId: 'dist-flow',
      sourceMemberId: 'dist-downline',
      commissionLevel: 1,
      businessVolume: 10000,
      percentage: 24,
      grossCommissionAmount: 2400,
    });
    expect(earned.status).toBe('EARNED');

    // 3. Fund and reserve commission from Treasury Reserve
    const fundResult = await TreasuryCommissionService.fundAndReserveCommission(earned.commissionId);
    expect(fundResult.isFunded).toBe(true);
    expect(fundResult.newStatus).toBe('AVAILABLE');
    expect(fundResult.platformTransactionNumber).toBeDefined();
    expect(fundResult.memberWalletTransactionNumber).toBeDefined();

    // Verify Platform Treasury was deducted and ledger entry was created
    const treasuryAfterReserve = await PlatformTreasuryService.getTreasuryBalance();
    expect(treasuryAfterReserve.availableBalance).toBe(47600); // 50000 - 2400

    const platformTxList = await prisma.platformWalletTransaction.findMany();
    const reserveTx = platformTxList.find((t) => t.type === 'COMMISSION_RESERVE');
    expect(reserveTx).toBeDefined();
    expect(Number(reserveTx?.amount)).toBe(2400);

    // Verify Member Wallet availableBalance was credited
    const memberWallet = await prisma.wallet.findFirst({ where: { distributorId: 'dist-flow' } });
    expect(Number(memberWallet?.availableBalance)).toBe(2400);

    // 4. Member requests a payout/withdrawal of 2,000 INR
    const payoutRecord = {
      id: 'payout-101',
      payoutNumber: 'PO-10001',
      distributorId: 'dist-flow',
      amount: new Prisma.Decimal(2000),
      netAmount: new Prisma.Decimal(1950),
      fee: new Prisma.Decimal(50),
      status: 'UNDER_REVIEW',
      bankAccountId: 'bank-1',
      bankAccount: { id: 'bank-1', status: 'VERIFIED' },
      distributor: { id: 'dist-flow', wallets: [memberWallet] },
    };
    inMemoryPayouts.set(payoutRecord.id, payoutRecord);

    // Put funds on hold in member wallet
    await prisma.wallet.update({
      where: { id: memberWallet!.id },
      data: {
        availableBalance: new Prisma.Decimal(400), // 2400 - 2000
        pendingBalance: { decrement: new Prisma.Decimal(-2000) }, // +2000 hold
      },
    });

    // 5. Check payout eligibility against Platform Treasury
    const eligibility = await TreasuryCommissionService.checkPayoutEligibility('payout-101');
    expect(eligibility.isEligible).toBe(true);
    expect(eligibility.canPlatformDisburse).toBe(true);

    // 6. Execute payout disbursement from Platform Treasury
    const payoutResult = await TreasuryCommissionService.executePayout({
      payoutId: 'payout-101',
      adminUserId: 'admin-super',
      referenceNumber: 'UTR-BANK-998877',
    });

    expect(payoutResult.status).toBe('PAID');
    expect(payoutResult.disbursedAmount).toBe(2000);
    expect(payoutResult.platformTransactionNumber).toBeDefined();

    // Verify Platform Treasury was debited with PAYOUT
    const finalTreasury = await PlatformTreasuryService.getTreasuryBalance();
    expect(finalTreasury.availableBalance).toBe(45650); // 47600 - 1950 net payout

    const payoutTx = (await prisma.platformWalletTransaction.findMany()).find((t) => t.type === 'PAYOUT');
    expect(payoutTx).toBeDefined();
    expect(Number(payoutTx?.amount)).toBe(1950);
  });

  // ==========================================================================
  // SECTION 3: REPLENISHMENT & BATCH RESERVING (FIFO)
  // ==========================================================================

  it('should batch fund deferred commissions once treasury is replenished', async () => {
    // Treasury starts empty (0 INR)
    await PlatformTreasuryService.getOrCreatePlatformWallet();

    // 3 commissions earned
    const c1 = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-batch-1',
      recipientMemberId: 'dist-a',
      sourceMemberId: 'buyer-1',
      commissionLevel: 1,
      businessVolume: 5000,
      percentage: 20,
      grossCommissionAmount: 1000,
    });

    const c2 = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-batch-2',
      recipientMemberId: 'dist-b',
      sourceMemberId: 'buyer-2',
      commissionLevel: 1,
      businessVolume: 5000,
      percentage: 20,
      grossCommissionAmount: 1000,
    });

    const c3 = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-batch-3',
      recipientMemberId: 'dist-c',
      sourceMemberId: 'buyer-3',
      commissionLevel: 1,
      businessVolume: 5000,
      percentage: 20,
      grossCommissionAmount: 1000,
    });

    // Replenish treasury with 2,500 INR (enough for 2 commissions, but not all 3)
    await PlatformTreasuryService.creditTreasury({
      amount: 2500,
      referenceType: 'REPLENISHMENT',
      description: 'Treasury injection',
    });

    // Execute batch reserving
    const batchResult = await TreasuryCommissionService.batchFundCommissions({ limit: 10 });

    expect(batchResult.totalEvaluated).toBe(3);
    expect(batchResult.fundedCount).toBe(2); // c1 and c2 funded
    expect(batchResult.deferredCount).toBe(1); // c3 deferred
    expect(batchResult.totalFundedAmount).toBe(2000);
    expect(batchResult.remainingTreasuryAvailable).toBe(500); // 2500 - 2000

    // c1 and c2 are AVAILABLE
    const rec1 = await prisma.commissionTransaction.findUnique({ where: { id: c1.commissionId } });
    const rec2 = await prisma.commissionTransaction.findUnique({ where: { id: c2.commissionId } });
    const rec3 = await prisma.commissionTransaction.findUnique({ where: { id: c3.commissionId } });

    expect(rec1?.status).toBe('AVAILABLE');
    expect(rec2?.status).toBe('AVAILABLE');
    expect(rec3?.status).toBe('PENDING'); // c3 still safe in EARNED/PENDING
  });

  // ==========================================================================
  // SECTION 4: SEPARATE ACCOUNTING CONCEPTS (TREASURY RESERVE VS COMMISSION PAYABLE)
  // ==========================================================================

  it('should accurately calculate Treasury Reserve, Commission Payable, and Solvency', async () => {
    // Treasury has 10,000 INR
    await PlatformTreasuryService.creditTreasury({
      amount: 10000,
      referenceType: 'INITIAL',
      description: 'Company Initial Reserve',
    });

    // Commission 1: 3,000 INR earned & reserved (AVAILABLE)
    const c1 = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-acc-1',
      recipientMemberId: 'dist-x',
      sourceMemberId: 'buyer-x',
      commissionLevel: 1,
      businessVolume: 15000,
      percentage: 20,
      grossCommissionAmount: 3000,
    });
    await TreasuryCommissionService.fundAndReserveCommission(c1.commissionId);

    // Commission 2: 2,000 INR earned but NOT yet reserved (EARNED)
    await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-acc-2',
      recipientMemberId: 'dist-y',
      sourceMemberId: 'buyer-y',
      commissionLevel: 1,
      businessVolume: 10000,
      percentage: 20,
      grossCommissionAmount: 2000,
    });

    const summary = await TreasuryCommissionService.getAccountingSummary();

    expect(summary.platformTreasury.availableBalance).toBe(7000); // 10000 - 3000 reserved
    expect(summary.platformTreasury.reservedBalance).toBe(3000); // 3000 reserved

    // Commission Payables (Platform Liabilities)
    expect(summary.commissionPayables.unfundedEarnedLiability).toBe(2000);
    expect(summary.commissionPayables.fundedAvailableLiability).toBe(3000);
    expect(summary.commissionPayables.totalOutstandingPayable).toBe(5000); // 2000 + 3000

    // Solvency
    expect(summary.isSolvent).toBe(true);
    expect(summary.coverageMetrics.totalSolvencyRatio).toBe(1.4); // 7000 / 5000
    expect(summary.healthStatus).toBe('MODERATE_RESERVE');
  });

  // ==========================================================================
  // SECTION 5: COMMISSION REVERSAL & TREASURY RESTORATION
  // ==========================================================================

  it('should reverse commission, release treasury reserve, and deduct member wallet', async () => {
    // Treasury with 10,000 INR
    await PlatformTreasuryService.creditTreasury({
      amount: 10000,
      referenceType: 'FLOAT',
      description: 'Float',
    });

    // Earn & fund commission (2,000 INR)
    const earned = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-rev-1',
      recipientMemberId: 'dist-rev',
      sourceMemberId: 'buyer-rev',
      commissionLevel: 1,
      businessVolume: 10000,
      percentage: 20,
      grossCommissionAmount: 2000,
    });
    await TreasuryCommissionService.fundAndReserveCommission(earned.commissionId);

    const treasuryMid = await PlatformTreasuryService.getTreasuryBalance();
    expect(treasuryMid.availableBalance).toBe(8000);

    // Reverse the commission due to order return
    const revResult = await TreasuryCommissionService.reverseCommissionWithTreasury(
      earned.commissionId,
      'Customer returned order goods within 14-day policy'
    );

    expect(revResult.status).toBe('REVERSED');
    expect(revResult.reserveReleased).toBe(true);
    expect(revResult.memberBalanceAdjusted).toBe(true);

    // Treasury available balance restored to 10,000 INR
    const treasuryFinal = await PlatformTreasuryService.getTreasuryBalance();
    expect(treasuryFinal.availableBalance).toBe(10000);

    // Member wallet available balance deducted back to 0
    const memberWallet = await prisma.wallet.findFirst({ where: { distributorId: 'dist-rev' } });
    expect(Number(memberWallet?.availableBalance)).toBe(0);
  });

  // ==========================================================================
  // SECTION 6: STRICT 6-STATUS LIFECYCLE STATE MACHINE
  // ==========================================================================

  it('should enforce proper transitions between EARNED, APPROVED, AVAILABLE, PAYOUT_PENDING, PAID, REVERSED', async () => {
    await PlatformTreasuryService.creditTreasury({
      amount: 10000,
      referenceType: 'FLOAT',
      description: 'Float',
    });

    const earned = await TreasuryCommissionService.recordEarnedCommission({
      orderId: 'ord-sm-1',
      recipientMemberId: 'dist-sm',
      sourceMemberId: 'buyer-sm',
      commissionLevel: 1,
      businessVolume: 5000,
      percentage: 20,
      grossCommissionAmount: 1000,
    });

    // 1. EARNED -> APPROVED
    const toApproved = await TreasuryCommissionService.transitionStatus(earned.commissionId, 'APPROVED');
    expect(toApproved.newStatus).toBe('APPROVED');

    // 2. APPROVED -> AVAILABLE (funds from treasury)
    const toAvailable = await TreasuryCommissionService.transitionStatus(earned.commissionId, 'AVAILABLE');
    expect(toAvailable.newStatus).toBe('AVAILABLE');

    // 3. AVAILABLE -> PAYOUT_PENDING
    const toPending = await TreasuryCommissionService.transitionStatus(earned.commissionId, 'PAYOUT_PENDING');
    expect(toPending.newStatus).toBe('PAYOUT_PENDING');

    // 4. PAYOUT_PENDING -> PAID
    const toPaid = await TreasuryCommissionService.transitionStatus(earned.commissionId, 'PAID');
    expect(toPaid.newStatus).toBe('PAID');

    // 5. PAID -> REVERSED (clawback)
    const toReversed = await TreasuryCommissionService.transitionStatus(earned.commissionId, 'REVERSED', 'Post-payout chargeback');
    expect(toReversed.newStatus).toBe('REVERSED');

    // 6. REVERSED is terminal -> cannot transition out
    await expect(
      TreasuryCommissionService.transitionStatus(earned.commissionId, 'AVAILABLE')
    ).rejects.toThrow(AppError);
  });
});
