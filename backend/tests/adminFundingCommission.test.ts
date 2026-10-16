import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../src/config/database';
import { AdminFundingCommissionService } from '../src/services/adminFundingCommission.service';
import { CumulativeRankCommissionService } from '../src/services/cumulativeRankCommission.service';
import { authorizeRoles } from '../src/middleware/role';

describe('Admin Funding Portal & One-Click Commission Distribution Test Suite', () => {
  const createMockDistributor = (overrides?: any) => ({
    id: 'dist-001',
    distributorCode: 'EMP-001',
    distributorId: 'EMP-001',
    firstName: 'Arjun',
    lastName: 'Sharma',
    displayName: 'Arjun Sharma',
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    lifetimePV: 1000,
    currentBB: 500,
    currentMatching: 2500,
    sponsorId: 'SPONSOR-100',
    sponsor: {
      id: 'dist-sp-100',
      distributorCode: 'SPONSOR-100',
      distributorId: 'SPONSOR-100',
      firstName: 'Rahul',
      lastName: 'Kaushal',
      user: { fullName: 'Rahul Kaushal' },
    },
    currentLevel: { code: 'GOLD', name: 'Gold' },
    currentRank: { rankCode: 'GOLD', name: 'Gold' },
    highestRank: { rankCode: 'GOLD', name: 'Gold' },
    wallet: { id: 'wallet-001', balance: 5000, availableBalance: 5000, lockedBalance: 0 },
    user: { id: 'usr-001', email: 'arjun@kashvi.com', fullName: 'Arjun Sharma', role: 'DISTRIBUTOR', status: 'ACTIVE' },
    ...overrides,
  });

  const createMockCommission = (overrides?: any) => ({
    id: 'comm-001',
    distributorId: 'dist-001',
    sourceOrderId: 'ORDER-999',
    businessReference: 'ORDER-999',
    commissionNumber: 'COMM-1001',
    amount: 1500,
    status: 'APPROVED',
    leftVolumeMatched: 6000,
    rightVolumeMatched: 6000,
    details: {
      orderId: 'ORDER-999',
      orderNumber: 'ORD-2026-001',
      purchaseAmount: 10000,
      eligibleBaseAmount: 10000,
      qualifyingBV: 500,
      rankCode: 'GOLD',
      rankName: 'Gold',
      percentage: 8,
      commissionTier: 'GOLD',
      transactionDate: '2026-10-15T10:00:00.000Z',
    },
    distributor: createMockDistributor(),
    createdAt: new Date('2026-10-15T10:00:00.000Z'),
    updatedAt: new Date('2026-10-15T10:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    CumulativeRankCommissionService.resetState();

    // Reset mutex lock on service
    (AdminFundingCommissionService as any).isDistributing = false;
    (AdminFundingCommissionService as any).lastDistributionTime = 0;

    // Default mock for prisma.$transaction: synchronous runner
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Provide default resolved mocks for all Prisma models
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(createMockDistributor() as any);
    vi.spyOn(prisma.distributorProfile, 'findMany').mockResolvedValue([createMockDistributor()] as any);
    vi.spyOn(prisma.distributorProfile, 'count').mockResolvedValue(1);

    vi.spyOn(prisma.commission, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.commission, 'findMany').mockResolvedValue([createMockCommission()] as any);
    vi.spyOn(prisma.commission, 'update').mockImplementation(async ({ data }: any) => ({
      id: 'comm-001',
      ...data,
      updatedAt: new Date(),
    }));
    vi.spyOn(prisma.commission, 'updateMany').mockResolvedValue({ count: 1 } as any);

    vi.spyOn(prisma.order, 'findMany').mockResolvedValue([
      { totalAmount: 100000 },
    ] as any);

    vi.spyOn(prisma.wallet, 'findUnique').mockResolvedValue({
      id: 'wallet-001',
      distributorId: 'dist-001',
      balance: 5000,
      availableBalance: 5000,
      lockedBalance: 0,
      currency: 'INR',
    } as any);
    vi.spyOn(prisma.wallet, 'update').mockResolvedValue({
      id: 'wallet-001',
      balance: 6500,
      availableBalance: 6500,
      lockedBalance: 0,
    } as any);

    vi.spyOn(prisma.walletTransaction, 'create').mockResolvedValue({
      id: 'wtx-001',
      walletId: 'wallet-001',
      amount: 1500,
      balanceAfter: 6500,
      type: 'COMMISSION_PAYOUT',
      description: 'Commission payout',
      createdAt: new Date(),
    } as any);

    vi.spyOn(prisma.payoutBatch, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.payoutBatch, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.payoutBatch, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'pb-001',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn(prisma.payoutBatch, 'update').mockImplementation(async ({ data }: any) => ({
      id: 'pb-001',
      ...data,
    }));

    vi.spyOn(prisma.payoutBatchItem, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.payoutBatchItem, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.payoutBatchItem, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'pbi-001',
      ...data,
    }));
    vi.spyOn(prisma.payoutBatchItem, 'update').mockImplementation(async ({ data }: any) => ({
      id: 'pbi-001',
      ...data,
    }));

    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({
      id: 'audit-001',
      action: 'COMMISSION_DISTRIBUTION',
      createdAt: new Date(),
    } as any);
  });

  describe('1. Admin Authorization & Server-Side RBAC Enforcement', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', () => {
      const middleware = authorizeRoles('SUPER_ADMIN', 'ADMIN');
      const req: any = {};
      const res: any = {};
      let nextError: any = null;

      middleware(req, res, (err: any) => {
        nextError = err;
      });

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(401);
      expect(nextError.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('should reject non-admin distributor requests with 403 Forbidden', () => {
      const middleware = authorizeRoles('SUPER_ADMIN', 'ADMIN');
      const req: any = {
        user: { id: 'usr-dist', role: 'DISTRIBUTOR', status: 'ACTIVE' },
      };
      const res: any = {};
      let nextError: any = null;

      middleware(req, res, (err: any) => {
        nextError = err;
      });

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(403);
      expect(nextError.code).toBe('AUTH_FORBIDDEN');
    });

    it('should reject customer role requests with 403 Forbidden', () => {
      const middleware = authorizeRoles('SUPER_ADMIN', 'ADMIN');
      const req: any = {
        user: { id: 'usr-cust', role: 'CUSTOMER', status: 'ACTIVE' },
      };
      const res: any = {};
      let nextError: any = null;

      middleware(req, res, (err: any) => {
        nextError = err;
      });

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(403);
    });

    it('should allow authorized ADMIN and SUPER_ADMIN users without error', () => {
      const middleware = authorizeRoles('SUPER_ADMIN', 'ADMIN');
      const reqAdmin: any = {
        user: { id: 'usr-adm', role: 'ADMIN', status: 'ACTIVE' },
      };
      const res: any = {};
      let adminPassed = false;

      middleware(reqAdmin, res, (err: any) => {
        if (!err) adminPassed = true;
      });

      expect(adminPassed).toBe(true);

      const reqSuperAdmin: any = {
        user: { id: 'usr-sadmin', role: 'SUPER_ADMIN', status: 'ACTIVE' },
      };
      let superAdminPassed = false;

      middleware(reqSuperAdmin, res, (err: any) => {
        if (!err) superAdminPassed = true;
      });

      expect(superAdminPassed).toBe(true);
    });
  });

  describe('2. Daily Financial Summary & Strict Financial Distinction', () => {
    it('should aggregate 9 summary metrics and preserve distinct financial buckets', async () => {
      const summary = await AdminFundingCommissionService.getDailyFinancialSummary({});

      expect(summary).toBeDefined();
      expect(summary.totalEmployees).toBeGreaterThanOrEqual(1);
      expect(summary.totalQualifyingBV).toBe(500);
      expect(summary.totalPaymentVolume).toBe(100000);
      expect(summary.totalApprovedCommissions).toBe(1500);

      // Verify Strict Financial Distinction Banner items
      expect(summary.financialDistinction).toBeDefined();
      expect(summary.financialDistinction.orderPaymentVolume).toBe(100000);
      expect(summary.financialDistinction.businessVolumeBV).toBe(500);
      expect(summary.financialDistinction.commissionLiability).toBe(1500);
      // In digital wallet mode, internal wallet credits must not claim external bank transfer
      expect(summary.financialDistinction.bankPayoutsSettled).toBe(0);
    });

    it('should filter summary metrics by date range', async () => {
      const orderSpy = vi.spyOn(prisma.order, 'findMany');
      await AdminFundingCommissionService.getDailyFinancialSummary({
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      });

      expect(orderSpy).toHaveBeenCalled();
    });
  });

  describe('3. Employee-Wise Daily Commission Report (23 Columns)', () => {
    it('should generate a 23-column day-by-day record with summary totals', async () => {
      const report = await AdminFundingCommissionService.getEmployeeDailyCommissionReport({
        page: 1,
        limit: 10,
      });

      expect(report.records.length).toBe(1);
      const record = report.records[0];

      // Verify essential 23 columns
      expect(record.employeeId).toBe('EMP-001');
      expect(record.employeeName).toBe('Arjun Sharma');
      expect(record.sponsorId).toBe('SPONSOR-100');
      expect(record.currentRank).toBe('GOLD');
      expect(record.orderReference).toBe('ORDER-999');
      expect(record.paymentStatus).toBe('PAID');
      expect(record.purchaseAmount).toBe(10000);
      expect(record.qualifyingBV).toBe(500);
      expect(record.leftMatchingVolume).toBe(6000);
      expect(record.rightMatchingVolume).toBe(6000);
      expect(record.commissionTier).toBe('Gold (8%)');
      expect(record.commissionPercentage).toBe(8);
      expect(record.eligibleCommissionBase).toBe(10000);
      expect(record.commissionAmount).toBe(1500);
      expect(record.approvedCommission).toBe(1500);

      // Verify summary totals
      expect(report.summaryTotals).toBeDefined();
      expect(report.summaryTotals.totalCalculatedAmount).toBe(1500);
      expect(report.summaryTotals.totalPurchaseAmount).toBe(10000);
      expect(report.summaryTotals.totalQualifyingBV).toBe(500);
    });

    it('should filter report by rank and status', async () => {
      const commSpy = vi.spyOn(prisma.commission, 'findMany');
      await AdminFundingCommissionService.getEmployeeDailyCommissionReport({
        rank: 'GOLD',
        status: 'APPROVED',
      });

      expect(commSpy).toHaveBeenCalled();
    });

    it('should generate RFC-4180 compliant CSV with 23 header columns', async () => {
      const csv = await AdminFundingCommissionService.exportDailyCommissionReportCsv({});

      expect(csv).toContain('Employee ID,Employee Name,Sponsor ID,Current Rank');
      expect(csv).toContain('Purchase Amount (INR),Qualifying BV,Left Matching Volume');
      expect(csv).toContain('"EMP-001","Arjun Sharma","SPONSOR-100","GOLD"');
    });
  });

  describe('4. One-Click Commission Distribution Preview & Starter Kit Gating', () => {
    it('should include only active members with verified Starter Kit payment in preview', async () => {
      // Setup: 1 paid member and 1 unpaid starter kit member
      const paidMember = createMockDistributor({ id: 'dist-paid', distributorCode: 'EMP-PAID', paymentStatus: 'PAID' });
      const unpaidMember = createMockDistributor({ id: 'dist-unpaid', distributorCode: 'EMP-UNPAID', paymentStatus: 'PENDING' });

      vi.spyOn(prisma.distributorProfile, 'findMany').mockResolvedValue([paidMember, unpaidMember] as any);

      const commPaid = createMockCommission({
        id: 'comm-p1',
        distributorId: 'dist-paid',
        distributor: paidMember,
        amount: 2000,
        status: 'APPROVED',
      });
      const commUnpaid = createMockCommission({
        id: 'comm-u1',
        distributorId: 'dist-unpaid',
        distributor: unpaidMember,
        amount: 800,
        status: 'APPROVED',
      });

      vi.spyOn(prisma.commission, 'findMany').mockResolvedValue([commPaid, commUnpaid] as any);

      const preview = await AdminFundingCommissionService.getDistributionPreview();

      // Unpaid starter kit member must be excluded from payout!
      expect(preview.eligibleEmployeeCount).toBe(1);
      expect(preview.totalCommissionAmount).toBe(2000);
      expect(preview.excludedCommissionsAmount).toBe(800);
    });
  });

  describe('5. One-Click Distribution Execution & Idempotency', () => {
    it('should atomically credit member wallet and prevent duplicate payout runs', async () => {
      const walletUpdateSpy = vi.spyOn(prisma.wallet, 'update');
      const wtxCreateSpy = vi.spyOn(prisma.walletTransaction, 'create');
      const commUpdateSpy = vi.spyOn(prisma.commission, 'updateMany');

      const result = await AdminFundingCommissionService.executeOneClickDistribution('admin-user-001', {});

      expect(result).toBeDefined();
      expect(result.batchNumber).toMatch(/^PB-/);
      expect(result.successfulCount).toBe(1);
      expect(result.successfulAmount).toBe(1500);
      expect(result.failedCount).toBe(0);
      expect(result.status).toBe('COMPLETED');

      // Member wallet was credited
      expect(walletUpdateSpy).toHaveBeenCalled();
      const walletCallArg = walletUpdateSpy.mock.calls[0][0];
      expect(walletCallArg.where.id).toBe('wallet-001');
      expect(Number(walletCallArg.data.balance)).toBe(6500);

      // Wallet transaction recorded
      expect(wtxCreateSpy).toHaveBeenCalled();
      const wtxCallArg = wtxCreateSpy.mock.calls[0][0];
      expect(wtxCallArg.data.walletId).toBe('wallet-001');
      expect(wtxCallArg.data.type).toBe('COMMISSION_CREDIT');
      expect(Number(wtxCallArg.data.amount)).toBe(1500);

      // Commissions transitioned to PAID
      expect(commUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
          }),
        })
      );
    });

    it('should reject simultaneous double-click distribution runs via mutex guard', async () => {
      // Simulate an active distribution run in progress
      (AdminFundingCommissionService as any).isDistributing = true;

      await expect(
        AdminFundingCommissionService.executeOneClickDistribution('admin-user-001', {})
      ).rejects.toThrow('A commission distribution batch is currently executing');
    });

    it('should enforce cooldown if initiated within cooldown threshold', async () => {
      (AdminFundingCommissionService as any).isDistributing = false;
      (AdminFundingCommissionService as any).lastDistributionTime = Date.now();

      await expect(
        AdminFundingCommissionService.executeOneClickDistribution('admin-user-001', {})
      ).rejects.toThrow('Commission distribution was just initiated a few seconds ago');
    });
  });

  describe('6. Partial Batch Failure & Safe Retry Without Double-Payment', () => {
    it('should safely retry ONLY failed payout items and skip already successful members', async () => {
      const batchId = 'batch-failed-001';

      // Setup an existing batch
      const mockBatch = {
        id: batchId,
        batchNumber: 'PB-FAILED-100',
        totalEmployees: 2,
        successfulCount: 1,
        failedCount: 1,
        totalAmount: 3000,
        successfulAmount: 1500,
        failedAmount: 1500,
        status: 'PARTIALLY_FAILED',
      };

      const failedItem = {
        id: 'item-fail-001',
        batchId,
        distributorId: 'dist-fail',
        distributorCode: 'EMP-FAIL',
        distributorName: 'Failed Member',
        amount: 1500,
        status: 'FAILED',
        commissionIds: ['comm-f1'],
      };

      vi.spyOn(prisma.payoutBatch, 'findFirst').mockResolvedValue(mockBatch as any);
      vi.spyOn(prisma.payoutBatchItem, 'findMany').mockResolvedValue([failedItem] as any);

      vi.spyOn(prisma.wallet, 'findUnique').mockResolvedValue({
        id: 'wallet-fail-001',
        distributorId: 'dist-fail',
        balance: 1000,
        availableBalance: 1000,
      } as any);

      const walletUpdateSpy = vi.spyOn(prisma.wallet, 'update');
      const itemUpdateSpy = vi.spyOn(prisma.payoutBatchItem, 'update');

      const retryResult = await AdminFundingCommissionService.retryFailedBatchPayouts(batchId, 'admin-user-001');

      expect(retryResult.batchId).toBe(batchId);
      expect(retryResult.newlySucceededCount).toBe(1);
      expect(retryResult.stillFailedCount).toBe(0);

      // Verify that the failed member wallet was credited
      expect(walletUpdateSpy).toHaveBeenCalled();
      // Verify that the batch item was updated to SUCCESS
      expect(itemUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-fail-001' },
          data: expect.objectContaining({ status: 'SUCCESS' }),
        })
      );
    });
  });
});
