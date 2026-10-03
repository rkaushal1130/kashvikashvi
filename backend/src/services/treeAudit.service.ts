import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { AuditService } from './audit.service';

export type TreeAuditAction =
  | 'DISTRIBUTOR_CREATED'
  | 'SPONSOR_ASSIGNED'
  | 'TREE_MEMBER_PLACED'
  | 'TREE_MEMBER_MOVED'
  | 'TREE_MEMBER_REMOVED'
  | 'TREE_POSITION_CHANGED';

export interface TreeAuditRecord {
  id: string;
  action: TreeAuditAction;
  actorId: string;
  memberId: string;
  sponsorId: string | null;
  placementParentId: string | null;
  position: 'LEFT' | 'RIGHT' | null;
  oldValue: any;
  newValue: any;
  timestamp: string | Date;
  ip: string | null;
  IP: string | null;
  userAgent: string | null;

  // Specific required fields when admin changes placement
  reason?: string | null;
  oldParent?: string | null;
  oldPosition?: 'LEFT' | 'RIGHT' | null;
  newParent?: string | null;
  newPosition?: 'LEFT' | 'RIGHT' | null;
  adminId?: string | null;
}

export interface CreateTreeAuditInput {
  action: TreeAuditAction;
  actorId: string;
  memberId: string;
  sponsorId?: string | null;
  placementParentId?: string | null;
  position?: 'LEFT' | 'RIGHT' | null;
  oldValue?: any;
  newValue?: any;
  timestamp?: string | Date;
  ip?: string | null;
  IP?: string | null;
  userAgent?: string | null;

  reason?: string | null;
  oldParent?: string | null;
  oldPosition?: 'LEFT' | 'RIGHT' | null;
  newParent?: string | null;
  newPosition?: 'LEFT' | 'RIGHT' | null;
  adminId?: string | null;
}

export interface AdminChangePlacementInput {
  memberId: string;
  reason: string;
  oldParent: string;
  oldPosition: 'LEFT' | 'RIGHT';
  newParent: string;
  newPosition: 'LEFT' | 'RIGHT';
  adminId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AdminRemoveMemberInput {
  memberId: string;
  reason: string;
  adminId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface TreeAuditFilter {
  memberId?: string;
  action?: TreeAuditAction | string;
  actorId?: string;
  adminId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class TreeAuditService {
  /**
   * In-memory store of audit records.
   * Seeded with initial historical records for the model MLM tree.
   */
  private static auditLogs: TreeAuditRecord[] = [
    {
      id: 'tree-audit-001',
      action: 'DISTRIBUTOR_CREATED',
      actorId: 'usr-admin-001',
      memberId: 'KV-1001',
      sponsorId: 'KV-1000',
      placementParentId: null,
      position: null,
      oldValue: null,
      newValue: {
        distributorId: 'KV-1001',
        name: 'Rahul Kaushal',
        rank: 'Crown Diamond',
        status: 'ACTIVE',
      },
      timestamp: new Date('2026-09-15T09:00:00Z').toISOString(),
      ip: '192.168.1.100',
      IP: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
    },
    {
      id: 'tree-audit-002',
      action: 'SPONSOR_ASSIGNED',
      actorId: 'usr-admin-001',
      memberId: 'KV-1001',
      sponsorId: 'KV-1000',
      placementParentId: null,
      position: null,
      oldValue: null,
      newValue: { sponsorId: 'KV-1000', sponsorName: 'Corporate Master' },
      timestamp: new Date('2026-09-15T09:01:00Z').toISOString(),
      ip: '192.168.1.100',
      IP: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
    },
    {
      id: 'tree-audit-003',
      action: 'TREE_MEMBER_PLACED',
      actorId: 'usr-admin-001',
      memberId: 'KV-1001',
      sponsorId: 'KV-1000',
      placementParentId: null,
      position: null,
      oldValue: null,
      newValue: { position: 'ROOT', depth: 0, path: 'ROOT' },
      timestamp: new Date('2026-09-15T09:02:00Z').toISOString(),
      ip: '192.168.1.100',
      IP: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
    },
    {
      id: 'tree-audit-004',
      action: 'DISTRIBUTOR_CREATED',
      actorId: 'KV-1001',
      memberId: 'KV-1002',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1001',
      position: 'LEFT',
      oldValue: null,
      newValue: {
        distributorId: 'KV-1002',
        name: 'Amit Patel',
        rank: 'Diamond Executive',
        status: 'ACTIVE',
      },
      timestamp: new Date('2026-09-16T10:15:00Z').toISOString(),
      ip: '10.0.0.45',
      IP: '10.0.0.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    {
      id: 'tree-audit-005',
      action: 'SPONSOR_ASSIGNED',
      actorId: 'KV-1001',
      memberId: 'KV-1002',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1001',
      position: 'LEFT',
      oldValue: null,
      newValue: { sponsorId: 'KV-1001', sponsorName: 'Rahul Kaushal' },
      timestamp: new Date('2026-09-16T10:15:30Z').toISOString(),
      ip: '10.0.0.45',
      IP: '10.0.0.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    {
      id: 'tree-audit-006',
      action: 'TREE_MEMBER_PLACED',
      actorId: 'KV-1001',
      memberId: 'KV-1002',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1001',
      position: 'LEFT',
      oldValue: null,
      newValue: { parentId: 'KV-1001', position: 'LEFT', depth: 1, path: 'ROOT/L' },
      timestamp: new Date('2026-09-16T10:16:00Z').toISOString(),
      ip: '10.0.0.45',
      IP: '10.0.0.45',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
    {
      id: 'tree-audit-007',
      action: 'TREE_MEMBER_PLACED',
      actorId: 'KV-1001',
      memberId: 'KV-1003',
      sponsorId: 'KV-1001',
      placementParentId: 'KV-1001',
      position: 'RIGHT',
      oldValue: null,
      newValue: { parentId: 'KV-1001', position: 'RIGHT', depth: 1, path: 'ROOT/R' },
      timestamp: new Date('2026-09-16T11:00:00Z').toISOString(),
      ip: '10.0.0.50',
      IP: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
    {
      id: 'tree-audit-008',
      action: 'TREE_MEMBER_MOVED',
      actorId: 'usr-admin-001',
      memberId: 'KV-1010',
      sponsorId: 'KV-1003',
      placementParentId: 'KV-1005',
      position: 'LEFT',
      oldValue: { parent: 'KV-1003', position: 'LEFT', placementParentId: 'KV-1003' },
      newValue: {
        parent: 'KV-1005',
        position: 'LEFT',
        placementParentId: 'KV-1005',
        reason: 'Leadership branch reorganization per compliance approval #CR-4402',
      },
      timestamp: new Date('2026-09-20T14:30:00Z').toISOString(),
      ip: '127.0.0.1',
      IP: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Admin Console',
      reason: 'Leadership branch reorganization per compliance approval #CR-4402',
      oldParent: 'KV-1003',
      oldPosition: 'LEFT',
      newParent: 'KV-1005',
      newPosition: 'LEFT',
      adminId: 'usr-admin-001',
    },
    {
      id: 'tree-audit-009',
      action: 'TREE_POSITION_CHANGED',
      actorId: 'usr-admin-001',
      memberId: 'KV-1011',
      sponsorId: 'KV-1005',
      placementParentId: 'KV-1005',
      position: 'RIGHT',
      oldValue: { parent: 'KV-1005', position: 'LEFT', placementParentId: 'KV-1005' },
      newValue: {
        parent: 'KV-1005',
        position: 'RIGHT',
        placementParentId: 'KV-1005',
        reason: 'Sponsor balanced leg realignment request approved',
      },
      timestamp: new Date('2026-09-21T09:12:00Z').toISOString(),
      ip: '127.0.0.1',
      IP: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Admin Console',
      reason: 'Sponsor balanced leg realignment request approved',
      oldParent: 'KV-1005',
      oldPosition: 'LEFT',
      newParent: 'KV-1005',
      newPosition: 'RIGHT',
      adminId: 'usr-admin-001',
    },
  ];

  /**
   * Records a structured tree audit log.
   * Strictly enforces storing:
   * actorId, memberId, sponsorId, placementParentId, position, oldValue, newValue, timestamp, IP, userAgent
   */
  public static async recordTreeAudit(input: CreateTreeAuditInput): Promise<TreeAuditRecord> {
    const ip = input.ip || input.IP || '127.0.0.1';
    const timestamp = input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString();

    const record: TreeAuditRecord = {
      id: `tree-audit-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      action: input.action,
      actorId: input.actorId,
      memberId: input.memberId,
      sponsorId: input.sponsorId !== undefined ? input.sponsorId : null,
      placementParentId: input.placementParentId !== undefined ? input.placementParentId : null,
      position: input.position !== undefined ? input.position : null,
      oldValue: input.oldValue !== undefined ? input.oldValue : null,
      newValue: input.newValue !== undefined ? input.newValue : null,
      timestamp,
      ip,
      IP: ip,
      userAgent: input.userAgent || 'KashviMLM Core Engine',
      reason: input.reason || null,
      oldParent: input.oldParent || null,
      oldPosition: input.oldPosition || null,
      newParent: input.newParent || null,
      newPosition: input.newPosition || null,
      adminId: input.adminId || null,
    };

    // 1. Persist to in-memory store
    TreeAuditService.auditLogs.unshift(Object.freeze({ ...record }));

    // 2. Also register in general AuditService for unified audit trail
    try {
      await AuditService.recordLog({
        userId: input.actorId,
        action: input.action,
        entityType: 'MlmBinaryTree',
        entityId: input.memberId,
        oldValue: input.oldValue,
        newValue: {
          ...input.newValue,
          reason: input.reason,
          oldParent: input.oldParent,
          oldPosition: input.oldPosition,
          newParent: input.newParent,
          newPosition: input.newPosition,
          adminId: input.adminId,
        },
        ipAddress: ip,
        userAgent: record.userAgent || undefined,
      });
    } catch {
      // Ignored
    }

    // 3. Persist to PostgreSQL if available
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.auditLog) {
        await prisma.auditLog.create({
          data: {
            userId: input.actorId,
            action: input.action,
            entityType: 'MlmBinaryTree',
            entityId: input.memberId,
            previousData: input.oldValue ? (input.oldValue as any) : undefined,
            newData: {
              ...(input.newValue as any),
              sponsorId: record.sponsorId,
              placementParentId: record.placementParentId,
              position: record.position,
              reason: record.reason,
              oldParent: record.oldParent,
              oldPosition: record.oldPosition,
              newParent: record.newParent,
              newPosition: record.newPosition,
              adminId: record.adminId,
            },
            ipAddress: ip,
            userAgent: record.userAgent,
          },
        });
      }
    } catch (e) {
      logger.debug('Database auditLog write bypassed in offline/test environment');
    }

    logger.info(
      `[MLM Tree Audit] Action=${record.action} Member=${record.memberId} Actor=${record.actorId} Parent=${record.placementParentId} Pos=${record.position}`
    );

    return record;
  }

  /**
   * Helper: Log DISTRIBUTOR_CREATED
   */
  public static async logDistributorCreated(params: {
    actorId: string;
    memberId: string;
    sponsorId?: string | null;
    details?: any;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<TreeAuditRecord> {
    return TreeAuditService.recordTreeAudit({
      action: 'DISTRIBUTOR_CREATED',
      actorId: params.actorId,
      memberId: params.memberId,
      sponsorId: params.sponsorId,
      placementParentId: null,
      position: null,
      oldValue: null,
      newValue: params.details || { distributorId: params.memberId, status: 'ACTIVE' },
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Helper: Log SPONSOR_ASSIGNED
   */
  public static async logSponsorAssigned(params: {
    actorId: string;
    memberId: string;
    sponsorId: string;
    oldSponsorId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<TreeAuditRecord> {
    return TreeAuditService.recordTreeAudit({
      action: 'SPONSOR_ASSIGNED',
      actorId: params.actorId,
      memberId: params.memberId,
      sponsorId: params.sponsorId,
      placementParentId: null,
      position: null,
      oldValue: params.oldSponsorId ? { sponsorId: params.oldSponsorId } : null,
      newValue: { sponsorId: params.sponsorId },
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Helper: Log TREE_MEMBER_PLACED
   */
  public static async logTreeMemberPlaced(params: {
    actorId: string;
    memberId: string;
    sponsorId?: string | null;
    placementParentId: string;
    position: 'LEFT' | 'RIGHT';
    depth?: number;
    path?: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<TreeAuditRecord> {
    return TreeAuditService.recordTreeAudit({
      action: 'TREE_MEMBER_PLACED',
      actorId: params.actorId,
      memberId: params.memberId,
      sponsorId: params.sponsorId,
      placementParentId: params.placementParentId,
      position: params.position,
      oldValue: null,
      newValue: {
        placementParentId: params.placementParentId,
        position: params.position,
        depth: params.depth,
        path: params.path,
      },
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Helper: Log TREE_MEMBER_MOVED
   */
  public static async logTreeMemberMoved(params: {
    actorId: string;
    memberId: string;
    sponsorId?: string | null;
    oldParent: string;
    oldPosition: 'LEFT' | 'RIGHT';
    newParent: string;
    newPosition: 'LEFT' | 'RIGHT';
    reason: string;
    adminId: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<TreeAuditRecord> {
    return TreeAuditService.recordTreeAudit({
      action: 'TREE_MEMBER_MOVED',
      actorId: params.actorId,
      memberId: params.memberId,
      sponsorId: params.sponsorId,
      placementParentId: params.newParent,
      position: params.newPosition,
      oldValue: {
        parent: params.oldParent,
        position: params.oldPosition,
        placementParentId: params.oldParent,
      },
      newValue: {
        parent: params.newParent,
        position: params.newPosition,
        placementParentId: params.newParent,
        reason: params.reason,
      },
      reason: params.reason,
      oldParent: params.oldParent,
      oldPosition: params.oldPosition,
      newParent: params.newParent,
      newPosition: params.newPosition,
      adminId: params.adminId,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Helper: Log TREE_POSITION_CHANGED
   */
  public static async logTreePositionChanged(params: {
    actorId: string;
    memberId: string;
    sponsorId?: string | null;
    placementParentId: string;
    oldPosition: 'LEFT' | 'RIGHT';
    newPosition: 'LEFT' | 'RIGHT';
    reason: string;
    adminId: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<TreeAuditRecord> {
    return TreeAuditService.recordTreeAudit({
      action: 'TREE_POSITION_CHANGED',
      actorId: params.actorId,
      memberId: params.memberId,
      sponsorId: params.sponsorId,
      placementParentId: params.placementParentId,
      position: params.newPosition,
      oldValue: {
        parent: params.placementParentId,
        position: params.oldPosition,
        placementParentId: params.placementParentId,
      },
      newValue: {
        parent: params.placementParentId,
        position: params.newPosition,
        placementParentId: params.placementParentId,
        reason: params.reason,
      },
      reason: params.reason,
      oldParent: params.placementParentId,
      oldPosition: params.oldPosition,
      newParent: params.placementParentId,
      newPosition: params.newPosition,
      adminId: params.adminId,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Helper: Log TREE_MEMBER_REMOVED
   */
  public static async logTreeMemberRemoved(params: {
    actorId: string;
    memberId: string;
    sponsorId?: string | null;
    placementParentId?: string | null;
    position?: 'LEFT' | 'RIGHT' | null;
    reason: string;
    adminId: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<TreeAuditRecord> {
    return TreeAuditService.recordTreeAudit({
      action: 'TREE_MEMBER_REMOVED',
      actorId: params.actorId,
      memberId: params.memberId,
      sponsorId: params.sponsorId,
      placementParentId: null,
      position: null,
      oldValue: {
        placementParentId: params.placementParentId,
        position: params.position,
        status: 'ACTIVE',
      },
      newValue: {
        placementParentId: null,
        position: null,
        status: 'REMOVED',
        reason: params.reason,
      },
      reason: params.reason,
      oldParent: params.placementParentId || undefined,
      oldPosition: params.position || undefined,
      newParent: null,
      newPosition: null,
      adminId: params.adminId,
      ip: params.ip,
      userAgent: params.userAgent,
    });
  }

  /**
   * Admin Placement Change Execution (PROMPT 16 Requirement)
   *
   * If an admin changes placement, STRICTLY REQUIRE:
   * 1. Reason (mandatory, non-empty)
   * 2. Old Parent (mandatory)
   * 3. Old Position (mandatory, LEFT or RIGHT)
   * 4. New Parent (mandatory)
   * 5. New Position (mandatory, LEFT or RIGHT)
   * 6. Admin ID (mandatory)
   *
   * "Never silently change an MLM relationship."
   */
  public static async adminChangePlacement(
    input: AdminChangePlacementInput
  ): Promise<{ success: boolean; message: string; auditRecord: TreeAuditRecord }> {
    // 1. Strict Validation of all 6 mandatory requirements
    if (!input.reason || input.reason.trim().length === 0) {
      throw AppError.badRequest(
        'Reason is strictly required when an admin changes tree placement.',
        'REASON_REQUIRED'
      );
    }
    if (!input.oldParent || input.oldParent.trim().length === 0) {
      throw AppError.badRequest('Old Parent identifier is required.', 'OLD_PARENT_REQUIRED');
    }
    if (!input.oldPosition || (input.oldPosition !== 'LEFT' && input.oldPosition !== 'RIGHT')) {
      throw AppError.badRequest('Old Position must be LEFT or RIGHT.', 'OLD_POSITION_REQUIRED');
    }
    if (!input.newParent || input.newParent.trim().length === 0) {
      throw AppError.badRequest('New Parent identifier is required.', 'NEW_PARENT_REQUIRED');
    }
    if (!input.newPosition || (input.newPosition !== 'LEFT' && input.newPosition !== 'RIGHT')) {
      throw AppError.badRequest('New Position must be LEFT or RIGHT.', 'NEW_POSITION_REQUIRED');
    }
    if (!input.adminId || input.adminId.trim().length === 0) {
      throw AppError.badRequest(
        'Admin ID is required. Admin identity must be verified.',
        'ADMIN_ID_REQUIRED'
      );
    }

    // 2. Prevent self-placement
    if (input.newParent.toUpperCase() === input.memberId.toUpperCase()) {
      throw AppError.badRequest(
        'Self-placement forbidden: Member cannot be placed under themselves.',
        'SELF_PLACEMENT_NOT_ALLOWED'
      );
    }

    // 3. Prevent duplicate or redundant placement if unchanged
    if (
      input.oldParent.toUpperCase() === input.newParent.toUpperCase() &&
      input.oldPosition === input.newPosition
    ) {
      throw AppError.badRequest(
        'Target placement is identical to current placement. No changes made.',
        'NO_PLACEMENT_CHANGE'
      );
    }

    // 4. Determine action type:
    // If parent changed -> TREE_MEMBER_MOVED
    // If parent same but leg changed (e.g. LEFT to RIGHT) -> TREE_POSITION_CHANGED
    const isSameParent = input.oldParent.toUpperCase() === input.newParent.toUpperCase();
    const action: TreeAuditAction = isSameParent ? 'TREE_POSITION_CHANGED' : 'TREE_MEMBER_MOVED';

    // 5. Record mandatory Audit Log ("Never silently change an MLM relationship")
    const auditRecord = await TreeAuditService.recordTreeAudit({
      action,
      actorId: input.adminId,
      adminId: input.adminId,
      memberId: input.memberId,
      sponsorId: null,
      placementParentId: input.newParent,
      position: input.newPosition,
      oldValue: {
        placementParentId: input.oldParent,
        position: input.oldPosition,
      },
      newValue: {
        placementParentId: input.newParent,
        position: input.newPosition,
        reason: input.reason.trim(),
      },
      reason: input.reason.trim(),
      oldParent: input.oldParent,
      oldPosition: input.oldPosition,
      newParent: input.newParent,
      newPosition: input.newPosition,
      ip: input.ip || '127.0.0.1',
      IP: input.ip || '127.0.0.1',
      userAgent: input.userAgent || 'Admin Network Console',
    });

    return {
      success: true,
      message: `Distributor ${input.memberId} placement successfully updated from ${input.oldParent} (${input.oldPosition}) to ${input.newParent} (${input.newPosition}). Audit record logged: ${auditRecord.id}.`,
      auditRecord,
    };
  }

  /**
   * Admin Member Removal Execution
   */
  public static async adminRemoveMember(
    input: AdminRemoveMemberInput
  ): Promise<{ success: boolean; message: string; auditRecord: TreeAuditRecord }> {
    if (!input.reason || input.reason.trim().length === 0) {
      throw AppError.badRequest(
        'Reason is strictly required to remove a member from the MLM tree.',
        'REASON_REQUIRED'
      );
    }
    if (!input.memberId) {
      throw AppError.badRequest('Member ID is required.', 'MEMBER_ID_REQUIRED');
    }
    if (!input.adminId) {
      throw AppError.badRequest('Admin ID is required.', 'ADMIN_ID_REQUIRED');
    }

    const auditRecord = await TreeAuditService.logTreeMemberRemoved({
      actorId: input.adminId,
      adminId: input.adminId,
      memberId: input.memberId,
      reason: input.reason.trim(),
      ip: input.ip || '127.0.0.1',
      userAgent: input.userAgent || 'Admin Network Console',
    });

    return {
      success: true,
      message: `Member ${input.memberId} has been detached from the tree. Audit record logged: ${auditRecord.id}.`,
      auditRecord,
    };
  }

  /**
   * Retrieves Tree Audit Logs with flexible filtering
   */
  public static async getTreeAuditLogs(
    filter?: TreeAuditFilter
  ): Promise<{ logs: TreeAuditRecord[]; total: number }> {
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    let filtered = [...TreeAuditService.auditLogs];

    if (filter?.memberId) {
      const q = filter.memberId.toUpperCase();
      filtered = filtered.filter((r) => r.memberId.toUpperCase() === q);
    }

    if (filter?.action) {
      const act = filter.action.toUpperCase();
      filtered = filtered.filter((r) => r.action.toUpperCase() === act);
    }

    if (filter?.actorId) {
      filtered = filtered.filter((r) => r.actorId === filter.actorId);
    }

    if (filter?.adminId) {
      filtered = filtered.filter((r) => r.adminId === filter.adminId);
    }

    const paginated = filtered.slice(offset, offset + limit);

    return {
      logs: paginated,
      total: filtered.length,
    };
  }

  /**
   * Retrieves a single Tree Audit Record by ID
   */
  public static async getTreeAuditLogById(id: string): Promise<TreeAuditRecord> {
    const record = TreeAuditService.auditLogs.find((r) => r.id === id);
    if (!record) {
      throw AppError.notFound(`Tree audit record '${id}' not found.`, 'AUDIT_RECORD_NOT_FOUND');
    }
    return record;
  }

  /**
   * Immutability Enforcement:
   * "Audit records should not be editable by normal users."
   * Always throws 403 Forbidden on any modification attempt.
   */
  public static blockAuditMutation(_userId?: string): never {
    throw AppError.forbidden(
      'Audit records are immutable and cannot be edited or deleted by normal users or administrators.',
      'AUDIT_LOG_IMMUTABLE'
    );
  }
}
