import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app';
import { TreeAuditService } from '../src/services/treeAudit.service';
import { createAdminToken, createTestToken } from './helpers/testHelpers';

describe('MLM TREE AUDIT LOGGING TESTS (PROMPT 16)', () => {
  const adminToken = createAdminToken();

  const normalUserToken = createTestToken({
    id: 'usr-dist-1002',
    email: 'amit@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });

  beforeEach(() => {
    // Reset or ensure state is ready
  });

  describe('1. Track Required MLM Tree Audit Operations', () => {
    it('should track DISTRIBUTOR_CREATED with all required fields', async () => {
      const record = await TreeAuditService.logDistributorCreated({
        actorId: 'usr-admin-001',
        memberId: 'KV-2001',
        sponsorId: 'KV-1001',
        details: { legalName: 'Sanjay Sharma', status: 'ACTIVE' },
        ip: '103.21.244.2',
        userAgent: 'KashviMLM Web/1.0',
      });

      expect(record.action).toBe('DISTRIBUTOR_CREATED');
      expect(record.actorId).toBe('usr-admin-001');
      expect(record.memberId).toBe('KV-2001');
      expect(record.sponsorId).toBe('KV-1001');
      expect(record.placementParentId).toBeNull();
      expect(record.position).toBeNull();
      expect(record.oldValue).toBeNull();
      expect(record.newValue).toBeDefined();
      expect(record.timestamp).toBeDefined();
      expect(record.ip).toBe('103.21.244.2');
      expect(record.IP).toBe('103.21.244.2');
      expect(record.userAgent).toBe('KashviMLM Web/1.0');
    });

    it('should track SPONSOR_ASSIGNED with all required fields', async () => {
      const record = await TreeAuditService.logSponsorAssigned({
        actorId: 'usr-admin-001',
        memberId: 'KV-2001',
        sponsorId: 'KV-1001',
        oldSponsorId: null,
        ip: '103.21.244.2',
        userAgent: 'KashviMLM Web/1.0',
      });

      expect(record.action).toBe('SPONSOR_ASSIGNED');
      expect(record.actorId).toBe('usr-admin-001');
      expect(record.memberId).toBe('KV-2001');
      expect(record.sponsorId).toBe('KV-1001');
      expect(record.newValue).toEqual({ sponsorId: 'KV-1001' });
      expect(record.timestamp).toBeDefined();
      expect(record.IP).toBe('103.21.244.2');
    });

    it('should track TREE_MEMBER_PLACED with all required fields', async () => {
      const record = await TreeAuditService.logTreeMemberPlaced({
        actorId: 'KV-1001',
        memberId: 'KV-2001',
        sponsorId: 'KV-1001',
        placementParentId: 'KV-1002',
        position: 'LEFT',
        depth: 2,
        path: 'ROOT/L/L',
        ip: '45.12.33.1',
        userAgent: 'Mozilla/5.0 Supertest',
      });

      expect(record.action).toBe('TREE_MEMBER_PLACED');
      expect(record.actorId).toBe('KV-1001');
      expect(record.memberId).toBe('KV-2001');
      expect(record.sponsorId).toBe('KV-1001');
      expect(record.placementParentId).toBe('KV-1002');
      expect(record.position).toBe('LEFT');
      expect(record.oldValue).toBeNull();
      expect(record.newValue).toMatchObject({
        placementParentId: 'KV-1002',
        position: 'LEFT',
        depth: 2,
      });
      expect(record.timestamp).toBeDefined();
      expect(record.ip).toBe('45.12.33.1');
      expect(record.userAgent).toBe('Mozilla/5.0 Supertest');
    });

    it('should track TREE_MEMBER_MOVED with all required fields', async () => {
      const record = await TreeAuditService.logTreeMemberMoved({
        actorId: 'usr-admin-001',
        memberId: 'KV-2001',
        sponsorId: 'KV-1001',
        oldParent: 'KV-1002',
        oldPosition: 'LEFT',
        newParent: 'KV-1003',
        newPosition: 'RIGHT',
        reason: 'Network balancing per management order #991',
        adminId: 'usr-admin-001',
        ip: '127.0.0.1',
        userAgent: 'Admin Suite/1.0',
      });

      expect(record.action).toBe('TREE_MEMBER_MOVED');
      expect(record.actorId).toBe('usr-admin-001');
      expect(record.memberId).toBe('KV-2001');
      expect(record.placementParentId).toBe('KV-1003');
      expect(record.position).toBe('RIGHT');
      expect(record.oldValue).toMatchObject({ parent: 'KV-1002', position: 'LEFT' });
      expect(record.newValue).toMatchObject({ parent: 'KV-1003', position: 'RIGHT' });
      expect(record.reason).toBe('Network balancing per management order #991');
      expect(record.oldParent).toBe('KV-1002');
      expect(record.oldPosition).toBe('LEFT');
      expect(record.newParent).toBe('KV-1003');
      expect(record.newPosition).toBe('RIGHT');
      expect(record.adminId).toBe('usr-admin-001');
      expect(record.timestamp).toBeDefined();
      expect(record.IP).toBe('127.0.0.1');
    });

    it('should track TREE_MEMBER_REMOVED with all required fields', async () => {
      const record = await TreeAuditService.logTreeMemberRemoved({
        actorId: 'usr-admin-001',
        memberId: 'KV-2099',
        sponsorId: 'KV-1001',
        placementParentId: 'KV-1003',
        position: 'RIGHT',
        reason: 'Voluntary resignation & account termination',
        adminId: 'usr-admin-001',
        ip: '127.0.0.1',
        userAgent: 'Admin Suite/1.0',
      });

      expect(record.action).toBe('TREE_MEMBER_REMOVED');
      expect(record.actorId).toBe('usr-admin-001');
      expect(record.memberId).toBe('KV-2099');
      expect(record.reason).toBe('Voluntary resignation & account termination');
      expect(record.oldValue).toMatchObject({ status: 'ACTIVE', position: 'RIGHT' });
      expect(record.newValue).toMatchObject({ status: 'REMOVED' });
      expect(record.adminId).toBe('usr-admin-001');
      expect(record.timestamp).toBeDefined();
      expect(record.ip).toBe('127.0.0.1');
    });

    it('should track TREE_POSITION_CHANGED with all required fields', async () => {
      const record = await TreeAuditService.logTreePositionChanged({
        actorId: 'usr-admin-001',
        memberId: 'KV-2001',
        sponsorId: 'KV-1001',
        placementParentId: 'KV-1003',
        oldPosition: 'LEFT',
        newPosition: 'RIGHT',
        reason: 'Switching leg under same parent to correct initial placement error',
        adminId: 'usr-admin-001',
        ip: '127.0.0.1',
        userAgent: 'Admin Suite/1.0',
      });

      expect(record.action).toBe('TREE_POSITION_CHANGED');
      expect(record.actorId).toBe('usr-admin-001');
      expect(record.memberId).toBe('KV-2001');
      expect(record.placementParentId).toBe('KV-1003');
      expect(record.position).toBe('RIGHT');
      expect(record.oldValue).toMatchObject({ position: 'LEFT' });
      expect(record.newValue).toMatchObject({ position: 'RIGHT' });
      expect(record.reason).toBe(
        'Switching leg under same parent to correct initial placement error'
      );
      expect(record.oldParent).toBe('KV-1003');
      expect(record.oldPosition).toBe('LEFT');
      expect(record.newParent).toBe('KV-1003');
      expect(record.newPosition).toBe('RIGHT');
      expect(record.adminId).toBe('usr-admin-001');
      expect(record.timestamp).toBeDefined();
    });
  });

  describe('2. Admin Placement Changes: Strictly Require All 6 Fields', () => {
    it('should REJECT placement change when Reason is missing or empty', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          // reason is missing
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should REJECT placement change when Old Parent is missing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Correcting team structure error',
          // oldParent is missing
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should REJECT placement change when Old Position is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Correcting team structure error',
          oldParent: 'KV-1002',
          oldPosition: 'MIDDLE', // Invalid position
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should REJECT placement change when New Parent is missing', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Correcting team structure error',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          // newParent missing
          newPosition: 'RIGHT',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should REJECT placement change when New Position is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Correcting team structure error',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          // newPosition missing
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should REJECT unauthenticated or non-admin attempts with 401 or 403', async () => {
      // Unauthenticated -> 401
      await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .send({
          memberId: 'KV-1006',
          reason: 'Attempted unauthorized change',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(401);

      // Normal distributor -> 403
      await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Attempted non-admin change',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(403);
    });

    it('should SUCCEED and record audit log when all 6 fields are provided by admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Corporate reorganization of northern sales division approved under CR-7721',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const audit = res.body.data.auditRecord;
      expect(audit).toBeDefined();
      expect(audit.action).toBe('TREE_MEMBER_MOVED');
      expect(audit.memberId).toBe('KV-1006');
      expect(audit.reason).toContain('CR-7721');
      expect(audit.oldParent).toBe('KV-1002');
      expect(audit.oldPosition).toBe('LEFT');
      expect(audit.newParent).toBe('KV-1003');
      expect(audit.newPosition).toBe('RIGHT');
      expect(audit.adminId).toBe('usr-admin-001');
      expect(audit.actorId).toBe('usr-admin-001');
      expect(audit.timestamp).toBeDefined();
      expect(audit.ip).toBeDefined();
      expect(audit.userAgent).toBeDefined();
    });

    it('should record TREE_POSITION_CHANGED when only position is swapped under same parent', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1007',
          reason: 'Swapping leg from LEFT to RIGHT under same parent for volume balance',
          oldParent: 'KV-1003',
          oldPosition: 'LEFT',
          newParent: 'KV-1003',
          newPosition: 'RIGHT',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const audit = res.body.data.auditRecord;
      expect(audit.action).toBe('TREE_POSITION_CHANGED');
      expect(audit.memberId).toBe('KV-1007');
      expect(audit.oldParent).toBe('KV-1003');
      expect(audit.newParent).toBe('KV-1003');
      expect(audit.oldPosition).toBe('LEFT');
      expect(audit.newPosition).toBe('RIGHT');
      expect(audit.adminId).toBe('usr-admin-001');
    });

    it('should REJECT self-placement attempt by admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/tree/change-placement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: 'KV-1006',
          reason: 'Illegal self placement attempt',
          oldParent: 'KV-1002',
          oldPosition: 'LEFT',
          newParent: 'KV-1006', // Self parent
          newPosition: 'RIGHT',
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.code).toBe('SELF_PLACEMENT_NOT_ALLOWED');
    });
  });

  describe('3. Immutability: Audit Records Cannot Be Edited or Deleted', () => {
    it('should FORBID normal users from deleting audit records with 403', async () => {
      const res = await request(app)
        .delete('/api/v1/tree/audit/logs/tree-audit-001')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUDIT_LOG_IMMUTABLE');
    });

    it('should FORBID normal users from updating audit records with 403 (PUT/PATCH)', async () => {
      const resPut = await request(app)
        .put('/api/v1/tree/audit/logs/tree-audit-001')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ reason: 'tampered reason' })
        .expect(403);

      expect(resPut.body.code).toBe('AUDIT_LOG_IMMUTABLE');

      const resPatch = await request(app)
        .patch('/api/v1/tree/audit/logs/tree-audit-001')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ action: 'FAKE_ACTION' })
        .expect(403);

      expect(resPatch.body.code).toBe('AUDIT_LOG_IMMUTABLE');
    });

    it('should FORBID even admins from mutating or deleting audit records (Compliance Immutability)', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/tree/audit-logs/tree-audit-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.code).toBe('AUDIT_LOG_IMMUTABLE');

      const resPut = await request(app)
        .put('/api/v1/admin/tree/audit-logs/tree-audit-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'admin tampering' })
        .expect(403);

      expect(resPut.body.code).toBe('AUDIT_LOG_IMMUTABLE');
    });
  });

  describe('4. Querying and Viewing Audit Logs', () => {
    it('should return all audit logs for admin with meta pagination', async () => {
      const res = await request(app)
        .get('/api/v1/tree/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThan(0);

      // Verify log structure contains all prompt fields
      const log = res.body.data[0];
      expect(log.action).toBeDefined();
      expect(log.actorId).toBeDefined();
      expect(log.memberId).toBeDefined();
      expect(log.timestamp).toBeDefined();
      expect(log.ip || log.IP).toBeDefined();
      expect(log.userAgent).toBeDefined();
    });

    it('should filter audit logs by memberId', async () => {
      const res = await request(app)
        .get('/api/v1/tree/audit/logs?memberId=KV-1002')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      res.body.data.forEach((l: any) => {
        expect(l.memberId).toBe('KV-1002');
      });
    });

    it('should filter audit logs by action type', async () => {
      const res = await request(app)
        .get('/api/v1/tree/audit/logs?action=TREE_MEMBER_MOVED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      res.body.data.forEach((l: any) => {
        expect(l.action).toBe('TREE_MEMBER_MOVED');
        expect(l.reason).toBeDefined();
        expect(l.oldParent).toBeDefined();
        expect(l.oldPosition).toBeDefined();
        expect(l.newParent).toBeDefined();
        expect(l.newPosition).toBeDefined();
        expect(l.adminId).toBeDefined();
      });
    });

    it('should retrieve single audit record by ID', async () => {
      const res = await request(app)
        .get('/api/v1/tree/audit/logs/tree-audit-008')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('tree-audit-008');
      expect(res.body.data.action).toBe('TREE_MEMBER_MOVED');
      expect(res.body.data.reason).toBeDefined();
      expect(res.body.data.oldParent).toBe('KV-1003');
      expect(res.body.data.newParent).toBe('KV-1005');
      expect(res.body.data.adminId).toBe('usr-admin-001');
    });
  });
});
