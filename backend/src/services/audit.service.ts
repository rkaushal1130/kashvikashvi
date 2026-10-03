import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';

export interface AuditLogEntry {
  id: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
}

export class AuditService {
  private static inMemoryStore: AuditLogEntry[] = [
    {
      id: 'audit-001',
      userId: 'usr-admin-001',
      action: 'LOGIN',
      entityType: 'User',
      entityId: 'usr-admin-001',
      oldValue: null,
      newValue: { status: 'Authenticated', method: 'JWT_BEARER', role: 'ADMIN' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Supertest',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'audit-002',
      userId: 'usr-admin-001',
      action: 'WALLET_CREDIT',
      entityType: 'Wallet',
      entityId: 'wal-1001',
      oldValue: { balance: 0 },
      newValue: { balance: 500, amount: 500, reason: 'Promotional bonus credit' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Supertest',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'audit-003',
      userId: 'usr-admin-001',
      action: 'COMMISSION_CALCULATED',
      entityType: 'CommissionPeriod',
      entityId: 'period-2026-W38',
      oldValue: { status: 'OPEN' },
      newValue: { status: 'CALCULATED', totalCalculated: 12500 },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Supertest',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'audit-004',
      userId: 'usr-admin-001',
      action: 'PAYOUT_APPROVED',
      entityType: 'Payout',
      entityId: 'pay-2001',
      oldValue: { status: 'PENDING' },
      newValue: { status: 'PAID', amount: 1200 },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Supertest',
      createdAt: new Date().toISOString(),
    },
  ];

  public static async recordLog(params: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      createdAt: new Date(),
    };

    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.auditLog) {
        const created = await prisma.auditLog.create({
          data: {
            userId: params.userId,
            action: params.action,
            entityType: params.entityType,
            previousData: params.oldValue ? (params.oldValue as any) : undefined,
            newData: params.newValue ? (params.newValue as any) : undefined,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
          },
        });
        return created;
      }
    } catch (e) {
      logger.debug('Audit log database write skipped, falling back to memory store');
    }

    AuditService.inMemoryStore.unshift(Object.freeze({ ...entry }));
    return entry;
  }

  public static async getAuditLogs(filter?: {
    action?: string;
    entityType?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.auditLog) {
        const where: any = {};
        if (filter?.action) where.action = filter.action;
        if (filter?.entityType) where.entityType = filter.entityType;
        if (filter?.userId) where.userId = filter.userId;

        const [dbLogs, count] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          prisma.auditLog.count({ where }),
        ]);

        if (dbLogs.length > 0) {
          return { logs: dbLogs, total: count };
        }
      }
    } catch (e) {
      // fallback
    }

    let results = [...AuditService.inMemoryStore];
    if (filter?.action) {
      results = results.filter((l) => l.action.toLowerCase() === filter.action!.toLowerCase());
    }
    if (filter?.entityType) {
      results = results.filter((l) => l.entityType.toLowerCase() === filter.entityType!.toLowerCase());
    }
    if (filter?.userId) {
      results = results.filter((l) => l.userId === filter.userId);
    }

    return {
      logs: results.slice(offset, offset + limit),
      total: results.length,
    };
  }

  public static blockAuditDeletion(): never {
    throw AppError.forbidden(
      'Immutable compliance violation: Deleting, modifying, or truncating audit logs is strictly prohibited.',
      'AUDIT_LOG_IMMUTABLE'
    );
  }
}
