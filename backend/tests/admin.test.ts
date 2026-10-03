/**
 * Test Suite: Admin Authorization & Audit Logging Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Admin authorization guards (401 unauthenticated, 403 non-admin roles)
 * - Administrative access granted for ADMIN & SUPER_ADMIN
 * - Audit logs retrieval & filtering
 * - Audit logs immutability compliance (rejection of deletion / truncation)
 * - Financial audit trail tracking (wallet adjustments, payout approvals)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { AuditService } from '../src/services/audit.service';
import { createAdminToken, createCustomerToken, createTestToken } from './helpers/testHelpers';

describe('ADMIN MODULE & AUDIT LOGS AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const adminToken = createAdminToken();
  const distributorToken = createTestToken();
  const customerToken = createCustomerToken();

  describe('1. Role-Based Authorization Enforcement', () => {
    it('should reject unauthenticated request to /api/v1/admin/audit-logs with 401', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authorization token is missing or malformed');
    });

    it('should reject DISTRIBUTOR role access to /api/v1/admin/audit-logs with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${distributorToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should reject CUSTOMER role access to /api/v1/admin/audit-logs with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should grant access to /api/v1/admin/audit-logs with ADMIN credentials', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should reject non-admin access to financial commission-periods endpoint with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/commission-periods')
        .set('Authorization', `Bearer ${distributorToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('should reject non-admin access to financial payout approval endpoint with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/payouts/11111111-2222-3333-4444-555555555555/approve')
        .set('Authorization', `Bearer ${distributorToken}`)
        .send({ adminNotes: 'Hacking approval' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Audit Logs Retrieval & Filtering', () => {
    it('should retrieve historical compliance audit trail', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('action');
      expect(res.body.data[0]).toHaveProperty('entityType');
    });

    it('should filter audit logs by action (e.g. WALLET_CREDIT)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?action=WALLET_CREDIT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const log of res.body.data) {
        expect(log.action.toLowerCase()).toBe('wallet_credit');
      }
    });

    it('should filter audit logs by entityType (e.g. Payout)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?entityType=Payout')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const log of res.body.data) {
        expect(log.entityType.toLowerCase()).toBe('payout');
      }
    });
  });

  describe('3. Immutability Compliance (Anti-Tampering / No Deletion)', () => {
    it('should strictly prohibit bulk deletion of audit logs (DELETE /api/v1/admin/audit-logs)', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Immutable compliance violation');
    });

    it('should strictly prohibit single record deletion of audit logs (DELETE /api/v1/admin/audit-logs/:id)', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/audit-logs/audit-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Immutable compliance violation');
    });
  });

  describe('4. Financial Audit Trail Recording', () => {
    it('should record an immutable audit log entry for financial actions', async () => {
      const entry = await AuditService.recordLog({
        userId: 'usr-admin-001',
        action: 'WALLET_DEBIT',
        entityType: 'Wallet',
        entityId: 'wal-test-999',
        oldValue: { balance: 1000 },
        newValue: { balance: 800, amount: 200, reason: 'Annual renewal fee' },
        ipAddress: '127.0.0.1',
        userAgent: 'Supertest Vitest Agent',
      });

      expect(entry).toBeDefined();
      expect(entry.action).toBe('WALLET_DEBIT');
      expect(entry.entityType).toBe('Wallet');
      expect(entry.entityId).toBe('wal-test-999');

      // Verify the recorded entry is discoverable in query
      const retrieved = await AuditService.getAuditLogs({ action: 'WALLET_DEBIT' });
      expect(retrieved.logs.length).toBeGreaterThan(0);
      expect(retrieved.logs.some((l) => l.entityId === 'wal-test-999')).toBe(true);
    });
  });

  describe('5. System Overview Metrics (/api/v1/admin/metrics)', () => {
    it('should provide system overview metrics for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalMembers).toBeGreaterThan(0);
      expect(res.body.data.totalBVTurnover).toBeGreaterThan(0);
      expect(res.body.data.systemStatus).toBe('HEALTHY');
    });
  });
});
