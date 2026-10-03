/**
 * Automated Test Suite: Commission REST APIs (Prompt 23)
 *
 * Verifies:
 * 1. MEMBER ENDPOINTS:
 *    - GET /api/members/:memberId/commissions (Paginated commission history)
 *    - GET /api/members/:memberId/commissions/summary (Total, pending, available, paid, reversed, level breakdown)
 *    - GET /api/members/:memberId/commissions/:commissionId (Complete transaction details)
 *    - Strict authorization: distributors cannot view another member's commissions.
 *    - Admin authorization: admins can view any member's commissions.
 *    - Supports :memberId as 'me'.
 * 2. ADMIN ENDPOINTS:
 *    - GET /api/admin/commissions (Filtering by member, source member, order, level, status, date range)
 *    - POST /api/admin/orders/:orderId/process-commission (Authoritative commission execution)
 *    - POST /api/admin/commissions/:commissionId/reverse (Compensatory reversal)
 *    - Strict RBAC: only ADMIN / SUPER_ADMIN can access.
 * 3. ZERO-TRUST SECURITY INVARIANTS:
 *    - Rejects if client sends commission amount from the frontend.
 *    - Rejects if client sends percentage from the frontend.
 *    - Rejects if client sends recipientId from a commission-generation request.
 *    - Backend authoritatively determines BV, upline, level, percentage, commission amount, eligibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import app from '../src/app';
import { prisma } from '../src/config/database';
import { OrderCommissionLifecycleService } from '../src/services/orderCommissionLifecycle.service';
import { CommissionReversalService } from '../src/services/commissionReversal.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('PROMPT 23: COMMISSION REST APIs (/api/members & /api/admin)', () => {
  // Mock Tokens
  const member1Token = createTestToken({
    id: 'user-mem-001',
    email: 'member1@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const member2Token = createTestToken({
    id: 'user-mem-002',
    email: 'member2@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  const adminToken = createAdminToken();

  // Test Member & Data Identifiers
  const member1Id = 'dist-mem-001';
  const member2Id = 'dist-mem-002';
  const sourceMemberId = 'dist-buyer-100';
  const order1Id = 'ord-comm-001';
  const comm1Id = 'comm-tx-001';

  let inMemoryDistributors: Map<string, any>;
  let inMemoryOrders: Map<string, any>;
  let inMemoryCommissionTx: Map<string, any>;
  let inMemoryReversals: Map<string, any>;
  let inMemoryWallets: Map<string, any>;
  let inMemoryWalletTx: Map<string, any>;

  beforeEach(() => {
    vi.restoreAllMocks();

    inMemoryDistributors = new Map();
    inMemoryOrders = new Map();
    inMemoryCommissionTx = new Map();
    inMemoryReversals = new Map();
    inMemoryWallets = new Map();
    inMemoryWalletTx = new Map();

    // Setup Member 1
    inMemoryDistributors.set(member1Id, {
      id: member1Id,
      userId: 'user-mem-001',
      distributorCode: 'DST-10001',
      distributorId: 'KV-1001',
      firstName: 'Alice',
      lastName: 'Sharma',
      user: { id: 'user-mem-001', email: 'member1@kashvimlm.com', status: 'ACTIVE', roleName: 'DISTRIBUTOR' },
    });

    // Setup Member 2
    inMemoryDistributors.set(member2Id, {
      id: member2Id,
      userId: 'user-mem-002',
      distributorCode: 'DST-10002',
      distributorId: 'KV-1002',
      firstName: 'Bob',
      lastName: 'Verma',
      user: { id: 'user-mem-002', email: 'member2@kashvimlm.com', status: 'ACTIVE', roleName: 'DISTRIBUTOR' },
    });

    // Setup Source Member (Purchaser)
    inMemoryDistributors.set(sourceMemberId, {
      id: sourceMemberId,
      userId: 'user-buyer-100',
      distributorCode: 'DST-99999',
      distributorId: 'KV-9999',
      firstName: 'Charlie',
      lastName: 'Buyer',
      user: { id: 'user-buyer-100', email: 'buyer@kashvimlm.com', status: 'ACTIVE', roleName: 'DISTRIBUTOR' },
    });

    // Setup Order
    inMemoryOrders.set(order1Id, {
      id: order1Id,
      orderNumber: 'ORD-2026-1001',
      distributorId: sourceMemberId,
      status: 'PAID',
      totalAmount: new Prisma.Decimal(12000),
      totalBV: new Prisma.Decimal(10000),
      commissionableBusinessVolume: new Prisma.Decimal(10000),
      createdAt: new Date('2026-09-15T10:00:00Z'),
    });

    // Setup Wallets
    inMemoryWallets.set(member1Id, {
      id: `wallet-${member1Id}`,
      distributorId: member1Id,
      userId: 'user-mem-001',
      availableBalance: new Prisma.Decimal(5000),
      lifetimeEarned: new Prisma.Decimal(5000),
      currency: 'INR',
    });

    // Setup Sample Commission Transactions for Member 1
    // Level 1: 24% of 10,000 BV = 2,400 (PAID)
    inMemoryCommissionTx.set(comm1Id, {
      id: comm1Id,
      recipientMemberId: member1Id,
      sourceMemberId,
      orderId: order1Id,
      commissionLevel: 1,
      businessVolume: new Prisma.Decimal(10000),
      percentage: new Prisma.Decimal(24),
      grossCommissionAmount: new Prisma.Decimal(2400),
      status: 'PAID',
      source: 'ORDER_PURCHASE',
      idempotencyKey: `COMM:${order1Id}:L1:${member1Id}`,
      walletTransactionId: 'wtx-001',
      calculationDetails: { bv: 10000, rate: 0.24, gross: 2400 },
      createdAt: new Date('2026-09-15T11:00:00Z'),
      updatedAt: new Date('2026-09-15T11:00:00Z'),
      paidAt: new Date('2026-09-15T11:00:00Z'),
    });

    // Level 2: 8% of 10,000 BV = 800 (PENDING)
    const comm2Id = 'comm-tx-002';
    inMemoryCommissionTx.set(comm2Id, {
      id: comm2Id,
      recipientMemberId: member1Id,
      sourceMemberId,
      orderId: order1Id,
      commissionLevel: 2,
      businessVolume: new Prisma.Decimal(10000),
      percentage: new Prisma.Decimal(8),
      grossCommissionAmount: new Prisma.Decimal(800),
      status: 'PENDING',
      source: 'ORDER_PURCHASE',
      idempotencyKey: `COMM:${order1Id}:L2:${member1Id}`,
      walletTransactionId: null,
      calculationDetails: { bv: 10000, rate: 0.08, gross: 800 },
      createdAt: new Date('2026-09-16T11:00:00Z'),
      updatedAt: new Date('2026-09-16T11:00:00Z'),
    });

    // Level 3: 13% of 10,000 BV = 1,300 (AVAILABLE)
    const comm3Id = 'comm-tx-003';
    inMemoryCommissionTx.set(comm3Id, {
      id: comm3Id,
      recipientMemberId: member1Id,
      sourceMemberId,
      orderId: order1Id,
      commissionLevel: 3,
      businessVolume: new Prisma.Decimal(10000),
      percentage: new Prisma.Decimal(13),
      grossCommissionAmount: new Prisma.Decimal(1300),
      status: 'AVAILABLE',
      source: 'ORDER_PURCHASE',
      idempotencyKey: `COMM:${order1Id}:L3:${member1Id}`,
      walletTransactionId: null,
      calculationDetails: { bv: 10000, rate: 0.13, gross: 1300 },
      createdAt: new Date('2026-09-17T11:00:00Z'),
      updatedAt: new Date('2026-09-17T11:00:00Z'),
    });

    // Level 4: 5% of 10,000 BV = 500 (REVERSED)
    const comm4Id = 'comm-tx-004';
    inMemoryCommissionTx.set(comm4Id, {
      id: comm4Id,
      recipientMemberId: member1Id,
      sourceMemberId,
      orderId: order1Id,
      commissionLevel: 4,
      businessVolume: new Prisma.Decimal(10000),
      percentage: new Prisma.Decimal(5),
      grossCommissionAmount: new Prisma.Decimal(500),
      status: 'REVERSED',
      source: 'ORDER_PURCHASE',
      idempotencyKey: `COMM:${order1Id}:L4:${member1Id}`,
      walletTransactionId: null,
      reversalReason: 'Order refund',
      reversedAt: new Date('2026-09-18T11:00:00Z'),
      calculationDetails: { bv: 10000, rate: 0.05, gross: 500 },
      createdAt: new Date('2026-09-18T11:00:00Z'),
      updatedAt: new Date('2026-09-18T11:00:00Z'),
    });

    // Wallet transaction mock for comm1
    inMemoryWalletTx.set('wtx-001', {
      id: 'wtx-001',
      transactionNumber: 'WTX-COMM-001',
      walletId: `wallet-${member1Id}`,
      amount: new Prisma.Decimal(2400),
      type: 'COMMISSION',
      status: 'COMPLETED',
      balanceBefore: new Prisma.Decimal(2600),
      balanceAfter: new Prisma.Decimal(5000),
      createdAt: new Date('2026-09-15T11:00:00Z'),
    });

    // Mock Prisma methods
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(prisma);
      return cb;
    });

    vi.spyOn(prisma.distributorProfile, 'findFirst').mockImplementation(async (args: any) => {
      const orConditions = args.where?.OR || [];
      for (const cond of orConditions) {
        if (cond.id && inMemoryDistributors.has(cond.id)) return inMemoryDistributors.get(cond.id);
        if (cond.userId) {
          for (const d of inMemoryDistributors.values()) {
            if (d.userId === cond.userId) return d;
          }
        }
        if (cond.distributorCode?.equals) {
          const target = cond.distributorCode.equals.toLowerCase();
          for (const d of inMemoryDistributors.values()) {
            if (d.distributorCode.toLowerCase() === target) return d;
          }
        }
        if (cond.distributorId?.equals) {
          const target = cond.distributorId.equals.toLowerCase();
          for (const d of inMemoryDistributors.values()) {
            if (d.distributorId?.toLowerCase() === target) return d;
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.order, 'findFirst').mockImplementation(async (args: any) => {
      const orConds = args.where?.OR || [];
      for (const cond of orConds) {
        if (cond.id && inMemoryOrders.has(cond.id)) return inMemoryOrders.get(cond.id);
        if (cond.orderNumber) {
          for (const o of inMemoryOrders.values()) {
            if (o.orderNumber === cond.orderNumber) return o;
          }
        }
      }
      return null;
    });

    vi.spyOn(prisma.order, 'findUnique').mockImplementation(async (args: any) => {
      return inMemoryOrders.get(args.where.id) || null;
    });

    vi.spyOn(prisma.commissionTransaction, 'findUnique').mockImplementation(async (args: any) => {
      const comm = inMemoryCommissionTx.get(args.where.id);
      if (!comm) return null;
      return {
        ...comm,
        recipient: inMemoryDistributors.get(comm.recipientMemberId),
        sourceMember: inMemoryDistributors.get(comm.sourceMemberId),
        order: inMemoryOrders.get(comm.orderId),
        walletTransaction: inMemoryWalletTx.get(comm.walletTransactionId) || null,
        reversals: Array.from(inMemoryReversals.values()).filter((r) => r.originalCommissionId === comm.id),
      };
    });

    vi.spyOn(prisma.commissionTransaction, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryCommissionTx.values());
      const where = args.where;
      if (where?.recipientMemberId) list = list.filter((c) => c.recipientMemberId === where.recipientMemberId);
      if (where?.sourceMemberId) list = list.filter((c) => c.sourceMemberId === where.sourceMemberId);
      if (where?.orderId) list = list.filter((c) => c.orderId === where.orderId);
      if (where?.commissionLevel) list = list.filter((c) => c.commissionLevel === where.commissionLevel);
      if (where?.status) list = list.filter((c) => c.status === where.status);
      if (where?.createdAt?.gte) list = list.filter((c) => new Date(c.createdAt) >= new Date(where.createdAt.gte));
      if (where?.createdAt?.lte) list = list.filter((c) => new Date(c.createdAt) <= new Date(where.createdAt.lte));

      return list.map((comm) => ({
        ...comm,
        recipient: inMemoryDistributors.get(comm.recipientMemberId),
        sourceMember: inMemoryDistributors.get(comm.sourceMemberId),
        order: inMemoryOrders.get(comm.orderId),
        walletTransaction: inMemoryWalletTx.get(comm.walletTransactionId) || null,
        reversals: Array.from(inMemoryReversals.values()).filter((r) => r.originalCommissionId === comm.id),
      }));
    });

    vi.spyOn(prisma.commissionTransaction, 'count').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryCommissionTx.values());
      const where = args.where;
      if (where?.recipientMemberId) list = list.filter((c) => c.recipientMemberId === where.recipientMemberId);
      if (where?.sourceMemberId) list = list.filter((c) => c.sourceMemberId === where.sourceMemberId);
      if (where?.orderId) list = list.filter((c) => c.orderId === where.orderId);
      if (where?.commissionLevel) list = list.filter((c) => c.commissionLevel === where.commissionLevel);
      if (where?.status) list = list.filter((c) => c.status === where.status);
      return list.length;
    });

    vi.spyOn(prisma.commissionTransaction, 'update').mockImplementation(async (args: any) => {
      const comm = inMemoryCommissionTx.get(args.where.id);
      if (comm) {
        Object.assign(comm, args.data);
      }
      return comm;
    });

    vi.spyOn(prisma.commissionReversal, 'findMany').mockImplementation(async (args: any) => {
      let list = Array.from(inMemoryReversals.values());
      if (args.where?.recipientMemberId) {
        list = list.filter((r) => r.recipientMemberId === args.where.recipientMemberId);
      }
      return list;
    });

    vi.spyOn(prisma.commissionReversal, 'findUnique').mockImplementation(async (args: any) => {
      if (args.where?.idempotencyKey) {
        for (const r of inMemoryReversals.values()) {
          if (r.idempotencyKey === args.where.idempotencyKey) return r;
        }
      }
      return inMemoryReversals.get(args.where?.id) || null;
    });

    vi.spyOn(prisma.commissionReversal, 'create').mockImplementation(async (args: any) => {
      const revId = `rev-${Date.now()}`;
      const record = { id: revId, ...args.data, createdAt: new Date() };
      inMemoryReversals.set(revId, record);
      return record;
    });

    vi.spyOn(prisma.wallet, 'findFirst').mockImplementation(async (args: any) => {
      for (const cond of args.where?.OR || []) {
        if (cond.distributorId && inMemoryWallets.has(cond.distributorId)) {
          return inMemoryWallets.get(cond.distributorId);
        }
      }
      return null;
    });

    vi.spyOn(prisma.wallet, 'update').mockImplementation(async (args: any) => {
      for (const w of inMemoryWallets.values()) {
        if (w.id === args.where.id) {
          if (args.data.availableBalance) w.availableBalance = args.data.availableBalance;
          return w;
        }
      }
      return null;
    });

    vi.spyOn(prisma.walletTransaction, 'create').mockImplementation(async (args: any) => {
      const id = `wtx-rev-${Date.now()}`;
      const record = { id, ...args.data, createdAt: new Date() };
      inMemoryWalletTx.set(id, record);
      return record;
    });
  });

  // =========================================================================
  // 1. MEMBER: GET /api/members/:memberId/commissions
  // =========================================================================
  describe('GET /api/members/:memberId/commissions', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authorization token is missing or malformed');
    });

    it('should reject a distributor attempting to view another members commissions with 403', async () => {
      // Member 2 attempts to view Member 1's commissions
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('should return paginated commission history for the authenticated member', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions?page=1&limit=10`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 4,
        totalPages: 1,
      });

      const firstItem = res.body.data[0];
      expect(firstItem.id).toBeDefined();
      expect(firstItem.recipient).toBeDefined();
      expect(firstItem.sourceMember).toBeDefined();
      expect(firstItem.order).toBeDefined();
    });

    it('should support /api/v1/members/:memberId/commissions route alias', async () => {
      const res = await request(app)
        .get(`/api/v1/members/${member1Id}/commissions`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
    });

    it('should support "me" as memberId parameter', async () => {
      const res = await request(app)
        .get('/api/members/me/commissions')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
    });

    it('should filter commissions by status and level', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions?status=PAID&level=1`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('PAID');
      expect(res.body.data[0].commissionLevel).toBe(1);
      expect(res.body.data[0].grossCommissionAmount).toBe(2400);
    });

    it('should allow admin to view any members commission history', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
    });
  });

  // =========================================================================
  // 2. MEMBER: GET /api/members/:memberId/commissions/summary
  // =========================================================================
  describe('GET /api/members/:memberId/commissions/summary', () => {
    it('should return complete commission summary matching prompt specification', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/summary`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const summary = res.body.data;

      // 6 Mandatory fields from Prompt 23
      expect(summary.totalCommission).toBeDefined();
      expect(summary.pendingCommission).toBeDefined();
      expect(summary.availableCommission).toBeDefined();
      expect(summary.paidCommission).toBeDefined();
      expect(summary.reversedCommission).toBeDefined();
      expect(summary.commissionByLevel).toBeDefined();

      // Quantitative assertions:
      // Paid = 2,400 (Level 1)
      // Pending = 800 (Level 2)
      // Available = 1,300 (Level 3)
      // Reversed = 500 (Level 4)
      // Total (Active) = 2400 + 800 + 1300 = 4,500
      expect(summary.paidCommission).toBe(2400);
      expect(summary.pendingCommission).toBe(800);
      expect(summary.availableCommission).toBe(1300);
      expect(summary.reversedCommission).toBe(500);
      expect(summary.totalCommission).toBe(4500);

      // Level breakdown check: all 5 levels must be represented
      expect(summary.commissionByLevel['1']).toEqual({
        level: 1,
        percentage: 24,
        amount: 2400,
        totalAmount: 2400,
        count: 1,
        paidAmount: 2400,
        pendingAmount: 0,
        availableAmount: 0,
        reversedAmount: 0,
      });

      expect(summary.commissionByLevel['2']).toEqual({
        level: 2,
        percentage: 8,
        amount: 800,
        totalAmount: 800,
        count: 1,
        paidAmount: 0,
        pendingAmount: 800,
        availableAmount: 0,
        reversedAmount: 0,
      });

      expect(summary.commissionByLevel['3']).toEqual({
        level: 3,
        percentage: 13,
        amount: 1300,
        totalAmount: 1300,
        count: 1,
        paidAmount: 0,
        pendingAmount: 0,
        availableAmount: 1300,
        reversedAmount: 0,
      });

      expect(summary.commissionByLevel['4']).toEqual({
        level: 4,
        percentage: 5,
        amount: 500,
        totalAmount: 500,
        count: 1,
        paidAmount: 0,
        pendingAmount: 0,
        availableAmount: 0,
        reversedAmount: 500,
      });

      expect(summary.commissionByLevel['5']).toEqual({
        level: 5,
        percentage: 4,
        amount: 0,
        totalAmount: 0,
        count: 0,
        paidAmount: 0,
        pendingAmount: 0,
        availableAmount: 0,
        reversedAmount: 0,
      });
    });

    it('should reject unauthorized member access to another members summary', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/summary`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });
  });

  // =========================================================================
  // 3. MEMBER: GET /api/members/:memberId/commissions/:commissionId
  // =========================================================================
  describe('GET /api/members/:memberId/commissions/:commissionId', () => {
    it('should return complete transaction details for valid commission record', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/${comm1Id}`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.id).toBe(comm1Id);
      expect(data.commissionLevel).toBe(1);
      expect(data.businessVolume).toBe(10000);
      expect(data.percentage).toBe(24);
      expect(data.grossCommissionAmount).toBe(2400);
      expect(data.status).toBe('PAID');
      expect(data.recipient.distributorCode).toBe('DST-10001');
      expect(data.sourceMember.distributorCode).toBe('DST-99999');
      expect(data.order.orderNumber).toBe('ORD-2026-1001');
      expect(data.walletTransaction.transactionNumber).toBe('WTX-COMM-001');
      expect(data.paidAt).toBeDefined();
    });

    it('should return 404 if commission transaction does not exist', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/comm-non-existent`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should reject unauthorized member trying to view another members commission details', async () => {
      const res = await request(app)
        .get(`/api/members/${member1Id}/commissions/${comm1Id}`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. ADMIN: GET /api/admin/commissions
  // =========================================================================
  describe('GET /api/admin/commissions', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app)
        .get('/api/admin/commissions')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/commissions')
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return all commissions for admin without filters', async () => {
      const res = await request(app)
        .get('/api/admin/commissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.meta.total).toBe(4);
    });

    it('should support filters: member, source member, order, level, status, date range', async () => {
      const res = await request(app)
        .get(`/api/admin/commissions?member=${member1Id}&sourceMember=${sourceMemberId}&order=${order1Id}&level=1&status=PAID`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].commissionLevel).toBe(1);
      expect(res.body.data[0].status).toBe('PAID');
    });
  });

  // =========================================================================
  // 5. ADMIN: POST /api/admin/orders/:orderId/process-commission
  // =========================================================================
  describe('POST /api/admin/orders/:orderId/process-commission', () => {
    it('should reject non-admin access with 403', async () => {
      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({})
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    // -----------------------------------------------------------------------
    // ZERO-TRUST INVARIANTS: STRICT REJECTION OF CLIENT FINANCIAL OVERRIDES
    // -----------------------------------------------------------------------
    it('should STRICTLY REJECT if frontend sends commission amount', async () => {
      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ commissionAmount: 5000 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly prohibited');
    });

    it('should STRICTLY REJECT if frontend sends percentage', async () => {
      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ percentage: 50 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly prohibited');
    });

    it('should STRICTLY REJECT if frontend sends recipientId', async () => {
      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ recipientId: member1Id })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly prohibited');
    });

    it('should STRICTLY REJECT if frontend sends BV', async () => {
      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ totalBV: 99999 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly prohibited');
    });

    it('should process commission authoritatively without accepting client values', async () => {
      vi.spyOn(OrderCommissionLifecycleService, 'processOrderCommission').mockResolvedValue({
        orderId: order1Id,
        orderNumber: 'ORD-2026-1001',
        lifecycleStage: 'COMMISSION_AVAILABLE',
        status: 'SUCCESS',
        isIdempotentSkip: false,
        isEligible: true,
        businessVolume: 10000,
        commissionsCreated: 5,
        totalCommission: 5400,
        recipients: [
          { level: 1, percentage: 24, commissionAmount: 2400, recipientId: member1Id },
        ],
      } as any);

      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Clean empty body
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.businessVolume).toBe(10000);
      expect(res.body.data.totalCommission).toBe(5400);
      expect(OrderCommissionLifecycleService.processOrderCommission).toHaveBeenCalledWith(order1Id);
    });

    it('should safely return existing commission distribution if called repeatedly (idempotency)', async () => {
      vi.spyOn(OrderCommissionLifecycleService, 'processOrderCommission').mockResolvedValue({
        orderId: order1Id,
        orderNumber: 'ORD-2026-1001',
        lifecycleStage: 'COMMISSION_AVAILABLE',
        status: 'ALREADY_PROCESSED',
        isIdempotentSkip: true,
        isEligible: true,
        businessVolume: 10000,
        commissionsCreated: 0,
        totalCommission: 5400,
        recipients: [],
      } as any);

      const res = await request(app)
        .post(`/api/admin/orders/${order1Id}/process-commission`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ALREADY_PROCESSED');
      expect(res.body.data.isIdempotentSkip).toBe(true);
      expect(res.body.message).toContain('already processed');
    });
  });

  // =========================================================================
  // 6. ADMIN: POST /api/admin/commissions/:commissionId/reverse
  // =========================================================================
  describe('POST /api/admin/commissions/:commissionId/reverse', () => {
    it('should reject non-admin access with 403', async () => {
      const res = await request(app)
        .post(`/api/admin/commissions/${comm1Id}/reverse`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({ reason: 'Test' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should STRICTLY REJECT if client passes amount or percentage override', async () => {
      const res = await request(app)
        .post(`/api/admin/commissions/${comm1Id}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 9999 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('strictly prohibited');
    });

    it('should reverse a commission transaction with compensatory ledger record', async () => {
      const res = await request(app)
        .post(`/api/admin/commissions/${comm1Id}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Admin approved chargeback' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.originalCommissionId).toBe(comm1Id);
      expect(res.body.data.amount).toBe(-2400);
      expect(res.body.data.recoveryStatus).toBe('COMPLETED');
      expect(res.body.data.isIdempotentSkip).toBe(false);

      // Verify commission transaction status transitioned to REVERSED
      const updatedComm = inMemoryCommissionTx.get(comm1Id);
      expect(updatedComm.status).toBe('REVERSED');
      expect(updatedComm.reversalReason).toBe('Admin approved chargeback');

      // Verify wallet was debited
      const wallet = inMemoryWallets.get(member1Id);
      expect(Number(wallet.availableBalance)).toBe(2600); // 5000 - 2400
    });

    it('should return existing reversal idempotently if reversed again', async () => {
      // First reversal
      await request(app)
        .post(`/api/admin/commissions/${comm1Id}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'First reversal' });

      // Second reversal
      const res = await request(app)
        .post(`/api/admin/commissions/${comm1Id}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Second reversal duplicate' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isIdempotentSkip).toBe(true);
      expect(res.body.message).toContain('already reversed');
    });
  });
});
