import { Request, Response, NextFunction } from 'express';
import { LevelCommissionService } from '../services/levelCommission.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export class LevelCommissionController {
  /**
   * POST /api/v1/commissions/levels/calculate
   * Calculates 5-level commissions for an order.
   */
  public static async calculateForOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.body;
      const result = await LevelCommissionService.calculateCommissionsForOrder(orderId);
      sendSuccess(res, {
        data: result,
        message: '5-Level Unilevel Commissions calculated successfully',
        statusCode: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/levels/preview
   * Previews 5-level commission breakdown without persisting.
   */
  public static async previewCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderBV, purchaserDistributorId } = req.body;
      const result = await LevelCommissionService.previewOrderCommissions(orderBV, purchaserDistributorId);
      sendSuccess(res, {
        data: result,
        message: '5-Level Commission preview generated successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/levels/payout
   * Admin-triggered payout run to credit distributor wallets.
   */
  public static async payoutCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, distributorId, commissionIds, periodId } = req.body;
      const result = await LevelCommissionService.payoutLevelCommissions({
        orderId,
        distributorId,
        commissionIds,
        periodId,
      });
      sendSuccess(res, {
        data: result,
        message: 'Eligible level commissions paid out to distributor wallets successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/levels/reverse
   * Admin-triggered reversal / clawback upon order refund or dispute.
   */
  public static async reverseCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, reason } = req.body;
      const result = await LevelCommissionService.reverseCommissionsForOrder(orderId, reason);
      sendSuccess(res, {
        data: result,
        message: 'Level commissions reversed and clawbacks applied successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/levels/summary
   * Retrieves personal 5-level commission summary for authenticated distributor.
   */
  public static async getMySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.unauthorized('User identity not authenticated');
      }

      // If distributorId query param provided and caller is admin, allow viewing another distributor
      const targetId =
        (req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN') && req.query.distributorId
          ? String(req.query.distributorId)
          : userId;

      const summary = await LevelCommissionService.getDistributorLevelCommissions(targetId, {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        level: req.query.level ? Number(req.query.level) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
      });

      sendSuccess(res, {
        data: summary,
        message: 'Level commission summary retrieved successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/levels/order/:orderId
   * Retrieves 5-level commission breakdown for a specific order.
   */
  public static async getByOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      const commissions = await LevelCommissionService.calculateCommissionsForOrder(orderId);
      sendSuccess(res, {
        data: commissions,
        message: 'Order level commission breakdown retrieved successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}
