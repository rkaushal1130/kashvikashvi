import { Prisma, BVSourceType, PlacementPosition, BVTransactionType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import {
  CreditBVInput,
  DebitBVInput,
  ReverseBVTransactionInput,
  BVLedgerQueryInput,
} from '../validators/bv.validators';

export interface BVLegOptions {
  businessCenterId?: string;
  periodId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface FormattedBVEntry {
  id: string;
  distributorId: string;
  businessCenterId: string | null;
  sourceType: BVSourceType;
  sourceId: string;
  bv: number;
  balanceAfter: number;
  position: PlacementPosition | null;
  sourceDistributorId: string | null;
  commissionPeriodId: string | null;
  orderId: string | null;
  type: BVTransactionType;
  description: string | null;
  createdAt: Date;
}

export class BVService {
  /**
   * Formats a raw Prisma BVLedger record into a numeric JSON representation.
   */
  public static formatBVEntry(entry: any): FormattedBVEntry {
    return {
      id: entry.id,
      distributorId: entry.distributorId,
      businessCenterId: entry.businessCenterId || null,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      bv: Number(entry.bv),
      balanceAfter: Number(entry.balanceAfter),
      position: entry.position || null,
      sourceDistributorId: entry.sourceDistributorId || null,
      commissionPeriodId: entry.commissionPeriodId || null,
      orderId: entry.orderId || null,
      type: entry.type,
      description: entry.description || null,
      createdAt: entry.createdAt,
    };
  }

  /**
   * Credits BV to a distributor via an append-only immutable BVLedger entry.
   * Every transaction MUST have a valid reference (sourceId).
   * Calculates the cumulative balanceAfter based on the prior record.
   */
  public static async creditBV(
    input: CreditBVInput & { orderId?: string },
    tx?: Prisma.TransactionClient
  ): Promise<FormattedBVEntry> {
    const {
      distributorId,
      businessCenterId,
      sourceType,
      sourceId,
      bv,
      position,
      sourceDistributorId,
      commissionPeriodId,
      orderId,
      description,
    } = input;

    // Requirement: Every BV transaction must have a reference
    if (!sourceId || !sourceId.trim()) {
      throw AppError.badRequest('Every BV transaction must have a valid reference (sourceId)');
    }

    const creditAmount = Number(bv);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      throw AppError.badRequest('BV credit amount must be a positive number greater than zero');
    }

    const runner = async (client: Prisma.TransactionClient) => {
      // Validate distributor exists
      const distributor = await client.distributorProfile.findUnique({
        where: { id: distributorId },
        select: { id: true, distributorCode: true },
      });
      if (!distributor) {
        throw AppError.notFound(`Distributor ${distributorId} not found`);
      }

      // If businessCenterId is specified, verify existence
      if (businessCenterId) {
        const bc = await client.businessCenter.findUnique({
          where: { id: businessCenterId },
          select: { id: true, distributorId: true },
        });
        if (!bc) {
          throw AppError.notFound(`Business center ${businessCenterId} not found`);
        }
      }

      // Fetch the latest entry to compute immutable balanceAfter
      const lastEntry = await client.bVLedger.findFirst({
        where: {
          distributorId,
          ...(businessCenterId ? { businessCenterId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      });

      const previousBalance = lastEntry ? new Prisma.Decimal(lastEntry.balanceAfter) : new Prisma.Decimal(0);
      const creditDecimal = new Prisma.Decimal(creditAmount);
      const balanceAfter = previousBalance.add(creditDecimal);

      // Determine appropriate BVTransactionType for backwards compatibility
      let txType: BVTransactionType = 'ORDER_ACCRUAL';
      if (sourceType === 'ADJUSTMENT' || sourceType === 'REVERSAL') {
        txType = 'MANUAL_ADJUSTMENT';
      }

      const newEntry = await client.bVLedger.create({
        data: {
          distributorId,
          businessCenterId: businessCenterId || null,
          sourceType,
          sourceId: sourceId.trim(),
          bv: creditDecimal,
          amount: creditDecimal,
          balanceAfter,
          position: position || null,
          sourceDistributorId: sourceDistributorId || null,
          commissionPeriodId: commissionPeriodId || null,
          orderId: orderId || (sourceType === 'ORDER' ? sourceId.trim() : null),
          type: txType,
          description: description || `BV Credit of ${creditAmount} from ${sourceType} (Ref: ${sourceId.trim()})`,
        },
      });

      logger.info(
        {
          distributorId,
          businessCenterId,
          bv: creditAmount,
          balanceAfter: Number(balanceAfter),
          sourceType,
          sourceId,
        },
        'BV credited successfully'
      );

      return this.formatBVEntry(newEntry);
    };

    return tx ? runner(tx) : prisma.$transaction(runner);
  }

  /**
   * Debits BV from a distributor via an append-only immutable BVLedger entry.
   * Every transaction MUST have a valid reference (sourceId).
   * Stores the negative BV delta and updates balanceAfter accordingly.
   */
  public static async debitBV(
    input: DebitBVInput,
    tx?: Prisma.TransactionClient
  ): Promise<FormattedBVEntry> {
    const {
      distributorId,
      businessCenterId,
      sourceType = 'ADJUSTMENT',
      sourceId,
      bv,
      position,
      commissionPeriodId,
      description,
    } = input;

    // Requirement: Every BV transaction must have a reference
    if (!sourceId || !sourceId.trim()) {
      throw AppError.badRequest('Every BV transaction must have a valid reference (sourceId)');
    }

    const debitAmount = Number(bv);
    if (isNaN(debitAmount) || debitAmount <= 0) {
      throw AppError.badRequest('BV debit amount must be a positive number greater than zero');
    }

    const runner = async (client: Prisma.TransactionClient) => {
      // Validate distributor exists
      const distributor = await client.distributorProfile.findUnique({
        where: { id: distributorId },
        select: { id: true, distributorCode: true },
      });
      if (!distributor) {
        throw AppError.notFound(`Distributor ${distributorId} not found`);
      }

      // If businessCenterId is specified, verify existence
      if (businessCenterId) {
        const bc = await client.businessCenter.findUnique({
          where: { id: businessCenterId },
          select: { id: true },
        });
        if (!bc) {
          throw AppError.notFound(`Business center ${businessCenterId} not found`);
        }
      }

      // Fetch the latest entry to compute immutable balanceAfter
      const lastEntry = await client.bVLedger.findFirst({
        where: {
          distributorId,
          ...(businessCenterId ? { businessCenterId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      });

      const previousBalance = lastEntry ? new Prisma.Decimal(lastEntry.balanceAfter) : new Prisma.Decimal(0);
      const debitDecimal = new Prisma.Decimal(debitAmount);
      const negativeBv = debitDecimal.negated();
      const balanceAfter = previousBalance.sub(debitDecimal);

      let txType: BVTransactionType = 'COMMISSION_DEDUCTION';
      if (sourceType === 'ADJUSTMENT' || sourceType === 'REVERSAL') {
        txType = 'MANUAL_ADJUSTMENT';
      }

      const newEntry = await client.bVLedger.create({
        data: {
          distributorId,
          businessCenterId: businessCenterId || null,
          sourceType,
          sourceId: sourceId.trim(),
          bv: negativeBv,
          amount: negativeBv,
          balanceAfter,
          position: position || null,
          commissionPeriodId: commissionPeriodId || null,
          type: txType,
          description: description || `BV Debit of ${debitAmount} from ${sourceType} (Ref: ${sourceId.trim()})`,
        },
      });

      logger.info(
        {
          distributorId,
          businessCenterId,
          bv: -debitAmount,
          balanceAfter: Number(balanceAfter),
          sourceType,
          sourceId,
        },
        'BV debited successfully'
      );

      return this.formatBVEntry(newEntry);
    };

    return tx ? runner(tx) : prisma.$transaction(runner);
  }

  /**
   * Retrieves the current BV balance from the immutable ledger.
   * Calculates running totals and checks the latest recorded balanceAfter.
   */
  public static async getBalance(
    distributorId: string,
    businessCenterId?: string,
    client?: Prisma.TransactionClient
  ): Promise<{
    distributorId: string;
    businessCenterId: string | null;
    balance: number;
    currentBalance: number;
    totalCredits: number;
    totalDebits: number;
    entriesCount: number;
    lastTransactionAt: Date | null;
  }> {
    const db = client || prisma;

    const whereClause: Prisma.BVLedgerWhereInput = {
      distributorId,
      ...(businessCenterId ? { businessCenterId } : {}),
    };

    const [lastEntry, creditsAgg, debitsAgg, totalCount] = await Promise.all([
      db.bVLedger.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true, createdAt: true },
      }),
      db.bVLedger.aggregate({
        where: { ...whereClause, bv: { gt: 0 } },
        _sum: { bv: true },
      }),
      db.bVLedger.aggregate({
        where: { ...whereClause, bv: { lt: 0 } },
        _sum: { bv: true },
      }),
      db.bVLedger.count({ where: whereClause }),
    ]);

    const balance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
    const totalCredits = creditsAgg._sum.bv ? Number(creditsAgg._sum.bv) : 0;
    const totalDebits = debitsAgg._sum.bv ? Math.abs(Number(debitsAgg._sum.bv)) : 0;

    return {
      distributorId,
      businessCenterId: businessCenterId || null,
      balance,
      currentBalance: balance,
      totalCredits,
      totalDebits,
      entriesCount: totalCount,
      lastTransactionAt: lastEntry?.createdAt || null,
    };
  }

  /**
   * Computes BV accumulated within a specific commission period.
   * Breaks down personal volume vs downline group volume, and left/right legs.
   */
  public static async getPeriodBV(
    distributorId: string,
    periodIdOrCode: string,
    businessCenterId?: string,
    client?: Prisma.TransactionClient
  ): Promise<{
    distributorId: string;
    businessCenterId: string | null;
    periodId: string;
    periodCode: string;
    periodStatus: string;
    startDate: Date | null;
    endDate: Date | null;
    totalBV: number;
    personalBV: number;
    groupBV: number;
    leftBV: number;
    rightBV: number;
    entriesCount: number;
  }> {
    const db = client || prisma;

    // Resolve CommissionPeriod if registered
    const period = await db.commissionPeriod.findFirst({
      where: {
        OR: [{ id: periodIdOrCode }, { periodCode: periodIdOrCode }],
      },
    });

    const whereClause: Prisma.BVLedgerWhereInput = {
      distributorId,
      ...(businessCenterId ? { businessCenterId } : {}),
      ...(period
        ? {
            OR: [
              { commissionPeriodId: period.id },
              {
                createdAt: {
                  gte: period.startDate,
                  lte: period.endDate,
                },
              },
            ],
          }
        : { commissionPeriodId: periodIdOrCode }),
    };

    const [totalAgg, leftAgg, rightAgg, personalAgg, entriesCount] = await Promise.all([
      db.bVLedger.aggregate({
        where: whereClause,
        _sum: { bv: true },
      }),
      db.bVLedger.aggregate({
        where: { ...whereClause, position: 'LEFT' },
        _sum: { bv: true },
      }),
      db.bVLedger.aggregate({
        where: { ...whereClause, position: 'RIGHT' },
        _sum: { bv: true },
      }),
      db.bVLedger.aggregate({
        where: {
          ...whereClause,
          position: null,
        },
        _sum: { bv: true },
      }),
      db.bVLedger.count({ where: whereClause }),
    ]);

    const totalBV = totalAgg._sum.bv ? Number(totalAgg._sum.bv) : 0;
    const leftBV = leftAgg._sum.bv ? Number(leftAgg._sum.bv) : 0;
    const rightBV = rightAgg._sum.bv ? Number(rightAgg._sum.bv) : 0;
    const personalBV = personalAgg._sum.bv ? Number(personalAgg._sum.bv) : 0;
    const groupBV = leftBV + rightBV;

    return {
      distributorId,
      businessCenterId: businessCenterId || null,
      periodId: period?.id || periodIdOrCode,
      periodCode: period?.periodCode || periodIdOrCode,
      periodStatus: period?.status || 'OPEN',
      startDate: period?.startDate || null,
      endDate: period?.endDate || null,
      totalBV,
      personalBV,
      groupBV,
      leftBV,
      rightBV,
      entriesCount,
    };
  }

  /**
   * Retrieves the net accumulated BV on the LEFT placement leg.
   */
  public static async getLeftBV(
    distributorId: string,
    options?: BVLegOptions,
    client?: Prisma.TransactionClient
  ): Promise<{
    position: 'LEFT';
    totalBV: number;
    entriesCount: number;
  }> {
    const res = await this.getLegBV(distributorId, 'LEFT', options, client);
    return {
      position: 'LEFT',
      totalBV: res.totalBV,
      entriesCount: res.entriesCount,
    };
  }

  /**
   * Retrieves the net accumulated BV on the RIGHT placement leg.
   */
  public static async getRightBV(
    distributorId: string,
    options?: BVLegOptions,
    client?: Prisma.TransactionClient
  ): Promise<{
    position: 'RIGHT';
    totalBV: number;
    entriesCount: number;
  }> {
    const res = await this.getLegBV(distributorId, 'RIGHT', options, client);
    return {
      position: 'RIGHT',
      totalBV: res.totalBV,
      entriesCount: res.entriesCount,
    };
  }

  /**
   * Internal helper for leg volume calculations.
   */
  private static async getLegBV(
    distributorId: string,
    position: 'LEFT' | 'RIGHT',
    options?: BVLegOptions,
    client?: Prisma.TransactionClient
  ): Promise<{
    position: 'LEFT' | 'RIGHT';
    totalBV: number;
    entriesCount: number;
  }> {
    const db = client || prisma;

    const whereClause: Prisma.BVLedgerWhereInput = {
      distributorId,
      position,
      ...(options?.businessCenterId ? { businessCenterId: options.businessCenterId } : {}),
      ...(options?.periodId ? { commissionPeriodId: options.periodId } : {}),
      ...(options?.startDate || options?.endDate
        ? {
            createdAt: {
              ...(options.startDate ? { gte: options.startDate } : {}),
              ...(options.endDate ? { lte: options.endDate } : {}),
            },
          }
        : {}),
    };

    const [agg, count] = await Promise.all([
      db.bVLedger.aggregate({
        where: whereClause,
        _sum: { bv: true },
      }),
      db.bVLedger.count({ where: whereClause }),
    ]);

    const totalBV = agg._sum.bv ? Number(agg._sum.bv) : 0;
    return {
      position,
      totalBV,
      entriesCount: count,
    };
  }

  /**
   * Reverses an existing BV transaction.
   * Immutability rule: Never modify or delete the original record.
   * Instead, creates a compensating REVERSAL ledger entry that negates the original amount.
   */
  public static async reverseTransaction(
    input: ReverseBVTransactionInput,
    tx?: Prisma.TransactionClient
  ): Promise<FormattedBVEntry> {
    const { originalTransactionId, reason, referenceId } = input;

    if (!referenceId || !referenceId.trim()) {
      throw AppError.badRequest('Reversal reference ID (referenceId) is required');
    }

    const runner = async (client: Prisma.TransactionClient) => {
      // Find the original transaction
      const original = await client.bVLedger.findUnique({
        where: { id: originalTransactionId },
      });

      if (!original) {
        throw AppError.notFound(`Original BV transaction ${originalTransactionId} not found`);
      }

      // Check if already reversed
      const existingReversal = await client.bVLedger.findFirst({
        where: {
          sourceType: 'REVERSAL',
          sourceId: originalTransactionId,
        },
      });

      if (existingReversal) {
        throw AppError.badRequest(
          `Transaction ${originalTransactionId} has already been reversed by entry ${existingReversal.id}`
        );
      }

      // Compensating delta is the exact negation of the original BV
      const originalBv = new Prisma.Decimal(original.bv);
      const compensatingDelta = originalBv.negated();

      // Calculate new balanceAfter
      const lastEntry = await client.bVLedger.findFirst({
        where: {
          distributorId: original.distributorId,
          ...(original.businessCenterId ? { businessCenterId: original.businessCenterId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      });

      const previousBalance = lastEntry ? new Prisma.Decimal(lastEntry.balanceAfter) : new Prisma.Decimal(0);
      const balanceAfter = previousBalance.add(compensatingDelta);

      // Create compensating REVERSAL record
      const reversalEntry = await client.bVLedger.create({
        data: {
          distributorId: original.distributorId,
          businessCenterId: original.businessCenterId,
          sourceType: 'REVERSAL',
          sourceId: originalTransactionId,
          bv: compensatingDelta,
          amount: compensatingDelta,
          balanceAfter,
          position: original.position,
          commissionPeriodId: original.commissionPeriodId,
          type: 'MANUAL_ADJUSTMENT',
          description: `Reversal of [${original.sourceType} ${original.id}]: ${reason.trim()} (Ref: ${referenceId.trim()})`,
        },
      });

      logger.warn(
        {
          originalTransactionId,
          reversalId: reversalEntry.id,
          reversalDelta: Number(compensatingDelta),
          newBalance: Number(balanceAfter),
          reason,
          referenceId,
        },
        'BV transaction reversed via compensating entry'
      );

      return this.formatBVEntry(reversalEntry);
    };

    return tx ? runner(tx) : prisma.$transaction(runner);
  }

  /**
   * Retrieves paginated BV ledger history for a distributor.
   */
  public static async getLedger(
    distributorId: string,
    query: BVLedgerQueryInput,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const { sourceType, position, businessCenterId, commissionPeriodId, page = 1, limit = 20 } = query;

    const skip = (page - 1) * limit;

    const whereClause: Prisma.BVLedgerWhereInput = {
      distributorId,
      ...(sourceType ? { sourceType } : {}),
      ...(position ? { position } : {}),
      ...(businessCenterId ? { businessCenterId } : {}),
      ...(commissionPeriodId ? { commissionPeriodId } : {}),
    };

    const [entries, totalCount] = await Promise.all([
      db.bVLedger.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          businessCenter: {
            select: { id: true, centerNumber: true, centerCode: true },
          },
        },
      }),
      db.bVLedger.count({ where: whereClause }),
    ]);

    return {
      entries: entries.map((e: any) => this.formatBVEntry(e)),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
}
