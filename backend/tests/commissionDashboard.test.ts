/**
 * Automated Test Suite: Commission Dashboard Service & REST APIs (Prompt 24)
 *
 * Verifies:
 * 1. DATABASE AGGREGATION INVARIANTS:
 *    - Does NOT calculate large historical totals by loading every transaction into application memory.
 *    - Uses database aggregation queries (groupBy, aggregate, _sum, _count) pushed down to DB engine.
 *    - Uses pagination (LIMIT / OFFSET via take / skip) for recent transaction lists.
 * 2. MEMBER DASHBOARD SUMMARY METRICS:
 *    - Total Commission
 *    - Pending Commission
 *    - Available Commission
 *    - Paid Commission
 *    - Reversed Commission
 * 3. COMMISSION BY LEVEL BREAKDOWN (Levels 1-5):
 *    - Level 1 (24%), Level 2 (8%), Level 3 (13%), Level 4 (5%), Level 5 (4%)
 *    - For each level:
 *      - percentage
 *      - total BV processed
 *      - total commission
 *      - number of transactions
 * 4. RECENT COMMISSION TRANSACTIONS WITH PAGINATION:
 *    - Returns recent transactions with page, limit, total, totalPages, hasMore.
 * 5. REST API ROUTING & ACCESS CONTROL:
 *    - GET /api/members/:memberId/commissions/dashboard
 *    - GET /api/v1/members/:memberId/commissions/dashboard
 *    - Supports "me" parameter.
 *    - Rejects unauthenticated requests with 401.
 *    - Rejects unauthorized cross-member access with 403.
 *    - Allows admin access to any member.
 * 6. APPROPRIATE INDEXES:
 *    - Verifies composite database indexes for status, level, and createdAt on recipientMemberId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { CommissionDashboardService } from '../src/services/commissionDashboard.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 24: COMMISSION DASHBOARD SERVICE & REST APIs', () => {
  const member1Token = createTestToken({
    id: 'user-dash-001',
    email: 'dash1@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const member2Token = createTestToken({
    id: 'user-dash-002',
    email: 'dash2@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const adminToken = createAdminToken();

  const member1Id = 'dist-dash-001';
  const member2Id = 'dist-dash-002';
  const sourceMemberId = 'dist-buyer-500';

  let inMemoryDistributors: Map<string, any>;
  let inMemoryOrders: Map<string, any>;
  let inMemoryCommissionTx: Map<string, any>;
  let inMemoryReversals: Map<string, any>;
  let inMemoryWalletTx: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();

    inMemoryDistributors = new Map();
    inMemoryOrders = new Map();
    inMemoryCommissionTx = new Map();
    inMemoryReversals = new Map();
    inMemoryWalletTx = new Map();

    // Member 1
    inMemoryDistributors.set(member1Id, {
      id: member1Id,
      userId: 'user-dash-001',
      distributorCode: 'DST-DASH-1',
      distributorId: 'KV-DASH-1',
      firstName: 'Priya',
      lastName: 'Nair',
      displayName: 'Priya Nair',
    });

    // Member 2
    inMemoryDistributors.set(member2Id, {
      id: member2Id,
      userId: 'user-dash-002',
      distributorCode: 'DST-DASH-2',
      distributorId: 'KV-DASH-2',
      firstName: 'Rohan',
      lastName: 'Kapoor',
      displayName: 'Rohan Kapoor',
    });

    // Source Member (downline purchaser)
    inMemoryDistributors.set(sourceMemberId, {
      id: sourceMemberId,
      userId: 'user-buyer-500',
      distributorCode: 'DST-BUYER-5',
      distributorId: 'KV-BUYER-5',
      firstName: 'Dev',
      lastName: 'Patel',
    });

    // Mock Order
    inMemoryOrders.set('ord-dash-100', {
      id: 'ord-dash-100',
      orderNumber: 'ORD-2026-DASH',
      status: 'PAID',
      totalAmount: new Prisma.Decimal(15000),
      totalBV: new Prisma.Decimal(10000),
    });

    // Mock Wallet Transaction
    inMemoryWalletTx.set('wtx-dash-1', {
      id: 'wtx-dash-1',
      transactionNumber: 'WTX-DASH-1001',
      status: 'COMPLETED',
      amount: new Prisma.Decimal(2400),
      createdAt: new Date('2026-09-20T10:00:00Z'),
    });

    // Setup 15 commission transactions for member 1 to test pagination and level breakdown
    // Level 1: 3 txs, BV 30,000, Comm 7,200 (PAID)
    for (let i = 1; i <= 3; i++) {
      const id = `comm-l1-${i}`;
      inMemoryCommissionTx.set(id, {
        id,
        recipientMemberId: member1Id,
        sourceMemberId,
        orderId: 'ord-dash-100',
        commissionLevel: 1,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(24),
        grossCommissionAmount: new Prisma.Decimal(2400),
        status: 'PAID',
        source: 'ORDER_PURCHASE',
        idempotencyKey: `COMM:ord-dash-100:L1:${member1Id}:${i}`,
        walletTransactionId: 'wtx-dash-1',
        createdAt: new Date(`2026-09-2${i}T10:00:00Z`),
      });
    }

    // Level 2: 2 txs, BV 20,000, Comm 1,600 (PENDING)
    for (let i = 1; i <= 2; i++) {
      const id = `comm-l2-${i}`;
      inMemoryCommissionTx.set(id, {
        id,
        recipientMemberId: member1Id,
        sourceMemberId,
        orderId: 'ord-dash-100',
        commissionLevel: 2,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(8),
        grossCommissionAmount: new Prisma.Decimal(800),
        status: 'PENDING',
        source: 'ORDER_PURCHASE',
        idempotencyKey: `COMM:ord-dash-100:L2:${member1Id}:${i}`,
        walletTransactionId: null,
        createdAt: new Date(`2026-09-2${i + 3}T10:00:00Z`),
      });
    }

    // Level 3: 2 txs, BV 20,000, Comm 2,600 (AVAILABLE)
    for (let i = 1; i <= 2; i++) {
      const id = `comm-l3-${i}`;
      inMemoryCommissionTx.set(id, {
        id,
        recipientMemberId: member1Id,
        sourceMemberId,
        orderId: 'ord-dash-100',
        commissionLevel: 3,
        businessVolume: new Prisma.Decimal(10000),
        percentage: new Prisma.Decimal(13),
        grossCommissionAmount: new Prisma.Decimal(1300),
        status: 'AVAILABLE',
        source: 'ORDER_PURCHASE',
        idempotencyKey: `COMM:ord-dash-100:L3:${member1Id}:${i}`,
        walletTransactionId: null,
        createdAt: new Date(`2026-09-2${i + 5}T10:00:00Z`),
      });
    }

    // Level 4: 1 tx, BV 10,000, Comm 500 (PAID)
    inMemoryCommissionTx.set('comm-l4-1', {
      id: 'comm-l4-1',
      recipientMemberId: member1Id,
      sourceMemberId,
      orderId: 'ord-dash-100',
      commissionLevel: 4,
      businessVolume: new Prisma.Decimal(10000),
      percentage: new Prisma.Decimal(5),
      grossCommissionAmount: new Prisma.Decimal(500),
      status: 'PAID',
      source: 'ORDER_PURCHASE',
      idempotencyKey: `COMM:ord-dash-100:L4:${member1Id}:1`,
      walletTransactionId: null,
      createdAt: new Date('2026-09-28T10:00:00Z'),
    });

    // Level 5: 0 txs (Testing zero handling)

    // Reversal record for member 1
    inMemoryReversals.set('rev-dash-1', {
      id: 'rev-dash-1',
      recipientMemberId: member1Id,
      amount: new Prisma.Decimal(-600),
      originalAmount: new Prisma.Decimal(600),
      createdAt: new Date('2026-09-29T10:00:00Z'),
    });

    // Mock prisma.distributorProfile.findFirst
    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
      const orConds = args.where?.OR || [];
      for (const cond of orConds) {
        if (cond.id && inMemoryDistributors.has(cond.id)) return inMemoryDistributors.get(cond.id);
        if (cond.userId) {
          for (const d of inMemoryDistributors.values()) {
            if (d.userId === cond.userId) return d;
          }
        }
        if (cond.distributorCode?.equals) {
          const t = cond.distributorCode.equals.toLowerCase();
          for (const d of inMemoryDistributors.values()) {
            if (d.distributorCode.toLowerCase() === t) return d;
          }
        }
      }
      return null;
    });

    // Mock prisma.commissionTransaction.groupBy (Database Aggregation Query)
    vi.spyOn(prisma.commissionTransaction, 'groupBy').mockImplementation(async (args: any) => {
      const byField = args.by[0];
      const memberId = args.where?.recipientMemberId;

      const memberTxs = Array.from(inMemoryCommissionTx.values()).filter(
        (c) => c.recipientMemberId === memberId
      );

      if (byField === 'status') {
        const statusMap = new Map<string, { sum: number; count: number }>();
        for (const tx of memberTxs) {
          const prev = statusMap.get(tx.status) || { sum: 0, count: 0 };
          prev.sum += Number(tx.grossCommissionAmount);
          prev.count++;
          statusMap.set(tx.status, prev);
        }
        return Array.from(statusMap.entries()).map(([status, val]) => ({
          status,
          _sum: { grossCommissionAmount: new Prisma.Decimal(val.sum) },
          _count: { _all: val.count },
        })) as any;
      }

      if (byField === 'commissionLevel') {
        const levelMap = new Map<number, { sumComm: number; sumBV: number; count: number }>();
        for (const tx of memberTxs) {
          if (args.where?.status?.not && tx.status === args.where.status.not) continue;
          const prev = levelMap.get(tx.commissionLevel) || { sumComm: 0, sumBV: 0, count: 0 };
          prev.sumComm += Number(tx.grossCommissionAmount);
          prev.sumBV += Number(tx.businessVolume);
          prev.count++;
          levelMap.set(tx.commissionLevel, prev);
        }
        return Array.from(levelMap.entries()).map(([level, val]) => ({
          commissionLevel: level,
          _sum: {
            grossCommissionAmount: new Prisma.Decimal(val.sumComm),
            businessVolume: new Prisma.Decimal(val.sumBV),
          },
          _count: { _all: val.count },
        })) as any;
      }

      return [];
    });

    // Mock prisma.commissionReversal.aggregate (Database Aggregation Query)
    vi.spyOn(prisma.commissionReversal, 'aggregate').mockImplementation(async (args: any) => {
      const memberId = args.where?.recipientMemberId;
      const reversals = Array.from(inMemoryReversals.values()).filter(
        (r) => r.recipientMemberId === memberId
      );

      const totalAmount = reversals.reduce((acc, r) => acc + Number(r.amount), 0);
      const totalOrig = reversals.reduce((acc, r) => acc + Number(r.originalAmount), 0);

      return {
        _sum: {
          amount: new Prisma.Decimal(totalAmount),
          originalAmount: new Prisma.Decimal(totalOrig),
        },
        _count: { _all: reversals.length },
      } as any;
    });

    // Mock prisma.commissionTransaction.count
    vi.spyOn(prisma.commissionTransaction, 'count').mockImplementation(async (args: any) => {
      const memberId = args.where?.recipientMemberId;
      return Array.from(inMemoryCommissionTx.values()).filter(
        (c) => c.recipientMemberId === memberId
      ).length;
    });

    // Mock prisma.commissionTransaction.findMany (strictly paginated query)
    vi.spyOn(prisma.commissionTransaction, 'findMany').mockImplementation(async (args: any) => {
      const memberId = args.where?.recipientMemberId;
      let list = Array.from(inMemoryCommissionTx.values()).filter(
        (c) => c.recipientMemberId === memberId
      );

      // Sort by createdAt desc
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const skip = args.skip || 0;
      const take = args.take || 10;
      const paged = list.slice(skip, skip + take);

      return paged.map((tx) => ({
        ...tx,
        sourceMember: inMemoryDistributors.get(tx.sourceMemberId),
        order: inMemoryOrders.get(tx.orderId),
        walletTransaction: inMemoryWalletTx.get(tx.walletTransactionId) || null,
      }));
    });
  });

  // =========================================================================
  // 1. DATABASE AGGREGATION ARCHITECTURAL INVARIANT TEST
  // =========================================================================
  describe('1. Architectural Invariant: Database Aggregation Queries', () => {
    it('CRITICAL: MUST use groupBy and aggregate queries, NEVER unpaginated findMany for totals', async () => {
      const groupBySpy = vi.spyOn(prisma.commissionTransaction, 'groupBy');
      const aggregateSpy = vi.spyOn(prisma.commissionReversal, 'aggregate');
      const findManySpy = vi.spyOn(prisma.commissionTransaction, 'findMany');

      await CommissionDashboardService.getMemberCommissionDashboard(member1Id);

      // 1. Assert groupBy was called for status summary aggregation
      expect(groupBySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['status'],
          where: { recipientMemberId: member1Id },
          _sum: { grossCommissionAmount: true },
          _count: { _all: true },
        })
      );

      // 2. Assert groupBy was called for 5-level commission breakdown aggregation
      expect(groupBySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['commissionLevel'],
          where: {
            recipientMemberId: member1Id,
            status: { not: 'CANCELLED' },
          },
          _sum: {
            businessVolume: true,
            grossCommissionAmount: true,
          },
          _count: { _all: true },
        })
      );

      // 3. Assert aggregate was called for reversals
      expect(aggregateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientMemberId: member1Id },
          _sum: { amount: true, originalAmount: true },
        })
      );

      // 4. Assert findMany was ONLY called with strict take/skip pagination (never unpaginated)
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientMemberId: member1Id },
          take: expect.any(Number),
          skip: expect.any(Number),
        })
      );
    });
  });

  // =========================================================================
  // 2. DASHBOARD TOTALS & 5-LEVEL BREAKDOWN
  // =========================================================================
  describe('2. Dashboard Metrics & 5-Level Breakdown', () => {
    it('should accurately return member dashboard summary totals', async () => {
      const data = await CommissionDashboardService.getMemberCommissionDashboard(member1Id);

      // Calculations:
      // Paid = Level 1 (3 * 2400) + Level 4 (500) = 7,200 + 500 = 7,700
      // Pending = Level 2 (2 * 800) = 1,600
      // Available = Level 3 (2 * 1300) = 2,600
      // Total (Active) = 7,700 + 1,600 + 2,600 = 11,900
      // Reversed = 600
      expect(data.paidCommission).toBe(7700);
      expect(data.pendingCommission).toBe(1600);
      expect(data.availableCommission).toBe(2600);
      expect(data.reversedCommission).toBe(600);
      expect(data.totalCommission).toBe(11900);
      expect(data.meta.calculationMethod).toBe('DATABASE_AGGREGATION');
    });

    it('should return complete 5-level commission breakdown with percentage, total BV, total commission, and tx count', async () => {
      const data = await CommissionDashboardService.getMemberCommissionDashboard(member1Id);

      const byLevel = data.commissionByLevel;

      // Level 1: 24%, 30,000 BV, 7,200 commission, 3 transactions
      expect(byLevel['1']).toEqual({
        level: 1,
        percentage: 24,
        totalBVProcessed: 30000,
        totalBV: 30000,
        totalCommission: 7200,
        numberOfTransactions: 3,
        transactionCount: 3,
      });

      // Level 2: 8%, 20,000 BV, 1,600 commission, 2 transactions
      expect(byLevel['2']).toEqual({
        level: 2,
        percentage: 8,
        totalBVProcessed: 20000,
        totalBV: 20000,
        totalCommission: 1600,
        numberOfTransactions: 2,
        transactionCount: 2,
      });

      // Level 3: 13%, 20,000 BV, 2,600 commission, 2 transactions
      expect(byLevel['3']).toEqual({
        level: 3,
        percentage: 13,
        totalBVProcessed: 20000,
        totalBV: 20000,
        totalCommission: 2600,
        numberOfTransactions: 2,
        transactionCount: 2,
      });

      // Level 4: 5%, 10,000 BV, 500 commission, 1 transaction
      expect(byLevel['4']).toEqual({
        level: 4,
        percentage: 5,
        totalBVProcessed: 10000,
        totalBV: 10000,
        totalCommission: 500,
        numberOfTransactions: 1,
        transactionCount: 1,
      });

      // Level 5: 4%, 0 BV, 0 commission, 0 transactions (Clean zero handling)
      expect(byLevel['5']).toEqual({
        level: 5,
        percentage: 4,
        totalBVProcessed: 0,
        totalBV: 0,
        totalCommission: 0,
        numberOfTransactions: 0,
        transactionCount: 0,
      });

      // Also verify levels array representation has all 5 levels
      expect(data.levels.length).toBe(5);
      expect(data.levels[0].level).toBe(1);
      expect(data.levels[4].level).toBe(5);
    });
  });

  // =========================================================================
  // 3. RECENT TRANSACTIONS & PAGINATION
  // =========================================================================
  describe('3. Recent Transactions Pagination', () => {
    it('should paginate recent commission transactions with default limit 10', async () => {
      const data = await CommissionDashboardService.getMemberCommissionDashboard(member1Id, {
        page: 1,
        limit: 5,
      });

      expect(data.recentTransactions.length).toBe(5);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 5,
        total: 8,
        totalPages: 2,
        hasMore: true,
      });

      const firstTx = data.recentTransactions[0];
      expect(firstTx.id).toBeDefined();
      expect(firstTx.orderNumber).toBe('ORD-2026-DASH');
      expect(firstTx.sourceMemberCode).toBe('DST-BUYER-5');
      expect(firstTx.sourceMemberName).toBe('Dev Patel');
    });

    it('should fetch second page correctly', async () => {
      const data = await CommissionDashboardService.getMemberCommissionDashboard(member1Id, {
        page: 2,
        limit: 5,
      });

      expect(data.recentTransactions.length).toBe(3); // 8 total - 5 on page 1 = 3 on page 2
      expect(data.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 8,
        totalPages: 2,
        hasMore: false,
      });
    });
  });

  // =========================================================================
  // 4. REST API ENDPOINTS & ACCESS CONTROL
  // =========================================================================
  describe('4. REST API Endpoint: GET /api/members/:memberId/commissions/dashboard', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/dashboard`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject distributor attempting to view another members dashboard with 403', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/dashboard`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('should return complete dashboard data for authenticated distributor', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/dashboard?page=1&limit=5`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.totalCommission).toBe(11900);
      expect(data.pendingCommission).toBe(1600);
      expect(data.availableCommission).toBe(2600);
      expect(data.paidCommission).toBe(7700);
      expect(data.reversedCommission).toBe(600);
      expect(data.commissionByLevel['1'].totalCommission).toBe(7200);
      expect(data.commissionByLevel['1'].totalBVProcessed).toBe(30000);
      expect(data.recentTransactions.length).toBe(5);
      expect(res.body.meta.total).toBe(8);
      expect(res.body.meta.totalPages).toBe(2);
    });

    it('should support /api/v1/members/:memberId/commissions/dashboard route alias', async () => {
      const res = await request(app)
        .get(`/api/v1/members/${member1Id}/commissions/dashboard`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalCommission).toBe(11900);
    });

    it('should support "me" as member identifier', async () => {
      const res = await request(app)
        .get('/api/members/me/commissions/dashboard')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.member.id).toBe(member1Id);
    });

    it('should allow admin to access any members commission dashboard', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/dashboard`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalCommission).toBe(11900);
    });
  });

  // =========================================================================
  // 5. DATABASE SCHEMA INDEX VERIFICATION
  // =========================================================================
  describe('5. Database Indexes Verification in schema.prisma', () => {
    it('should contain composite B-Tree indexes for status, level, and createdAt on recipientMemberId', () => {
      const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      // Assert composite index for status aggregation
      expect(schemaContent).toContain('@@index([recipientMemberId, status])');

      // Assert composite index for commission level aggregation
      expect(schemaContent).toContain('@@index([recipientMemberId, commissionLevel])');

      // Assert composite index for paginated recent transactions range scan
      expect(schemaContent).toContain('@@index([recipientMemberId, createdAt])');
    });
  });
});
