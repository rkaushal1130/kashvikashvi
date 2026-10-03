import { NextFunction, Request, Response } from 'express';
import { LevelService } from '../services/level.service';
import { BBService } from '../services/bb.service';
import { MatchingService } from '../services/matching.service';
import { MemberRankProgressService } from '../services/memberRankProgress.service';
import { sendSuccess } from '../utils/apiResponse';
import {
  memberIdParamSchema,
  paginationQuerySchema,
  adminRecalculateBodySchema,
} from '../validators/memberLevel.validators';

/**
 * ============================================================================
 * MEMBER LEVEL & VOLUME API CONTROLLER
 * ============================================================================
 * Exposes RESTful endpoints for member levels, progression, BB balance/history,
 * binary matching volume, and administrative recalculation engines.
 *
 * Adheres strictly to:
 * 1. Project API response envelopes (sendSuccess / centralized error handler).
 * 2. Strict input validation and zero-trust of frontend volume values.
 * 3. Authoritative ledger-driven recalculation and qualification.
 * 4. Zero business logic inside the controller; delegates to domain services.
 */
export class MemberLevelController {
  // =========================================================================
  // 1. GET /api/members/:memberId/level
  // =========================================================================
  public static async getMemberLevel(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const details = await LevelService.getMemberLevel(memberId);

      const responseData = {
        memberId: details.memberId,
        distributorCode: details.distributorCode,
        currentLevel: details.currentLevel.name,
        currentLevelCode: details.currentLevel.code,
        currentLevelOrder: details.currentLevel.order,
        bb: details.currentBB,
        leftMatching: details.currentLeftMatching,
        rightMatching: details.currentRightMatching,
        matching: details.currentMatching,
        nextLevel: details.nextLevel ? details.nextLevel.name : null,
        nextLevelRequirements: details.nextLevel
          ? {
              bb: details.nextLevel.requiredBB,
              leftMatching: details.nextLevel.requiredLeftMatching,
              rightMatching: details.nextLevel.requiredRightMatching,
              matching: details.nextLevel.requiredMatching ?? details.nextLevel.requiredLeftMatching,
              requiredBB: details.nextLevel.requiredBB,
              requiredLeftMatching: details.nextLevel.requiredLeftMatching,
              requiredRightMatching: details.nextLevel.requiredRightMatching,
              requiredMatching: details.nextLevel.requiredMatching ?? details.nextLevel.requiredLeftMatching,
            }
          : null,
        progress: {
          bbGap: details.progress.bbGap,
          leftMatchingGap: details.progress.leftMatchingGap,
          rightMatchingGap: details.progress.rightMatchingGap,
          matchingGap: details.progress.matchingGap,
          bbProgressPercentage: details.progress.bbProgressPercentage,
          leftMatchingProgressPercentage: details.progress.leftMatchingProgressPercentage,
          rightMatchingProgressPercentage: details.progress.rightMatchingProgressPercentage,
          matchingProgressPercentage: details.progress.matchingProgressPercentage,
          isQualifiedForNext: details.progress.isQualifiedForNext,
        },
      };

      sendSuccess(res, {
        message: 'Member level retrieved successfully',
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 2. GET /api/members/:memberId/level/progress
  // =========================================================================
  public static async getMemberLevelProgress(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const progressData = await MemberRankProgressService.getMemberRankProgress(memberId);

      sendSuccess(res, {
        message: 'Member next level progress retrieved successfully',
        data: progressData,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 3. GET /api/members/:memberId/level/history
  // =========================================================================
  public static async getMemberLevelHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const query = paginationQuerySchema.parse(req.query);

      const historyResult = await LevelService.getLevelHistory(memberId, {
        page: query.page,
        limit: query.limit,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      // Sort in chronological order (earliest advancement first)
      const chronological = [...historyResult.data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      sendSuccess(res, {
        message: 'Member level history retrieved successfully',
        data: chronological,
        meta: {
          page: historyResult.page,
          limit: historyResult.limit,
          total: historyResult.total,
          totalPages: historyResult.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 4. GET /api/members/:memberId/bb
  // =========================================================================
  public static async getMemberBB(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const bbData = await BBService.getBBBalance(memberId);

      sendSuccess(res, {
        message: 'Member BB balance retrieved successfully',
        data: bbData,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 5. GET /api/members/:memberId/bb/history
  // =========================================================================
  public static async getMemberBBHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const query = paginationQuerySchema.parse(req.query);

      const result = await BBService.getBBHistory(memberId, {
        page: query.page,
        limit: query.limit,
        source: query.source,
        type: query.type,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      sendSuccess(res, {
        message: 'Member BB transaction history retrieved successfully',
        data: result.transactions,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 6. GET /api/members/:memberId/matching
  // =========================================================================
  public static async getMemberMatching(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);

      const [eligibleMatching, volumeData] = await Promise.all([
        MatchingService.calculateEligibleMatching(memberId),
        MatchingService.getMatchingVolume(memberId),
      ]);

      const matchingData = {
        memberId: eligibleMatching.memberId,
        distributorCode: eligibleMatching.distributorCode,
        matching: volumeData,
        matchingVolume: volumeData,
        matchedVolume: eligibleMatching.matchedVolume,
        leftVolume: eligibleMatching.leftVolume,
        rightVolume: eligibleMatching.rightVolume,
        strongLeg: eligibleMatching.strongLeg,
        weakLeg: eligibleMatching.weakLeg,
        unmatchedVolume: eligibleMatching.unmatchedVolume,
        carryForwardLeft: eligibleMatching.carryForwardLeft,
        carryForwardRight: eligibleMatching.carryForwardRight,
        isEligible: eligibleMatching.isEligible,
        ruleApplied: eligibleMatching.ruleApplied,
        calculatedAt: eligibleMatching.calculatedAt,
      };

      sendSuccess(res, {
        message: 'Member matching volume metrics retrieved successfully',
        data: matchingData,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 7. GET /api/members/:memberId/matching/history
  // =========================================================================
  public static async getMemberMatchingHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const query = paginationQuerySchema.parse(req.query);

      const result = await MatchingService.getMatchingHistory(memberId, {
        page: query.page,
        limit: query.limit,
        source: query.source,
        type: query.type,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      sendSuccess(res, {
        message: 'Member matching history retrieved successfully',
        data: result.data,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          currentBalance: result.currentBalance,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 8. POST /api/admin/members/:memberId/recalculate-level
  // =========================================================================
  public static async adminRecalculateLevel(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const body = adminRecalculateBodySchema.parse(req.body || {});

      const result = await LevelService.recalculateMemberLevel(memberId, {
        source: 'ADMIN_RECALC',
        reason: body.reason || 'Admin level recalculation triggered',
        forcePromotion: body.forceUpdate,
      });

      sendSuccess(res, {
        statusCode: 200,
        message: `Member level recalculation completed successfully for ${memberId}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 9. POST /api/admin/members/:memberId/recalculate-bb
  // =========================================================================
  public static async adminRecalculateBB(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      adminRecalculateBodySchema.parse(req.body || {});

      const result = await BBService.recalculateBBFromLedger(memberId);

      sendSuccess(res, {
        statusCode: 200,
        message: `Member BB recalculation completed successfully for ${memberId}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 10. POST /api/admin/members/:memberId/recalculate-matching
  // =========================================================================
  public static async adminRecalculateMatching(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = memberIdParamSchema.parse(req.params);
      const body = adminRecalculateBodySchema.parse(req.body || {});

      const result = await MatchingService.recalculateMatching(memberId, {
        forceUpdate: body.forceUpdate,
        auditReason: body.reason || 'Admin matching recalculation triggered',
      });

      sendSuccess(res, {
        statusCode: 200,
        message: `Member matching recalculation completed successfully for ${memberId}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
