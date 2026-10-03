import { Request, Response, NextFunction } from 'express';
import { CommissionDashboardService } from '../services/commissionDashboard.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

/**
 * ============================================================================
 * COMMISSION DASHBOARD CONTROLLER (PROMPT 24)
 * ============================================================================
 * Exposes member commission dashboard endpoint:
 * GET /api/members/:memberId/commissions/dashboard
 * GET /api/v1/members/:memberId/commissions/dashboard
 */
export class CommissionDashboardController {
  /**
   * Retrieves commission dashboard for a member using high-performance
   * database aggregation queries.
   */
  public static async getMemberDashboard(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const memberId =
        req.params.memberId === 'me'
          ? (req.user?.id as string)
          : req.params.memberId;

      if (!memberId) {
        throw AppError.badRequest('Member identifier is required');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const data = await CommissionDashboardService.getMemberCommissionDashboard(
        memberId,
        { page, limit },
        req.user
      );

      sendSuccess(res, {
        message: 'Commission dashboard retrieved successfully',
        data,
        statusCode: 200,
        meta: {
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
