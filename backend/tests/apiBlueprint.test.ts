import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createAdminToken, createTestToken } from './helpers/testHelpers';
import { DashboardService } from '../src/services/dashboard.service';
import { DistributorService } from '../src/services/distributor.service';
import { BusinessCenterService } from '../src/services/businessCenter.service';
import { ProductService } from '../src/services/product.service';
import { TrainingService } from '../src/services/training.service';
import { NewsService } from '../src/services/news.service';
import { PayoutService } from '../src/services/payout.service';

describe('COMPREHENSIVE API BLUEPRINT SUITE (/api/v1)', () => {
  const memberToken = createTestToken({
    id: 'usr-demo-1001',
    email: 'rahul.example@example.com',
    role: 'DISTRIBUTOR',
  });

  const adminToken = createAdminToken({
    id: 'usr-admin-001',
    email: 'admin@example.com',
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    // Spies to ensure instant execution without hanging on offline database
    vi.spyOn(DashboardService, 'getDashboard').mockResolvedValue({
      distributor: { displayName: 'Rahul Example', distributorCode: 'KV-DEMO-1001' },
      businessCenters: [{ centerCode: 'KV-DEMO-1001-BC1', leftVolume: 14500, rightVolume: 11200 }],
      commissions: { estimatedWeekly: 350.0, balance: 720.0 },
    } as any);

    vi.spyOn(DistributorService, 'getProfileByUserId').mockResolvedValue({
      id: 'dist-1001',
      distributorCode: 'KV-DEMO-1001',
      displayName: 'Rahul Example',
      status: 'ACTIVE',
    } as any);

    vi.spyOn(DistributorService, 'getProfileByIdOrCode').mockResolvedValue({
      id: 'dist-1001',
      distributorCode: 'KV-DEMO-1001',
      displayName: 'Rahul Example',
      status: 'ACTIVE',
    } as any);

    vi.spyOn(DistributorService, 'getTeam').mockResolvedValue([
      { distributorCode: 'KV-DEMO-1002', displayName: 'Alice Miller' },
      { distributorCode: 'KV-DEMO-1003', displayName: 'Bob Chen' },
    ] as any);

    vi.spyOn(DistributorService, 'getTree').mockResolvedValue({
      id: 'node-root',
      distributorCode: 'KV-DEMO-1001',
      children: [],
    } as any);

    vi.spyOn(DistributorService, 'getUpline').mockResolvedValue([] as any);
    vi.spyOn(DistributorService, 'getDownline').mockResolvedValue([] as any);

    vi.spyOn(ProductService, 'getProducts').mockResolvedValue({
      products: [
        { sku: 'CLO-TSHIRT-001', name: "Men's Cotton Hosiery T-Shirt", price: 29.99, bv: 20 },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as any);

    vi.spyOn(ProductService, 'getCategories').mockResolvedValue([
      { slug: 'clothes-hosiery', name: 'Clothes & Hosiery' },
      { slug: 'electronics-smart-devices', name: 'Electronics & Smart Devices' },
    ] as any);

    vi.spyOn(TrainingService, 'getCourses').mockResolvedValue([
      { slug: 'distributor-quick-start', title: 'Distributor Quick Start Blueprint' },
    ] as any);

    vi.spyOn(NewsService, 'getPublicNews').mockResolvedValue({
      data: [{ slug: 'welcome-to-kashvimlm-platform', title: 'Welcome to KashviMLM' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    } as any);

    vi.spyOn(NewsService, 'getAdminNews').mockResolvedValue({
      data: [{ slug: 'welcome-to-kashvimlm-platform', title: 'Welcome to KashviMLM' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as any);

    vi.spyOn(PayoutService, 'getAdminPayouts').mockResolvedValue({
      data: [{ payoutNumber: 'POR-10001', amount: 250.0, status: 'PAID' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as any);

    vi.spyOn(BusinessCenterService, 'getBusinessCenters').mockResolvedValue([
      {
        id: 'bc-1',
        distributorId: 'dist-1001',
        centerNumber: 1,
        centerCode: 'KV-DEMO-1001-BC1',
        status: 'ACTIVE',
        openedAt: new Date(),
        closedAt: null,
        leftVolume: 14500,
        rightVolume: 11200,
        accumulatedLeftVolume: 35000,
        accumulatedRightVolume: 28000,
        nodeId: 'node-1',
        placementParentId: null,
        placementPosition: null,
        depth: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
  });

  describe('1. Auth Blueprint (/api/v1/auth)', () => {
    it('POST /register should be accessible', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({});
      expect([400, 422]).toContain(res.status);
    });

    it('POST /login should be accessible', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect([400, 422]).toContain(res.status);
    });

    it('POST /refresh should be accessible', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({});
      expect([400, 422]).toContain(res.status);
    });

    it('POST /logout should be accessible', async () => {
      const res = await request(app).post('/api/v1/auth/logout').send({});
      expect([200, 400, 422]).toContain(res.status);
    });

    it('GET /me should require auth', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('POST /forgot-password should be accessible', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({});
      expect([400, 422]).toContain(res.status);
    });

    it('POST /reset-password should be accessible', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({});
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('2. Dashboard Blueprint (/api/v1/dashboard)', () => {
    it('GET /api/v1/dashboard should return dashboard payload', async () => {
      const res = await request(app).get('/api/v1/dashboard').expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Distributors Blueprint (/api/v1/distributors)', () => {
    it('GET /api/v1/distributors/me should require authentication', async () => {
      await request(app).get('/api/v1/distributors/me').expect(401);
    });

    it('GET /api/v1/distributors/me with token should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/distributors/:id should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/KV-DEMO-1001')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/distributors/:id/team should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/KV-DEMO-1001/team')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/distributors/:id/tree should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/KV-DEMO-1001/tree')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/distributors/:id/upline should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/KV-DEMO-1001/upline')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/distributors/:id/downline should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/distributors/KV-DEMO-1001/downline')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Core Module Blueprints', () => {
    it('POST /api/v1/enrollments schema validation', async () => {
      const res = await request(app).post('/api/v1/enrollments').send({});
      expect([400, 422]).toContain(res.status);
    });

    it('GET /api/v1/business-centers should respond', async () => {
      const res = await request(app)
        .get('/api/v1/business-centers')
        .set('Authorization', `Bearer ${memberToken}`);
      expect([200, 404]).toContain(res.status);
    });

    it('GET /api/v1/products should respond 200', async () => {
      const res = await request(app).get('/api/v1/products').expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/categories should respond 200', async () => {
      const res = await request(app).get('/api/v1/categories').expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/cart should require authentication', async () => {
      const res = await request(app).get('/api/v1/cart');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/orders should require authentication', async () => {
      const res = await request(app).get('/api/v1/orders');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/bv should require authentication', async () => {
      const res = await request(app).get('/api/v1/bv');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/commissions should require authentication', async () => {
      const res = await request(app).get('/api/v1/commissions');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/wallet should require authentication', async () => {
      const res = await request(app).get('/api/v1/wallet');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/payouts should require authentication', async () => {
      const res = await request(app).get('/api/v1/payouts');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/training should respond 200 with authentication', async () => {
      const res = await request(app)
        .get('/api/v1/training')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/my-website should require authentication', async () => {
      const res = await request(app).get('/api/v1/my-website');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/news should respond 200', async () => {
      const res = await request(app).get('/api/v1/news').expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/support should require authentication', async () => {
      const res = await request(app).get('/api/v1/support');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/support with token should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/support')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/notifications should require authentication', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/notifications with token should respond 200', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Admin Blueprint: All 20 Admin Subroutes (/api/v1/admin)', () => {
    const adminRoutes = [
      '/dashboard',
      '/users',
      '/distributors',
      '/products',
      '/categories',
      '/orders',
      '/inventory',
      '/bv',
      '/commissions',
      '/commission-rules',
      '/wallets',
      '/payouts',
      '/enrollments',
      '/business-centers',
      '/training',
      '/news',
      '/support',
      '/notifications',
      '/settings',
      '/audit-logs',
    ];

    it.each(adminRoutes)('GET /api/v1/admin%s should reject unauthenticated requests with 401', async (subRoute) => {
      await request(app).get(`/api/v1/admin${subRoute}`).expect(401);
    });

    it.each(adminRoutes)('GET /api/v1/admin%s should reject non-admin users with 403', async (subRoute) => {
      await request(app)
        .get(`/api/v1/admin${subRoute}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it.each(adminRoutes)('GET /api/v1/admin%s should allow admin access with 200', async (subRoute) => {
      const res = await request(app)
        .get(`/api/v1/admin${subRoute}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
    });
  });
});
