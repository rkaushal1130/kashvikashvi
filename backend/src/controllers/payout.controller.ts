import { NextFunction, Request, Response } from 'express';
import { PayoutService } from '../services/payout.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  approvePayoutSchema,
  createPayoutRequestSchema,
  markPaidPayoutSchema,
  payoutQuerySchema,
  rejectPayoutSchema,
} from '../validators/payout.validators';

export class PayoutController {
  /**
   * Submits a payout request for authenticated distributor.
   * POST /api/v1/payouts
   */
  public static async createPayout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = createPayoutRequestSchema.parse(req.body);
      const payout = await PayoutService.requestPayout(req.user.id, input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'Payout request submitted successfully.',
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists payout requests for authenticated distributor (bank details masked).
   * GET /api/v1/payouts
   */
  public static async getMyPayouts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const query = payoutQuerySchema.parse(req.query);
      const result = await PayoutService.getDistributorPayouts(req.user.id, query);

      sendSuccess(res, {
        message: 'Payout requests retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves single payout request for authenticated distributor (bank details masked).
   * GET /api/v1/payouts/:id
   */
  public static async getMyPayoutById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const payout = await PayoutService.getDistributorPayoutById(req.user.id, req.params.id);

      sendSuccess(res, {
        message: 'Payout request retrieved successfully.',
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: List all payout requests.
   * GET /api/v1/admin/payouts
   */
  public static async getAdminPayouts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = payoutQuerySchema.parse(req.query);
      const result = await PayoutService.getAdminPayouts(query);

      sendSuccess(res, {
        message: 'Admin payout requests retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Approve a payout request.
   * POST /api/v1/admin/payouts/:id/approve
   */
  public static async adminApprove(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = approvePayoutSchema.parse(req.body);
      const payout = await PayoutService.approvePayout(req.user.id, req.params.id, input, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        message: 'Payout request approved successfully.',
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Reject a payout request and restore held funds.
   * POST /api/v1/admin/payouts/:id/reject
   */
  public static async adminReject(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = rejectPayoutSchema.parse(req.body);
      const payout = await PayoutService.rejectPayout(req.user.id, req.params.id, input, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        message: 'Payout request rejected and held funds restored to distributor wallet.',
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Mark payout as paid.
   * POST /api/v1/admin/payouts/:id/mark-paid
   */
  public static async adminMarkPaid(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = markPaidPayoutSchema.parse(req.body);
      const payout = await PayoutService.markPaid(req.user.id, req.params.id, input, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        message: 'Payout marked as PAID successfully.',
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }
}
