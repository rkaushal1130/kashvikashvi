import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/appError';
import { LevelHistoryEntry } from './level.types';

export class LevelHistoryService {
  /**
   * Retrieves paginated level advancement history for a distributor.
   */
  public static async getMemberHistory(
    distributorId: string,
    query: { page?: number; limit?: number } = {},
    tx?: Prisma.TransactionClient
  ): Promise<{
    history: LevelHistoryEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const db = tx || prisma;
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const distributor = await db.distributorProfile.findUnique({
      where: { id: distributorId },
      select: { id: true, distributorCode: true },
    });

    if (!distributor) {
      throw AppError.notFound(`Distributor ${distributorId} not found`);
    }

    const [entries, total] = await Promise.all([
      db.distributorRankHistory.findMany({
        where: { distributorId },
        include: { rank: true },
        orderBy: { achievedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.distributorRankHistory.count({
        where: { distributorId },
      }),
    ]);

    const history: LevelHistoryEntry[] = entries.map((entry) => ({
      id: entry.id,
      distributorId: entry.distributorId,
      distributorCode: distributor.distributorCode,
      level: entry.rank?.level ?? 0,
      levelCode: entry.rank?.rankCode ?? 'RANK_STARTER',
      levelName: entry.rank?.name ?? 'Starter',
      qualifiedBB: Number(entry.personalBV),
      qualifiedMatching: Number(entry.groupBV),
      promotedBy: 'SYSTEM_AUTO',
      achievedAt: entry.achievedAt,
    }));

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves global network-wide level promotion events for administrator audit.
   */
  public static async getNetworkHistory(
    query: { page?: number; limit?: number; level?: number } = {},
    tx?: Prisma.TransactionClient
  ): Promise<{
    history: LevelHistoryEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const db = tx || prisma;
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 50)));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.DistributorRankHistoryWhereInput = {
      ...(query.level !== undefined ? { rank: { level: query.level } } : {}),
    };

    const [entries, total] = await Promise.all([
      db.distributorRankHistory.findMany({
        where: whereClause,
        include: {
          rank: true,
          distributor: {
            select: { distributorCode: true, firstName: true, lastName: true },
          },
        },
        orderBy: { achievedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.distributorRankHistory.count({ where: whereClause }),
    ]);

    const history: LevelHistoryEntry[] = entries.map((entry) => ({
      id: entry.id,
      distributorId: entry.distributorId,
      distributorCode: entry.distributor?.distributorCode,
      level: entry.rank?.level ?? 0,
      levelCode: entry.rank?.rankCode ?? 'RANK_STARTER',
      levelName: entry.rank?.name ?? 'Starter',
      qualifiedBB: Number(entry.personalBV),
      qualifiedMatching: Number(entry.groupBV),
      promotedBy: 'SYSTEM_AUTO',
      achievedAt: entry.achievedAt,
    }));

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
