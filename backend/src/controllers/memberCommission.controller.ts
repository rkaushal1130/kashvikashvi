import { Request, Response, NextFunction } from 'express';
import { CommissionApiService } from '../services/commissionApi.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

/**
 * ============================================================================
 * MEMBER COMMISSION CONTROLLER (PROMPT 23)
 * ============================================================================
 * Handles Member-facing commission endpoints:
 * 1. GET /api/members/:memberId/commissions
 *    Returns paginated commission history.
 * 2. GET /api/members/:memberId/commissions/summary
 *    Returns:
 *    - total commission
 *    - pending commission
 *    - available commission
 *    - paid commission
 *    - reversed commission
 *    - commission by level
 * 3. GET /api/members/:memberId/commissions/:commissionId
 *    Returns complete transaction details.
 */
export class MemberCommissionController {
  /**
   * GET /api/members/:memberId/commissions
   * Return paginated commission history for the member.
   */
  public static async getCommissions(
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

      const result = await CommissionApiService.getMemberCommissions(
        memberId,
        req.query as any,
        req.user
      );

      sendSuccess(res, {
        message: 'Member commission history retrieved successfully',
        data: result.transactions,
        statusCode: 200,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/members/:memberId/commissions/summary
   * Return:
   * - total commission
   * - pending commission
   * - available commission
   * - paid commission
   * - reversed commission
   * - commission by level
   */
  public static async getSummary(
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

      const summary = await CommissionApiService.getMemberCommissionSummary(
        memberId,
        req.user
      );

      sendSuccess(res, {
        message: 'Member commission summary retrieved successfully',
        data: summary,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/members/:memberId/commissions/:commissionId
   * Return complete transaction details.
   */
  public static async getTransactionDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const memberId =
        req.params.memberId === 'me'
          ? (req.user?.id as string)
          : req.params.memberId;
      const { commissionId } = req.params;

      if (!memberId) {
        throw AppError.badRequest('Member identifier is required');
      }
      if (!commissionId) {
        throw AppError.badRequest('Commission identifier is required');
      }

      const details = await CommissionApiService.getMemberCommissionDetails(
        memberId,
        commissionId,
        req.user
      );

      sendSuccess(res, {
        message: 'Commission transaction details retrieved successfully',
        data: details,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}
