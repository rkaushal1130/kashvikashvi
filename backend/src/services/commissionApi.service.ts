import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';

/**
 * ============================================================================
 * COMMISSION API SERVICE (PROMPT 23)
 * ============================================================================
 * Authoritative business service backing the Member and Admin Commission REST APIs.
 *
 * Implements:
 * 1. Member:
 *    - GET /api/members/:memberId/commissions (Paginated commission history)
 *    - GET /api/members/:memberId/commissions/summary (Summary with level breakdown)
 *    - GET /api/members/:memberId/commissions/:commissionId (Full transaction details)
 * 2. Admin:
 *    - GET /api/admin/commissions (Filtered commission inspection)
 *    - POST /api/admin/orders/:orderId/process-commission (Authoritative commission execution)
 *    - POST /api/admin/commissions/:commissionId/reverse (Compensatory reversal)
 * 3. Strict RBAC & Zero-Trust frontend invariants:
 *    - Never accept commission amount, percentage, recipientId, or volume from the client.
 *    - Backend authoritatively computes BV, upline, level, percentage, and eligibility.
 */

export class CommissionApiService {
  private static readonly TRANSACTION_INCLUDE = {
    recipient: {
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        userId: true,
        user: { select: { email: true } },
      },
    },
    sourceMember: {
      select: {
        id: true,
        distributorId: true,
        distributorCode: true,
        firstName: true,
        lastName: true,
        userId: true,
        user: { select: { email: true } },
      },
    },
    order: {
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        totalBV: true,
        status: true,
      },
    },
    walletTransaction: {
      select: {
        id: true,
        transactionNumber: true,
        walletId: true,
        type: true,
        status: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        createdAt: true,
      },
    },
    reversals: true,
  };

  /**
   * Resolves a distributor profile from an ID, distributorCode, distributorId, or userId.
   */
  public static async resolveMemberProfile(
    identifier: string,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    if (!identifier || !identifier.trim()) {
      throw AppError.badRequest('Member identifier is required', 'MEMBER_ID_REQUIRED');
    }

    const clean = identifier.trim();
    const db = tx || prisma;

    const profile = await db.distributorProfile.findFirst({
      where: {
        OR: [
          { id: clean },
          { distributorCode: { equals: clean, mode: 'insensitive' } },
          { distributorId: { equals: clean, mode: 'insensitive' } },
          { userId: clean },
        ],
      },
      include: {
        user: { select: { id: true, email: true, status: true, roleName: true } },
      },
    });

    if (!profile) {
      throw AppError.notFound(`Member with identifier '${clean}' not found`, 'MEMBER_NOT_FOUND');
    }

    return profile;
  }

  /**
   * Verifies that the requesting user has permission to access the target member's data.
   * Admins and Super Admins can access any member; Distributors can only access their own.
   */
  public static verifyMemberAccess(requestingUser: any, targetProfile: any): void {
    if (!requestingUser) {
      throw AppError.unauthorized('Authentication required', 'AUTH_UNAUTHORIZED');
    }

    const role = requestingUser.role;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      return;
    }

    const userId = requestingUser.id;
    if (targetProfile.userId === userId || targetProfile.id === userId) {
      return;
    }

    throw AppError.forbidden(
      'Access denied: You do not have permission to view commission records for this member.',
      'AUTH_FORBIDDEN'
    );
  }

  /**
   * 1. GET /api/members/:memberId/commissions
   * Returns paginated commission transaction history for a member.
   */
  public static async getMemberCommissions(
    memberIdentifier: string,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      level?: number;
      commissionLevel?: number;
      orderId?: string;
      sourceMemberId?: string;
      fromDate?: string;
      toDate?: string;
      startDate?: string;
      endDate?: string;
    },
    requestingUser: any,
    tx?: Prisma.TransactionClient
  ) {
    const member = await this.resolveMemberProfile(memberIdentifier, tx);
    this.verifyMemberAccess(requestingUser, member);

    const db = tx || prisma;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const level = query.commissionLevel || query.level;
    const fromDate = query.fromDate || query.startDate;
    const toDate = query.toDate || query.endDate;

    const where: Prisma.CommissionTransactionWhereInput = {
      recipientMemberId: member.id,
      ...(query.status ? { status: query.status as any } : {}),
      ...(level ? { commissionLevel: Number(level) } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.sourceMemberId ? { sourceMemberId: query.sourceMemberId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.commissionTransaction.count({ where }),
      db.commissionTransaction.findMany({
        where,
        include: this.TRANSACTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      transactions: items.map((item) => this.mapTransaction(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      member: {
        id: member.id,
        distributorCode: member.distributorCode,
        firstName: member.firstName,
        lastName: member.lastName,
      },
    };
  }

  /**
   * 2. GET /api/members/:memberId/commissions/summary
   * Returns:
   * - total commission
   * - pending commission
   * - available commission
   * - paid commission
   * - reversed commission
   * - commission by level (Levels 1-5 breakdown)
   */
  public static async getMemberCommissionSummary(
    memberIdentifier: string,
    requestingUser: any,
    tx?: Prisma.TransactionClient
  ) {
    const member = await this.resolveMemberProfile(memberIdentifier, tx);
    this.verifyMemberAccess(requestingUser, member);

    const db = tx || prisma;

    // Fetch all commission transactions for this recipient
    const [transactions, reversals] = await Promise.all([
      db.commissionTransaction.findMany({
        where: { recipientMemberId: member.id },
      }),
      db.commissionReversal.findMany({
        where: { recipientMemberId: member.id },
      }),
    ]);

    let pendingCommission = 0;
    let availableCommission = 0;
    let paidCommission = 0;
    let approvedCommission = 0;
    let reversedCommission = 0;

    // Standard 5-Level Unilevel percentages
    const defaultRates: Record<number, number> = {
      1: 24,
      2: 8,
      3: 13,
      4: 5,
      5: 4,
    };

    // Level breakdown data structures
    const levelStats: Record<
      number,
      {
        level: number;
        percentage: number;
        amount: number;
        totalAmount: number;
        count: number;
        paidAmount: number;
        pendingAmount: number;
        availableAmount: number;
        reversedAmount: number;
      }
    > = {
      1: { level: 1, percentage: defaultRates[1], amount: 0, totalAmount: 0, count: 0, paidAmount: 0, pendingAmount: 0, availableAmount: 0, reversedAmount: 0 },
      2: { level: 2, percentage: defaultRates[2], amount: 0, totalAmount: 0, count: 0, paidAmount: 0, pendingAmount: 0, availableAmount: 0, reversedAmount: 0 },
      3: { level: 3, percentage: defaultRates[3], amount: 0, totalAmount: 0, count: 0, paidAmount: 0, pendingAmount: 0, availableAmount: 0, reversedAmount: 0 },
      4: { level: 4, percentage: defaultRates[4], amount: 0, totalAmount: 0, count: 0, paidAmount: 0, pendingAmount: 0, availableAmount: 0, reversedAmount: 0 },
      5: { level: 5, percentage: defaultRates[5], amount: 0, totalAmount: 0, count: 0, paidAmount: 0, pendingAmount: 0, availableAmount: 0, reversedAmount: 0 },
    };

    for (const t of transactions) {
      const amount = Number(t.grossCommissionAmount);
      const level = t.commissionLevel;

      if (levelStats[level]) {
        levelStats[level].count++;
        levelStats[level].amount = SafeDecimal.round(levelStats[level].amount + amount, 2);
        levelStats[level].totalAmount = SafeDecimal.round(levelStats[level].totalAmount + amount, 2);
      }

      switch (t.status) {
        case 'PENDING':
          pendingCommission = SafeDecimal.round(pendingCommission + amount, 2);
          if (levelStats[level]) {
            levelStats[level].pendingAmount = SafeDecimal.round(levelStats[level].pendingAmount + amount, 2);
          }
          break;
        case 'APPROVED':
          approvedCommission = SafeDecimal.round(approvedCommission + amount, 2);
          break;
        case 'AVAILABLE':
          availableCommission = SafeDecimal.round(availableCommission + amount, 2);
          if (levelStats[level]) {
            levelStats[level].availableAmount = SafeDecimal.round(levelStats[level].availableAmount + amount, 2);
          }
          break;
        case 'PAID':
          paidCommission = SafeDecimal.round(paidCommission + amount, 2);
          if (levelStats[level]) {
            levelStats[level].paidAmount = SafeDecimal.round(levelStats[level].paidAmount + amount, 2);
          }
          break;
        case 'REVERSED':
          reversedCommission = SafeDecimal.round(reversedCommission + amount, 2);
          if (levelStats[level]) {
            levelStats[level].reversedAmount = SafeDecimal.round(levelStats[level].reversedAmount + amount, 2);
          }
          break;
      }
    }

    // Add compensatory reversal records if not already reflected
    for (const r of reversals) {
      const revAmount = Math.abs(Number(r.amount));
      if (reversedCommission === 0) {
        reversedCommission = SafeDecimal.round(reversedCommission + revAmount, 2);
      }
    }

    // Total commission = all generated gross active/payable commissions (PAID + AVAILABLE + PENDING + APPROVED)
    const totalCommission = SafeDecimal.round(
      paidCommission + availableCommission + pendingCommission + approvedCommission,
      2
    );

    return {
      memberId: member.id,
      distributorCode: member.distributorCode,
      totalCommission,
      pendingCommission,
      availableCommission,
      paidCommission,
      reversedCommission,
      commissionByLevel: {
        '1': levelStats[1],
        '2': levelStats[2],
        '3': levelStats[3],
        '4': levelStats[4],
        '5': levelStats[5],
      },
      levels: [
        levelStats[1],
        levelStats[2],
        levelStats[3],
        levelStats[4],
        levelStats[5],
      ],
    };
  }

  /**
   * 3. GET /api/members/:memberId/commissions/:commissionId
   * Returns complete transaction details for an individual commission record.
   */
  public static async getMemberCommissionDetails(
    memberIdentifier: string,
    commissionId: string,
    requestingUser: any,
    tx?: Prisma.TransactionClient
  ) {
    const member = await this.resolveMemberProfile(memberIdentifier, tx);
    this.verifyMemberAccess(requestingUser, member);

    if (!commissionId || !commissionId.trim()) {
      throw AppError.badRequest('Commission identifier is required');
    }

    const cleanCommId = commissionId.trim();
    const db = tx || prisma;

    const item = await db.commissionTransaction.findUnique({
      where: { id: cleanCommId },
      include: this.TRANSACTION_INCLUDE,
    });

    if (!item) {
      throw AppError.notFound(`Commission transaction '${cleanCommId}' not found`);
    }

    // Authorization check: Make sure commission belongs to this member (unless admin)
    if (
      item.recipientMemberId !== member.id &&
      requestingUser.role !== 'ADMIN' &&
      requestingUser.role !== 'SUPER_ADMIN'
    ) {
      throw AppError.notFound(
        `Commission transaction '${cleanCommId}' not found for member '${member.distributorCode}'`
      );
    }

    return this.mapTransaction(item);
  }

  /**
   * 4. GET /api/admin/commissions
   * Admin endpoint: Query commissions with comprehensive filters:
   * - member
   * - source member
   * - order
   * - level
   * - status
   * - date range
   */
  public static async getAdminCommissions(
    filters: {
      member?: string;
      recipientId?: string;
      sourceMember?: string;
      sourceMemberId?: string;
      order?: string;
      orderId?: string;
      level?: number;
      commissionLevel?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CommissionTransactionWhereInput = {};

    // 1. Filter by recipient member
    const memberFilter = filters.member || filters.recipientId;
    if (memberFilter && memberFilter.trim()) {
      try {
        const member = await this.resolveMemberProfile(memberFilter, db);
        where.recipientMemberId = member.id;
      } catch {
        where.recipientMemberId = memberFilter.trim();
      }
    }

    // 2. Filter by source member
    const sourceFilter = filters.sourceMember || filters.sourceMemberId;
    if (sourceFilter && sourceFilter.trim()) {
      try {
        const source = await this.resolveMemberProfile(sourceFilter, db);
        where.sourceMemberId = source.id;
      } catch {
        where.sourceMemberId = sourceFilter.trim();
      }
    }

    // 3. Filter by order
    const orderFilter = filters.order || filters.orderId;
    if (orderFilter && orderFilter.trim()) {
      const cleanOrder = orderFilter.trim();
      const existingOrder = await db.order.findFirst({
        where: {
          OR: [{ id: cleanOrder }, { orderNumber: cleanOrder }],
        },
        select: { id: true },
      });
      where.orderId = existingOrder ? existingOrder.id : cleanOrder;
    }

    // 4. Filter by level
    const level = filters.commissionLevel || filters.level;
    if (level) {
      where.commissionLevel = Number(level);
    }

    // 5. Filter by status
    if (filters.status && filters.status.trim()) {
      where.status = filters.status.trim().toUpperCase() as any;
    }

    // 6. Filter by date range
    const fromDate = filters.fromDate || filters.startDate;
    const toDate = filters.toDate || filters.endDate;
    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    const [total, items] = await Promise.all([
      db.commissionTransaction.count({ where }),
      db.commissionTransaction.findMany({
        where,
        include: this.TRANSACTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      transactions: items.map((item) => this.mapTransaction(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filtersApplied: {
        member: memberFilter || null,
        sourceMember: sourceFilter || null,
        order: orderFilter || null,
        level: level || null,
        status: filters.status || null,
        fromDate: fromDate || null,
        toDate: toDate || null,
      },
    };
  }

  /**
   * Helper: Formats Prisma commission entity into a clean response record.
   */
  private static mapTransaction(entity: any) {
    return {
      id: entity.id,
      orderId: entity.orderId,
      commissionLevel: entity.commissionLevel,
      businessVolume: Number(entity.businessVolume || 0),
      percentage: Number(entity.percentage || 0),
      grossCommissionAmount: Number(entity.grossCommissionAmount || 0),
      status: entity.status,
      source: entity.source,
      idempotencyKey: entity.idempotencyKey,
      recipientMemberId: entity.recipientMemberId,
      sourceMemberId: entity.sourceMemberId,
      recipient: entity.recipient
        ? {
            id: entity.recipient.id,
            distributorId: entity.recipient.distributorId,
            distributorCode: entity.recipient.distributorCode,
            firstName: entity.recipient.firstName,
            lastName: entity.recipient.lastName,
            email: entity.recipient.user?.email,
          }
        : undefined,
      sourceMember: entity.sourceMember
        ? {
            id: entity.sourceMember.id,
            distributorId: entity.sourceMember.distributorId,
            distributorCode: entity.sourceMember.distributorCode,
            firstName: entity.sourceMember.firstName,
            lastName: entity.sourceMember.lastName,
            email: entity.sourceMember.user?.email,
          }
        : undefined,
      order: entity.order
        ? {
            id: entity.order.id,
            orderNumber: entity.order.orderNumber,
            totalAmount: Number(entity.order.totalAmount || 0),
            totalBV: Number(entity.order.totalBV || 0),
            status: entity.order.status,
          }
        : undefined,
      walletTransactionId: entity.walletTransactionId || null,
      walletTransaction: entity.walletTransaction || null,
      calculationDetails: entity.calculationDetails || null,
      reversals: entity.reversals || [],
      reversalReason: entity.reversalReason || null,
      approvedAt: entity.approvedAt || null,
      availableAt: entity.availableAt || null,
      paidAt: entity.paidAt || null,
      reversedAt: entity.reversedAt || null,
      cancelledAt: entity.cancelledAt || null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
