import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import {
  LevelQualificationService,
  LevelHistoryService,
  LevelRecalculationService,
} from '../services/level';

export class LevelController {
  /**
   * GET /api/v1/levels/me
   * Retrieves the authenticated member's current level, BB, matching volume, and progression metrics.
   */
  public static async getMyLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw AppError.unauthorized('Authentication required.');
      }

      const distributor = await prisma.distributorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!distributor) {
        throw AppError.notFound('Distributor profile not found for this account.');
      }

      const status = await LevelQualificationService.evaluateQualification(distributor.id);

      sendSuccess(res, {
        message: 'Member level status retrieved successfully',
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/levels/history
   * Retrieves promotion history for the authenticated member.
   */
  public static async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw AppError.unauthorized('Authentication required.');
      }

      const distributor = await prisma.distributorProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!distributor) {
        throw AppError.notFound('Distributor profile not found for this account.');
      }

      const result = await LevelHistoryService.getMemberHistory(distributor.id, req.query);

      sendSuccess(res, {
        message: 'Level advancement history retrieved',
        data: result.history,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/levels/config
   * Public/Distributor list of all 6 ordered levels and their requirements.
   */
  public static async getLevelsConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const levels = await LevelQualificationService.getAllLevels();

      sendSuccess(res, {
        message: 'MLM levels configuration retrieved',
        data: levels,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/levels/member/:idOrCode
   * Lookup qualification status for a specific member by ID or distributor code.
   */
  public static async getMemberLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idOrCode } = req.params;

      const distributor = await prisma.distributorProfile.findFirst({
        where: {
          OR: [{ id: idOrCode }, { distributorCode: idOrCode }, { distributorId: idOrCode }],
        },
        select: { id: true },
      });

      if (!distributor) {
        throw AppError.notFound(`Distributor '${idOrCode}' not found.`);
      }

      const status = await LevelQualificationService.evaluateQualification(distributor.id);

      sendSuccess(res, {
        message: 'Distributor level status retrieved',
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADMIN ACTIONS
  // ==========================================

  /**
   * POST /api/v1/admin/levels/recalculate
   * Triggers a recalculation audit across the network.
   */
  public static async recalculateNetworkLevels(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { onlyActive = true, distributorId } = req.body || {};

      if (distributorId) {
        const result = await LevelRecalculationService.recalculateDistributor(distributorId);
        sendSuccess(res, {
          message: `Level recalculation completed for distributor ${distributorId}`,
          data: result,
        });
        return;
      }

      const summary = await LevelRecalculationService.recalculateNetworkLevels({ onlyActive });

      sendSuccess(res, {
        message: 'Network-wide level recalculation completed successfully',
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/levels/distribution
   * Returns member demographic counts across Silver, Gold, Platinum, Diamond, Ruby.
   */
  public static async getLevelDistribution(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const levels = await LevelQualificationService.getAllLevels();

      const counts = await Promise.all(
        levels.map(async (lvl) => {
          const count = await prisma.distributorProfile.count({
            where: {
              OR: [
                { currentRank: { level: lvl.level } },
                { currentRank: { rankCode: lvl.code } },
              ],
            },
          });
          return {
            level: lvl.level,
            code: lvl.code,
            name: lvl.name,
            requiredBB: lvl.requiredBB,
            requiredLeftMatching: lvl.requiredLeftMatching,
            requiredRightMatching: lvl.requiredRightMatching,
            requiredMatching: lvl.requiredMatching ?? lvl.requiredLeftMatching,
            memberCount: count,
          };
        })
      );

      sendSuccess(res, {
        message: 'Level distribution statistics retrieved',
        data: counts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/levels/admin/config/:idOrCode
   * Allows admin to dynamically update level requirements in the database without code changes.
   */
  public static async updateLevelConfig(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { idOrCode } = req.params;
      const { name, requiredBB, requiredLeftMatching, requiredRightMatching, isActive } = req.body;
      const updated = await LevelQualificationService.updateLevel(idOrCode, {
        name,
        requiredBB: requiredBB !== undefined ? Number(requiredBB) : undefined,
        requiredLeftMatching: requiredLeftMatching !== undefined ? Number(requiredLeftMatching) : undefined,
        requiredRightMatching: requiredRightMatching !== undefined ? Number(requiredRightMatching) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      });

      sendSuccess(res, {
        message: `Level '${idOrCode}' updated successfully`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}
