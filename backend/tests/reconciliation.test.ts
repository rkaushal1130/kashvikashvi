import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { MLMReconciliationService } from '../src/services/mlmReconciliation.service';
import { LevelService } from '../src/services/level.service';
import { MatchingService } from '../src/services/matching.service';
import { BBService } from '../src/services/bb.service';
import { logger } from '../src/config/logger';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 10: MLM RECONCILIATION AND RECALCULATION ENGINE', () => {
  const adminToken = createAdminToken();
  const memberToken = createTestToken({
    id: 'usr-member-recon-001',
    email: 'distributor@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });
  const customerToken = createCustomerToken();

  const mockMemberId = 'dist-recon-001';

  const createMockDistributor = (overrides?: any) => ({
    id: mockMemberId,
    distributorCode: 'KV-RECON-001',
    distributorId: 'KV-RECON-001',
    userId: 'usr-member-recon-001',
    firstName: 'Audit',
    lastName: 'Tester',
    displayName: 'Audit Tester',
    currentBB: 0,
    currentMatching: 0,
    lifetimePV: 0,
    currentLevelId: null,
    currentRankId: null,
    currentLevel: null,
    currentRank: null,
    highestRank: null,
    businessCenters: [
      {
        id: 'bc-recon-1',
        accumulatedLeftVolume: 0,
        accumulatedRightVolume: 0,
        leftVolume: 0,
        rightVolume: 0,
      },
    ],
    user: { id: 'usr-member-recon-001', firstName: 'Audit', lastName: 'Tester' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock interactive transactions so tests execute synchronously without hanging
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        return callback(prisma);
      }
      return callback;
    });

    // Provide default resolved mocks for Prisma models so tests never hang trying to connect to port 5432
    vi.spyOn((prisma as any).level, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).level, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).level, 'create').mockImplementation(async ({ data }: any) => ({
      id: `lvl-${data.code}`,
      ...data,
    }));

    vi.spyOn(prisma.rank, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.rank, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.rank, 'create').mockImplementation(async ({ data }: any) => ({
      id: `rnk-${data.rankCode}`,
      ...data,
    }));

    vi.spyOn(prisma.distributorProfile, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async ({ where }: any) => {
      const id = where?.id || where?.OR?.[0]?.id || mockMemberId;
      return createMockDistributor({ id }) as any;
    });
    vi.spyOn(prisma.distributorProfile, 'findUnique').mockImplementation(async ({ where }: any) => {
      const id = where?.id || mockMemberId;
      return createMockDistributor({ id }) as any;
    });
    vi.spyOn(prisma.distributorProfile, 'count').mockResolvedValue(1);

    vi.spyOn(prisma.distributorRankHistory, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.notification, 'create').mockResolvedValue({} as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    vi.spyOn((prisma as any).memberLevelHistory, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).memberLevelHistory, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).memberLevelHistory, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'hist-recon-001',
      ...data,
    }));

    vi.spyOn((prisma as any).reconciliationAudit, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'audit-recon-001',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).reconciliationAudit, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).reconciliationAudit, 'count').mockResolvedValue(0);

    // Mock BB and Matching transaction ledger calls
    vi.spyOn((prisma as any).bBTransaction, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).bBTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn((prisma as any).bBTransaction, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).bBTransaction, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'bb-tx-mock',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).bBTransaction, 'count').mockResolvedValue(0);
    vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    vi.spyOn((prisma as any).matchingTransaction, 'findFirst').mockResolvedValue(null);
    vi.spyOn((prisma as any).matchingTransaction, 'findUnique').mockResolvedValue(null);
    vi.spyOn((prisma as any).matchingTransaction, 'findMany').mockResolvedValue([]);
    vi.spyOn((prisma as any).matchingTransaction, 'create').mockImplementation(async ({ data }: any) => ({
      id: 'matching-tx-mock',
      ...data,
      createdAt: new Date(),
    }));
    vi.spyOn((prisma as any).matchingTransaction, 'count').mockResolvedValue(0);
    vi.spyOn((prisma as any).matchingTransaction, 'aggregate').mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    vi.spyOn(prisma.commission, 'aggregate').mockResolvedValue({
      _sum: { leftVolumeMatched: null },
    } as any);

    vi.spyOn(prisma.bVLedger, 'aggregate').mockResolvedValue({
      _sum: { bv: null },
    } as any);
    vi.spyOn(prisma.bVLedger, 'create').mockResolvedValue({} as any);
  });

  // =========================================================================
  // 1. RECALCULATE MEMBER TESTS
  // =========================================================================
  describe('1. recalculateMember(memberId)', () => {
    it('should recalculate BB from authoritative ledger and detect BB discrepancy', async () => {
      // Profile has stale BB = 100, but ledger has 3 transactions totaling 350 BB
      const dist = createMockDistributor({ currentBB: 100, currentMatching: 0 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 350 },
        _count: { id: 3 },
      });

      const updateSpy = vi.spyOn(prisma.distributorProfile, 'update');

      const result = await MLMReconciliationService.recalculateMember(dist.id, {
        actor: 'admin@kashvimlm.com',
        reason: 'Monthly Audit',
      });

      expect(result.oldBB).toBe(100);
      expect(result.calculatedBB).toBe(350);
      expect(result.bbDiscrepancy).toBe(250); // 350 - 100 = +250
      expect(result.hasDiscrepancy).toBe(true);
      expect(result.discrepancyDetails.bbMismatch).toBe(true);
      expect(result.actor).toBe('admin@kashvimlm.com');

      // Profile derived totals updated to match authoritative ledger
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dist.id },
          data: expect.objectContaining({
            currentBB: expect.anything(),
          }),
        })
      );
    });

    it('should recalculate Left Volume, Right Volume, and Matching from tree data', async () => {
      // Profile has stale matching = 10,000, but authoritative tree has Left = 40,000, Right = 35,000
      const dist = createMockDistributor({
        currentBB: 500,
        currentMatching: 10000,
        businessCenters: [
          {
            id: 'bc-1',
            accumulatedLeftVolume: 40000,
            accumulatedRightVolume: 35000,
          },
        ],
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      vi.spyOn(MatchingService, 'getLeftVolume').mockResolvedValue(40000);
      vi.spyOn(MatchingService, 'getRightVolume').mockResolvedValue(35000);
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(35000);

      const result = await MLMReconciliationService.recalculateMember(dist.id);

      expect(result.oldLeftVolume).toBe(40000);
      expect(result.calculatedLeftVolume).toBe(40000);
      expect(result.oldRightVolume).toBe(35000);
      expect(result.calculatedRightVolume).toBe(35000);
      expect(result.oldMatching).toBe(10000);
      expect(result.calculatedMatching).toBe(35000);
      expect(result.matchingDiscrepancy).toBe(25000); // 35000 - 10000
      expect(result.hasDiscrepancy).toBe(true);
    });

    it('should recalculate eligible level and promote member when newly qualified', async () => {
      // Member currently at BASE level, but ledger proves BB = 250 and Matching = 2000 (qualifies for SILVER)
      const dist = createMockDistributor({
        currentBB: 0,
        currentMatching: 0,
        currentLevel: null,
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 250 },
        _count: { id: 1 },
      });
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      const promoteSpy = vi.spyOn(LevelService, 'promoteMember').mockResolvedValue({
        memberId: dist.id,
        distributorCode: 'KV-RECON-001',
        promoted: true,
        previousLevel: { order: 0, code: 'BASE', name: 'Base' } as any,
        newLevel: { order: 1, code: 'SILVER', name: 'Silver' } as any,
        snapshot: { qualifiedBB: 250, qualifiedMatching: 2000, timestamp: new Date() },
        message: 'Promoted to Silver',
      });

      const result = await MLMReconciliationService.recalculateMember(dist.id, {
        actor: 'SYSTEM_AUDIT',
      });

      expect(result.oldLevel.code).toBe('BASE');
      expect(result.calculatedLevel.code).toBe('SILVER');
      expect(result.promoted).toBe(true);
      expect(promoteSpy).toHaveBeenCalledWith(
        dist.id,
        expect.objectContaining({
          source: 'RECONCILIATION',
          overrideBB: 250,
          overrideMatching: 2000,
        }),
        expect.anything()
      );
    });

    it('should return clean audit with no discrepancies when profile matches ledger', async () => {
      // Profile already perfectly reflects ledger (BB = 500, Matching = 50,000, Level = PLATINUM)
      const dist = createMockDistributor({
        currentBB: 500,
        currentMatching: 50000,
        currentLevel: { code: 'PLATINUM', name: 'Platinum', order: 3 },
      });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 500 },
        _count: { id: 2 },
      });
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(50000);

      const result = await MLMReconciliationService.recalculateMember(dist.id);

      expect(result.oldBB).toBe(500);
      expect(result.calculatedBB).toBe(500);
      expect(result.bbDiscrepancy).toBe(0);
      expect(result.oldMatching).toBe(50000);
      expect(result.calculatedMatching).toBe(50000);
      expect(result.matchingDiscrepancy).toBe(0);
      expect(result.oldLevel.code).toBe('PLATINUM');
      expect(result.calculatedLevel.code).toBe('PLATINUM');
      expect(result.hasDiscrepancy).toBe(false);
      expect(result.promoted).toBe(false);
    });

    it('should respect dryRun mode without updating database profile or awarding promotion', async () => {
      const dist = createMockDistributor({ currentBB: 0, currentMatching: 0 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 1000 },
        _count: { id: 1 },
      });
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(100000);

      const updateSpy = vi.spyOn(prisma.distributorProfile, 'update');
      const promoteSpy = vi.spyOn(LevelService, 'promoteMember');
      const auditCreateSpy = vi.spyOn((prisma as any).reconciliationAudit, 'create');

      const result = await MLMReconciliationService.recalculateMember(dist.id, {
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.calculatedBB).toBe(1000);
      expect(result.calculatedMatching).toBe(100000);
      expect(result.calculatedLevel.code).toBe('RUBY');
      expect(result.hasDiscrepancy).toBe(true);

      // Verify DRY RUN: No DB mutations
      expect(updateSpy).not.toHaveBeenCalled();
      expect(promoteSpy).not.toHaveBeenCalled();
      expect(auditCreateSpy).not.toHaveBeenCalled();
    });

    it('should log structured warnings whenever discrepancies are detected', async () => {
      const dist = createMockDistributor({ currentBB: 50, currentMatching: 200 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 300 },
        _count: { id: 2 },
      });

      const warnSpy = vi.spyOn(logger, 'warn');

      await MLMReconciliationService.recalculateMember(dist.id, {
        reason: 'Integrity Check',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: dist.id,
          oldBB: 50,
          calculatedBB: 300,
          bbDiscrepancy: 250,
        }),
        expect.stringContaining('[RECONCILIATION DISCREPANCY]')
      );
    });

    it('SOURCE OF TRUTH: Ledger records must NEVER be deleted or overwritten', async () => {
      const dist = createMockDistributor({ currentBB: 100 });
      vi.spyOn(prisma.distributorProfile, 'findFirst').mockResolvedValue(dist as any);
      vi.spyOn(prisma.distributorProfile, 'findUnique').mockResolvedValue(dist as any);

      const bbDeleteSpy = vi.spyOn((prisma as any).bBTransaction, 'delete' as any);
      const bbDeleteManySpy = vi.spyOn((prisma as any).bBTransaction, 'deleteMany' as any);
      const matchingDeleteSpy = vi.spyOn((prisma as any).matchingTransaction, 'delete' as any);

      await MLMReconciliationService.recalculateMember(dist.id);

      // Ledger delete operations must NEVER be called
      expect(bbDeleteSpy).not.toHaveBeenCalled();
      expect(bbDeleteManySpy).not.toHaveBeenCalled();
      expect(matchingDeleteSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. RECALCULATE ALL MEMBERS (BATCH PROCESSING & MEMORY SAFETY)
  // =========================================================================
  describe('2. recalculateAllMembers(options)', () => {
    it('should process entire network in memory-safe batches using cursor pagination', async () => {
      const members = [
        { id: 'dist-001', distributorCode: 'KV-001' },
        { id: 'dist-002', distributorCode: 'KV-002' },
        { id: 'dist-003', distributorCode: 'KV-003' },
        { id: 'dist-004', distributorCode: 'KV-004' },
        { id: 'dist-005', distributorCode: 'KV-005' },
      ];

      vi.spyOn(prisma.distributorProfile, 'count').mockResolvedValue(members.length);

      // Mock cursor-based findMany returning 2 per batch
      vi.spyOn(prisma.distributorProfile, 'findMany').mockImplementation(async ({ take, skip, cursor }: any) => {
        let startIndex = 0;
        if (cursor) {
          const found = members.findIndex((m) => m.id === cursor.id);
          startIndex = found >= 0 ? found + 1 : 0;
        }
        return members.slice(startIndex, startIndex + take) as any;
      });

      // Mock recalculateMember
      let callCount = 0;
      vi.spyOn(MLMReconciliationService, 'recalculateMember').mockImplementation(async (id: string) => {
        callCount++;
        return {
          memberId: id,
          distributorCode: `KV-${id}`,
          displayName: 'Test',
          dryRun: false,
          oldBB: 100,
          calculatedBB: id === 'dist-003' ? 200 : 100, // dist-003 has discrepancy
          bbDiscrepancy: id === 'dist-003' ? 100 : 0,
          oldLeftVolume: 0,
          calculatedLeftVolume: 0,
          oldRightVolume: 0,
          calculatedRightVolume: 0,
          oldMatching: 0,
          calculatedMatching: 0,
          matchingDiscrepancy: 0,
          oldLevel: { order: 0, code: 'BASE', name: 'Base' } as any,
          calculatedLevel: { order: 0, code: 'BASE', name: 'Base' } as any,
          promoted: false,
          hasDiscrepancy: id === 'dist-003',
          discrepancyDetails: {} as any,
          reason: 'Batch reconciliation',
          actor: 'ADMIN_BATCH',
          timestamp: new Date(),
        };
      });

      const progressEvents: any[] = [];

      const summary = await MLMReconciliationService.recalculateAllMembers({
        batchSize: 2, // 2 per batch -> 3 batches (2 + 2 + 1)
        actor: 'ADMIN_BATCH',
        onProgress: (p) => progressEvents.push(p),
      });

      expect(summary.totalMembers).toBe(5);
      expect(summary.totalProcessed).toBe(5);
      expect(summary.totalDiscrepancies).toBe(1);
      expect(summary.batchesCompleted).toBe(3);
      expect(callCount).toBe(5);
      expect(progressEvents.length).toBe(3);
      expect(summary.discrepancies.length).toBe(1);
      expect(summary.discrepancies[0].memberId).toBe('dist-003');
    });
  });

  // =========================================================================
  // 3. IDEMPOTENCY TESTS
  // =========================================================================
  describe('3. IDEMPOTENCY', () => {
    it('Successive recalculations yield identical results without volume drift', async () => {
      let currentBB = 100;
      let currentMatching = 1000;

      // Ledger has 300 BB and 2000 Matching
      vi.spyOn((prisma as any).bBTransaction, 'aggregate').mockResolvedValue({
        _sum: { amount: 300 },
        _count: { id: 3 },
      });
      vi.spyOn(MatchingService, 'getMatchingVolume').mockResolvedValue(2000);

      vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async () =>
        createMockDistributor({
          currentBB,
          currentMatching,
          currentLevel: currentMatching >= 2000 && currentBB >= 250
            ? { code: 'SILVER', name: 'Silver', order: 1 }
            : null,
        }) as any
      );

      vi.spyOn(prisma.distributorProfile, 'update').mockImplementation(async ({ data }: any) => {
        if (data.currentBB) currentBB = Number(data.currentBB);
        if (data.currentMatching) currentMatching = Number(data.currentMatching);
        return {} as any;
      });

      // Run 1: Detects initial discrepancy, updates profile to 300 BB / 2000 Matching, promotes to Silver
      const run1 = await MLMReconciliationService.recalculateMember(mockMemberId);
      expect(run1.hasDiscrepancy).toBe(true);
      expect(run1.calculatedBB).toBe(300);
      expect(run1.calculatedMatching).toBe(2000);
      expect(run1.calculatedLevel.code).toBe('SILVER');

      // Run 2: Authoritative ledger data unchanged -> EXACT SAME TOTALS, ZERO DISCREPANCY, NO REDUNDANT PROMOTION
      const run2 = await MLMReconciliationService.recalculateMember(mockMemberId);
      expect(run2.hasDiscrepancy).toBe(false);
      expect(run2.calculatedBB).toBe(300);
      expect(run2.calculatedMatching).toBe(2000);
      expect(run2.bbDiscrepancy).toBe(0);
      expect(run2.matchingDiscrepancy).toBe(0);
      expect(run2.promoted).toBe(false);
      expect(run2.calculatedLevel.code).toBe('SILVER');
    });
  });

  // =========================================================================
  // 4. ADMIN REST API TESTS
  // =========================================================================
  describe('4. ADMIN REST APIS', () => {
    it('POST /api/admin/members/:memberId/reconcile -> 401 Unauthorized without token', async () => {
      await request(app)
        .post(`/api/admin/members/${mockMemberId}/reconcile`)
        .expect(401);
    });

    it('POST /api/admin/members/:memberId/reconcile -> 403 Forbidden for normal member', async () => {
      await request(app)
        .post(`/api/admin/members/${mockMemberId}/reconcile`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('POST /api/admin/members/:memberId/reconcile -> 200 OK for Admin with audit data', async () => {
      vi.spyOn(MLMReconciliationService, 'recalculateMember').mockResolvedValue({
        memberId: mockMemberId,
        distributorCode: 'KV-RECON-001',
        displayName: 'Audit Tester',
        dryRun: false,
        oldBB: 150,
        calculatedBB: 250,
        bbDiscrepancy: 100,
        oldLeftVolume: 2000,
        calculatedLeftVolume: 2000,
        oldRightVolume: 2000,
        calculatedRightVolume: 2000,
        oldMatching: 1500,
        calculatedMatching: 2000,
        matchingDiscrepancy: 500,
        oldLevel: { order: 0, code: 'BASE', name: 'Base' } as any,
        calculatedLevel: { order: 1, code: 'SILVER', name: 'Silver' } as any,
        promoted: true,
        hasDiscrepancy: true,
        discrepancyDetails: {
          bbMismatch: true,
          bbDiff: 100,
          matchingMismatch: true,
          matchingDiff: 500,
          leftVolumeMismatch: false,
          leftDiff: 0,
          rightVolumeMismatch: false,
          rightDiff: 0,
          levelMismatch: true,
          oldLevelCode: 'BASE',
          calculatedLevelCode: 'SILVER',
        },
        reason: 'Admin API Audit',
        actor: 'admin@kashvimlm.com',
        auditRecordId: 'audit-api-1',
        timestamp: new Date(),
      });

      const res = await request(app)
        .post(`/api/admin/members/${mockMemberId}/reconcile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Admin API Audit' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.memberId).toBe(mockMemberId);
      expect(res.body.data.calculatedBB).toBe(250);
      expect(res.body.data.calculatedMatching).toBe(2000);
      expect(res.body.data.calculatedLevel.code).toBe('SILVER');
      expect(res.body.data.promoted).toBe(true);
      expect(res.body.data.hasDiscrepancy).toBe(true);
    });

    it('POST /api/admin/members/reconcile-all -> 403 Forbidden for normal member', async () => {
      await request(app)
        .post('/api/admin/members/reconcile-all')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('POST /api/admin/members/reconcile-all -> 200 OK for Admin with batch summary', async () => {
      vi.spyOn(MLMReconciliationService, 'recalculateAllMembers').mockResolvedValue({
        totalProcessed: 500,
        totalMembers: 500,
        totalDiscrepancies: 3,
        totalPromotions: 2,
        dryRun: false,
        batchSize: 50,
        batchesCompleted: 10,
        durationMs: 1250,
        discrepancies: [
          {
            memberId: 'dist-99',
            distributorCode: 'KV-099',
            bbDiscrepancy: 50,
            matchingDiscrepancy: 100,
            oldLevel: 'BASE',
            calculatedLevel: 'SILVER',
          },
        ],
        errors: [],
        actor: 'admin@kashvimlm.com',
        reason: 'Monthly network audit',
        timestamp: new Date(),
      });

      const res = await request(app)
        .post('/api/admin/members/reconcile-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchSize: 50, reason: 'Monthly network audit' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProcessed).toBe(500);
      expect(res.body.data.totalDiscrepancies).toBe(3);
      expect(res.body.data.totalPromotions).toBe(2);
      expect(res.body.data.batchesCompleted).toBe(10);
    });

    it('GET /api/admin/members/reconciliation/history -> 200 OK for Admin with paginated logs', async () => {
      vi.spyOn(MLMReconciliationService, 'getReconciliationHistory').mockResolvedValue({
        data: [
          {
            id: 'audit-001',
            memberId: mockMemberId,
            oldBB: 100,
            calculatedBB: 250,
            hasDiscrepancy: true,
            actor: 'admin@kashvimlm.com',
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await request(app)
        .get('/api/admin/members/reconciliation/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(1);
    });
  });
});
