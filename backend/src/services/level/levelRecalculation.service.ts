import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { LevelPromotionService } from './levelPromotion.service';
import { LevelQualificationService } from './levelQualification.service';
import { RecalculationSummary } from './level.types';

export class LevelRecalculationService {
  /**
   * Recalculates level qualification for a single distributor and triggers promotion if eligible.
   */
  public static async recalculateDistributor(
    distributorId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return await LevelPromotionService.evaluateAndPromote(distributorId, db);
  }

  /**
   * Network-wide recalculation audit:
   * Scans all distributors, re-verifies independent BB and Matching volumes,
   * and automatically promotes anyone who meets the criteria.
   */
  public static async recalculateNetworkLevels(
    options: { onlyActive?: boolean } = {},
    tx?: Prisma.TransactionClient
  ): Promise<RecalculationSummary> {
    const db = tx || prisma;
    const startTime = Date.now();

    // Ensure canonical rank definitions exist
    await LevelQualificationService.ensureRanks(db);

    const whereClause: Prisma.DistributorProfileWhereInput = {
      ...(options.onlyActive ? { status: 'ACTIVE' } : {}),
    };

    const distributors = await db.distributorProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        distributorCode: true,
        currentRank: { select: { name: true, level: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const summary: RecalculationSummary = {
      totalEvaluated: distributors.length,
      totalPromoted: 0,
      promotions: [],
      errors: [],
      durationMs: 0,
    };

    for (const dist of distributors) {
      try {
        const promoResult = await LevelPromotionService.evaluateAndPromote(dist.id, db);
        if (promoResult.promoted) {
          summary.totalPromoted++;
          summary.promotions.push({
            distributorId: dist.id,
            distributorCode: dist.distributorCode,
            previousLevel: promoResult.previousLevel.name,
            newLevel: promoResult.newLevel.name,
            qualifiedBB: promoResult.snapshot.qualifiedBB,
            qualifiedMatching: promoResult.snapshot.qualifiedMatching,
          });
        }
      } catch (err: any) {
        logger.error(
          { distributorId: dist.id, error: err.message },
          'Error during distributor level recalculation'
        );
        summary.errors.push({
          distributorId: dist.id,
          error: err.message || 'Unknown evaluation failure',
        });
      }
    }

    summary.durationMs = Date.now() - startTime;

    logger.info(
      {
        totalEvaluated: summary.totalEvaluated,
        totalPromoted: summary.totalPromoted,
        errorCount: summary.errors.length,
        durationMs: summary.durationMs,
      },
      'Network-wide level recalculation completed'
    );

    return summary;
  }
}
