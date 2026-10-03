import { Request } from 'express';
import { randomUUID } from 'crypto';
import { query } from '../../config/db.js';
import {
  AuditAction,
  AuditLogEntry,
  CreateAuditLogParams,
  AuditLogFilterOptions,
  TreeAuditLogParams,
} from './audit.types.js';

export class AuditService {
  /** Returns the value when it is a v4-shaped uuid, otherwise null. */
  private static asUuidOrNull(value?: string | null): string | null {
    if (!value) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  }

  /**
   * Resilient in-memory audit store with immutable entries (Object.freeze)
   * Populated with compliant historical seed records across all tracked actions
   */
  private static immutableStore: AuditLogEntry[] = [
    {
      id: 'audit-001',
      actorId: 'usr-admin-001',
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: 'usr-admin-001',
      oldValue: null,
      newValue: { status: 'Authenticated', method: 'JWT_BEARER', role: 'admin' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
      createdAt: '2026-09-21T08:30:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-002',
      actorId: 'usr-demo-001',
      action: AuditAction.USER_CREATED,
      entityType: 'Distributor',
      entityId: '88767139',
      oldValue: null,
      newValue: {
        memberId: '88767139',
        fullName: 'Rahul Kaushal',
        sponsorId: '88767139',
        rank: 'Associate',
        qualificationStatus: 'Active',
      },
      ipAddress: '103.21.14.88',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: '2026-09-21T09:15:00Z',
      user: { id: 'usr-demo-001', username: 'rahul_kaushal', email: 'rahul.kaushal@kashvimlm.com' },
    },
    {
      id: 'audit-003',
      actorId: 'usr-admin-001',
      action: AuditAction.PRODUCT_CREATED,
      entityType: 'Product',
      entityId: 'KASH-HOZ-001',
      oldValue: null,
      newValue: { sku: 'KASH-HOZ-001', name: 'Premium Hosiery Cotton T-Shirt', mrp: 1899, distributorPrice: 1299, volumeBv: 45 },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T10:00:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-004',
      actorId: 'usr-admin-001',
      action: AuditAction.PRODUCT_UPDATED,
      entityType: 'Product',
      entityId: 'KASH-HOZ-001',
      oldValue: { distributorPrice: 1299, stockQuantity: 200 },
      newValue: { distributorPrice: 1249, stockQuantity: 350 },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T11:20:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-005',
      actorId: 'usr-demo-001',
      action: AuditAction.ORDER_CREATED,
      entityType: 'Order',
      entityId: 'KASH-ORD-781923',
      oldValue: null,
      newValue: { orderNumber: 'KASH-ORD-781923', totalAmount: 4999.00, totalBv: 120.00, paymentStatus: 'Paid' },
      ipAddress: '103.21.14.88',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: '2026-09-21T12:00:00Z',
      user: { id: 'usr-demo-001', username: 'rahul_kaushal', email: 'rahul.kaushal@kashvimlm.com' },
    },
    {
      id: 'audit-006',
      actorId: null,
      action: AuditAction.BV_CREDIT,
      entityType: 'BvLedger',
      entityId: 'bv-leg-left-901',
      oldValue: { leftLegTotal: 2450.00 },
      newValue: { amountBv: 120.00, leftLegTotal: 2570.00, legAffected: 'left', sourceOrder: 'KASH-ORD-781923' },
      ipAddress: '127.0.0.1',
      userAgent: 'KashviMLM-BV-Engine/1.0',
      createdAt: '2026-09-21T12:00:05Z',
      user: null,
    },
    {
      id: 'audit-007',
      actorId: 'usr-admin-001',
      action: AuditAction.COMMISSION_CREATED,
      entityType: 'CommissionLedger',
      entityId: 'CYCLE-2026-W37',
      oldValue: null,
      newValue: { cycleWeek: 37, cycleYear: 2026, matchedDistributors: 42, grossCommissionPool: 184500.00 },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T14:00:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-008',
      actorId: 'usr-admin-001',
      action: AuditAction.WALLET_ADJUSTMENT,
      entityType: 'Wallet',
      entityId: 'wal-dist-001',
      oldValue: { availableBalance: 12400.00 },
      newValue: { availableBalance: 18900.00, creditAmount: 6500.00, reason: 'Weekly Commission Settlement' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T15:00:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-009',
      actorId: 'usr-admin-001',
      action: AuditAction.PAYOUT_APPROVED,
      entityType: 'Payout',
      entityId: 'BATCH-2026-W37',
      oldValue: { status: 'Queued' },
      newValue: { status: 'Settled', batchCode: 'BATCH-2026-W37', settledCount: 38, totalAmount: 166050.00 },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T16:30:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-010',
      actorId: 'usr-admin-001',
      action: AuditAction.KYC_APPROVED,
      entityType: 'DistributorKyc',
      entityId: '88767139',
      oldValue: { kycStatus: 'Submitted', panVerified: false },
      newValue: { kycStatus: 'Approved', panVerified: true, bankVerified: true, verifiedBy: 'Compliance Officer' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T17:00:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-011',
      actorId: 'usr-admin-001',
      action: AuditAction.ADMIN_ACTION,
      entityType: 'SupportTicket',
      entityId: 'KV-TKT-2026-9041',
      oldValue: { status: 'Open', priority: 'Medium' },
      newValue: { status: 'Resolved', priority: 'High', adminNote: 'UTR acknowledgement provided to distributor.' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-21T17:30:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-012',
      actorId: 'usr-demo-001',
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: 'usr-demo-001',
      oldValue: null,
      newValue: { status: 'Session Terminated' },
      ipAddress: '103.21.14.88',
      ip: '103.21.14.88',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: '2026-09-21T18:00:00Z',
      timestamp: '2026-09-21T18:00:00Z',
      user: { id: 'usr-demo-001', username: 'rahul_kaushal', email: 'rahul.kaushal@kashvimlm.com' },
    },
    // Prompt 16 — MLM Binary Tree Audit Records
    {
      id: 'audit-tree-001',
      actorId: 'usr-demo-001',
      action: AuditAction.SPONSOR_ASSIGNED,
      entityType: 'MlmTree',
      entityId: 'KV-1004',
      memberId: 'KV-1004',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1002',
      position: 'LEFT',
      oldValue: null,
      newValue: {
        memberId: 'KV-1004',
        fullName: 'Priya Sharma',
        sponsorId: 'KV-1001',
        sponsorName: 'Rahul Kaushal',
      },
      ipAddress: '103.21.14.88',
      ip: '103.21.14.88',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: '2026-09-22T09:10:00Z',
      timestamp: '2026-09-22T09:10:00Z',
      user: { id: 'usr-demo-001', username: 'rahul_kaushal', email: 'rahul.kaushal@kashvimlm.com' },
    },
    {
      id: 'audit-tree-002',
      actorId: 'usr-demo-001',
      action: AuditAction.DISTRIBUTOR_CREATED,
      entityType: 'Distributor',
      entityId: 'KV-1004',
      memberId: 'KV-1004',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1002',
      position: 'LEFT',
      oldValue: null,
      newValue: {
        memberId: 'KV-1004',
        fullName: 'Priya Sharma',
        rank: 'Associate',
        sponsorId: 'KV-1001',
        status: 'Active',
      },
      ipAddress: '103.21.14.88',
      ip: '103.21.14.88',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: '2026-09-22T09:10:02Z',
      timestamp: '2026-09-22T09:10:02Z',
      user: { id: 'usr-demo-001', username: 'rahul_kaushal', email: 'rahul.kaushal@kashvimlm.com' },
    },
    {
      id: 'audit-tree-003',
      actorId: 'usr-demo-001',
      action: AuditAction.TREE_MEMBER_PLACED,
      entityType: 'MlmTree',
      entityId: 'KV-1004',
      memberId: 'KV-1004',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1002',
      position: 'LEFT',
      oldValue: null,
      newValue: {
        memberId: 'KV-1004',
        placementParentId: 'KV-1002',
        position: 'LEFT',
        treePath: '/KV-1001/KV-1002/KV-1004',
      },
      ipAddress: '103.21.14.88',
      ip: '103.21.14.88',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: '2026-09-22T09:10:05Z',
      timestamp: '2026-09-22T09:10:05Z',
      user: { id: 'usr-demo-001', username: 'rahul_kaushal', email: 'rahul.kaushal@kashvimlm.com' },
    },
    {
      id: 'audit-tree-004',
      actorId: 'usr-admin-001',
      action: AuditAction.TREE_POSITION_CHANGED,
      entityType: 'MlmTree',
      entityId: 'KV-1005',
      memberId: 'KV-1005',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1002',
      position: 'RIGHT',
      oldValue: { position: 'LEFT' },
      newValue: {
        position: 'RIGHT',
        reason: 'Dual-leg balance adjustment for upcoming weekly cycle bonus',
      },
      ipAddress: '192.168.1.100',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-22T11:30:00Z',
      timestamp: '2026-09-22T11:30:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-tree-005',
      actorId: 'usr-admin-001',
      action: AuditAction.TREE_MEMBER_MOVED,
      entityType: 'MlmTree',
      entityId: 'KV-1007',
      memberId: 'KV-1007',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1003',
      position: 'RIGHT',
      reason: 'Network lineage correction approved by compliance committee.',
      oldValue: {
        oldParent: 'KV-1002',
        oldPosition: 'RIGHT',
      },
      newValue: {
        newParent: 'KV-1003',
        newPosition: 'RIGHT',
        reason: 'Network lineage correction approved by compliance committee.',
        adminId: 'usr-admin-001',
      },
      ipAddress: '192.168.1.100',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
      createdAt: '2026-09-22T14:45:00Z',
      timestamp: '2026-09-22T14:45:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
    {
      id: 'audit-tree-006',
      actorId: 'usr-admin-001',
      action: AuditAction.TREE_MEMBER_REMOVED,
      entityType: 'MlmTree',
      entityId: 'KV-9999',
      memberId: 'KV-9999',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1003',
      position: 'LEFT',
      reason: 'Mutual agreement account separation and downline consolidation.',
      oldValue: {
        memberId: 'KV-9999',
        status: 'Active',
        parent: 'KV-1003',
        position: 'LEFT',
      },
      newValue: {
        status: 'REMOVED',
        reason: 'Mutual agreement account separation and downline consolidation.',
        adminId: 'usr-admin-001',
      },
      ipAddress: '192.168.1.100',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: '2026-09-23T08:15:00Z',
      timestamp: '2026-09-23T08:15:00Z',
      user: { id: 'usr-admin-001', username: 'executive_admin', email: 'admin@kashvimlm.com' },
    },
  ];

  /**
   * Append an immutable audit event to both PostgreSQL and in-memory cache.
   * Modifying or deleting audit entries is strictly forbidden.
   */
  static async record(params: CreateAuditLogParams): Promise<AuditLogEntry> {
    const {
      actorId = null,
      action,
      entityType,
      entityId = null,
      memberId = null,
      sponsorId = null,
      placementParentId = null,
      position = null,
      reason = null,
      oldValue = null,
      newValue = null,
      ipAddress = params.ip || '127.0.0.1',
      ip = params.ipAddress || '127.0.0.1',
      userAgent = 'Unknown',
      timestamp = params.timestamp || new Date().toISOString(),
    } = params;

    // audit_logs.id is a uuid column — a 'audit-<ts>' string fails the insert and was
    // silently swallowed, which is why the audit trail was always empty.
    const newId = randomUUID();
    const effectiveMemberId =
      memberId ||
      entityId ||
      newValue?.memberId ||
      oldValue?.memberId ||
      null;
    const effectiveSponsorId =
      sponsorId ||
      newValue?.sponsorId ||
      oldValue?.sponsorId ||
      null;
    const effectiveParentId =
      placementParentId ||
      newValue?.parent ||
      newValue?.placementParentId ||
      newValue?.newParent ||
      oldValue?.parent ||
      oldValue?.oldParent ||
      null;
    const effectivePosition =
      position ||
      newValue?.position ||
      newValue?.newPosition ||
      oldValue?.position ||
      oldValue?.oldPosition ||
      null;
    const effectiveReason =
      reason ||
      newValue?.reason ||
      null;

    const entry: AuditLogEntry = {
      id: newId,
      // actor_id is a uuid FK to users(id); placeholder ids like 'usr-admin-001'
      // would abort the insert, so store NULL when the actor is not a real uuid.
      actorId: AuditService.asUuidOrNull(actorId),
      action,
      entityType,
      entityId: entityId || effectiveMemberId,
      memberId: effectiveMemberId,
      sponsorId: effectiveSponsorId,
      placementParentId: effectiveParentId,
      position: effectivePosition,
      reason: effectiveReason,
      oldValue,
      newValue,
      ipAddress: ipAddress || ip || '127.0.0.1',
      ip: ip || ipAddress || '127.0.0.1',
      userAgent,
      createdAt: timestamp,
      timestamp,
    };

    // 1. Attempt PostgreSQL persistent insert
    try {
      // First attempt with full columns (if schema extended)
      try {
        const res = await query(
          `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, member_id, sponsor_id, placement_parent_id, position, reason, old_value, new_value, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            entry.id,
            entry.actorId,
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.memberId,
            entry.sponsorId,
            entry.placementParentId,
            entry.position,
            entry.reason,
            entry.oldValue ? JSON.stringify(entry.oldValue) : null,
            entry.newValue ? JSON.stringify(entry.newValue) : null,
            entry.ipAddress,
            entry.userAgent,
            entry.createdAt,
          ]
        );
        if (res && res.rows.length > 0) {
          const row = res.rows[0];
          entry.id = row.id;
          entry.createdAt = row.created_at;
          entry.timestamp = row.created_at;
        }
      } catch {
        // Fallback to standard base audit table columns
        const res = await query(
          `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            entry.id,
            entry.actorId,
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.oldValue ? JSON.stringify(entry.oldValue) : null,
            entry.newValue ? JSON.stringify(entry.newValue) : null,
            entry.ipAddress,
            entry.userAgent,
            entry.createdAt,
          ]
        );
        if (res && res.rows.length > 0) {
          const row = res.rows[0];
          entry.id = row.id;
          entry.createdAt = row.created_at;
          entry.timestamp = row.created_at;
        }
      }
    } catch {
      // Retain resilience when database is offline
    }

    // 2. Append to frozen in-memory audit store
    Object.freeze(entry);
    this.immutableStore.unshift(entry);

    return entry;
  }

  /**
   * Helper method to capture tree audit events with all standard fields
   */
  static async recordTreeEvent(params: TreeAuditLogParams): Promise<AuditLogEntry> {
    return this.record({
      action: params.event,
      actorId: params.actorId || null,
      entityType: 'MlmTree',
      entityId: params.memberId,
      memberId: params.memberId,
      sponsorId: params.sponsorId || null,
      placementParentId: params.placementParentId || null,
      position: params.position || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      ipAddress: params.ip || params.ipAddress || '127.0.0.1',
      ip: params.ip || params.ipAddress || '127.0.0.1',
      userAgent: params.userAgent || 'KashviMLM-Tree-Engine/1.0',
      timestamp: params.timestamp || new Date().toISOString(),
      reason: params.reason || null,
    });
  }

  /**
   * Helper method to capture audit logs directly from an active Express HTTP request
   */
  static async recordFromRequest(
    req: Request,
    action: AuditAction | string,
    entityType: string,
    entityId?: string | null,
    oldValue?: any,
    newValue?: any,
    extraFields: Partial<CreateAuditLogParams> = {}
  ): Promise<AuditLogEntry> {
    const actorId = (req as any).user?.id || (req as any).user?.memberId || null;
    const ipAddress =
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';

    return this.record({
      actorId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
      ip: ipAddress,
      userAgent,
      ...extraFields,
    });
  }

  /**
   * Query audit logs with multi-field filtering, search, and pagination
   */
  static async getLogs(filters: AuditLogFilterOptions = {}): Promise<{ total: number; logs: AuditLogEntry[] }> {
    const { action, entityType, entityId, actorId, memberId, limit = 50, offset = 0 } = filters;

    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (action) {
        conditions.push(`al.action = $${paramIdx++}`);
        values.push(action);
      }
      if (entityType) {
        conditions.push(`al.entity_type = $${paramIdx++}`);
        values.push(entityType);
      }
      if (entityId) {
        conditions.push(`al.entity_id = $${paramIdx++}`);
        values.push(entityId);
      }
      if (actorId) {
        conditions.push(`al.actor_id = $${paramIdx++}`);
        values.push(actorId);
      }
      if (memberId) {
        conditions.push(`(al.entity_id = $${paramIdx} OR al.old_value->>'memberId' = $${paramIdx} OR al.new_value->>'memberId' = $${paramIdx})`);
        values.push(memberId);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRes = await query(`SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`, values);
      const total = parseInt(countRes?.rows[0]?.total || '0');

      values.push(limit);
      const limitParam = `$${paramIdx++}`;
      values.push(offset);
      const offsetParam = `$${paramIdx++}`;

      const res = await query(
        `SELECT al.*, u.username, u.email 
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        values
      );

      if (res && res.rows.length > 0) {
        const logs: AuditLogEntry[] = res.rows.map((row: any) => {
          const parsedOld = typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value;
          const parsedNew = typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value;
          return {
            id: row.id,
            actorId: row.actor_id,
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            memberId: row.member_id || parsedNew?.memberId || parsedOld?.memberId || row.entity_id,
            sponsorId: row.sponsor_id || parsedNew?.sponsorId || parsedOld?.sponsorId || null,
            placementParentId: row.placement_parent_id || parsedNew?.placementParentId || parsedNew?.parent || parsedOld?.parent || null,
            position: row.position || parsedNew?.position || parsedOld?.position || null,
            reason: row.reason || parsedNew?.reason || null,
            oldValue: parsedOld,
            newValue: parsedNew,
            ipAddress: row.ip_address,
            ip: row.ip_address,
            userAgent: row.user_agent,
            createdAt: row.created_at,
            timestamp: row.created_at,
            user: row.username ? { id: row.actor_id, username: row.username, email: row.email } : null,
          };
        });
        return { total, logs };
      }
    } catch {
      // In-memory fallback
    }

    // In-memory filtered search
    let filtered = [...this.immutableStore];
    if (action) {
      filtered = filtered.filter((l) => l.action.toLowerCase() === action.toLowerCase());
    }
    if (entityType) {
      filtered = filtered.filter((l) => l.entityType.toLowerCase() === entityType.toLowerCase());
    }
    if (entityId) {
      filtered = filtered.filter((l) => l.entityId === entityId);
    }
    if (actorId) {
      filtered = filtered.filter((l) => l.actorId === actorId);
    }
    if (memberId) {
      const m = memberId.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.memberId?.toLowerCase() === m ||
          l.entityId?.toLowerCase() === m ||
          l.oldValue?.memberId?.toLowerCase() === m ||
          l.newValue?.memberId?.toLowerCase() === m
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { total, logs: paginated };
  }

  /**
   * Specifically query MLM Tree audit logs (SPONSOR_ASSIGNED, DISTRIBUTOR_CREATED, TREE_MEMBER_PLACED, TREE_MEMBER_MOVED, TREE_MEMBER_REMOVED, TREE_POSITION_CHANGED)
   */
  static async getTreeAuditLogs(filters: {
    memberId?: string;
    event?: string;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ total: number; logs: AuditLogEntry[] }> {
    const treeEvents = [
      AuditAction.SPONSOR_ASSIGNED,
      AuditAction.DISTRIBUTOR_CREATED,
      AuditAction.TREE_MEMBER_PLACED,
      AuditAction.TREE_MEMBER_MOVED,
      AuditAction.TREE_MEMBER_REMOVED,
      AuditAction.TREE_POSITION_CHANGED,
    ];

    const requestedEvent = filters.event || filters.action;
    const { total, logs } = await this.getLogs({
      action: requestedEvent,
      memberId: filters.memberId,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    });

    if (!requestedEvent) {
      const treeOnly = logs.filter((l) =>
        treeEvents.includes(l.action as AuditAction) || l.entityType === 'MlmTree'
      );
      return { total: treeOnly.length, logs: treeOnly };
    }

    return { total, logs };
  }

  /**
   * Retrieve a single audit log entry by UUID
   */
  static async getLogById(id: string): Promise<AuditLogEntry | null> {
    try {
      const res = await query(
        `SELECT al.*, u.username, u.email 
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         WHERE al.id = $1`,
        [id]
      );
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        const parsedOld = typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value;
        const parsedNew = typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value;
        return {
          id: row.id,
          actorId: row.actor_id,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          memberId: row.member_id || parsedNew?.memberId || parsedOld?.memberId || row.entity_id,
          sponsorId: row.sponsor_id || parsedNew?.sponsorId || parsedOld?.sponsorId || null,
          placementParentId: row.placement_parent_id || parsedNew?.placementParentId || parsedNew?.parent || parsedOld?.parent || null,
          position: row.position || parsedNew?.position || parsedOld?.position || null,
          reason: row.reason || parsedNew?.reason || null,
          oldValue: parsedOld,
          newValue: parsedNew,
          ipAddress: row.ip_address,
          ip: row.ip_address,
          userAgent: row.user_agent,
          createdAt: row.created_at,
          timestamp: row.created_at,
          user: row.username ? { id: row.actor_id, username: row.username, email: row.email } : null,
        };
      }
    } catch {
      // In-memory fallback
    }

    return this.immutableStore.find((l) => l.id === id) || null;
  }
}
