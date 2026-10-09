import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { WithdrawalService } from '../services/withdrawal.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  approveWithdrawalSchema,
  cancelOrFailWithdrawalSchema,
  createWithdrawalSchema,
  disburseWithdrawalSchema,
  processWithdrawalSchema,
  reverseWithdrawalSchema,
  validateWithdrawalQuerySchema,
  withdrawalQuerySchema,
} from '../validators/withdrawal.validators';

export class WithdrawalController {
  /**
   * Pre-check withdrawal eligibility against the 8 verification rules.
   * GET /api/v1/withdrawals/validate
   */
  public static async validateWithdrawal(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
      }

      const query = validateWithdrawalQuerySchema.parse(req.query);
      const validation = await WithdrawalService.validateWithdrawal(
        req.user.id,
        query.amount,
        query.bankAccountId
      );

      sendSuccess(res, {
        statusCode: 200,
        message: validation.isValid
          ? 'Withdrawal request satisfies all 8 verification rules'
          : 'Withdrawal verification failed',
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Member submits a withdrawal request.
   * POST /api/v1/withdrawals
   */
  public static async createWithdrawal(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
      }

      const input = createWithdrawalSchema.parse(req.body);
      const withdrawal = await WithdrawalService.requestWithdrawal(req.user.id, input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'Withdrawal request submitted successfully. Funds placed on pending hold.',
        data: withdrawal,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Member views their own withdrawal requests.
   * GET /api/v1/withdrawals
   */
  public static async getMyWithdrawals(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
      }

      const distributor = await prisma.distributorProfile.findUnique({
        where: { userId: req.user.id },
      });

      if (!distributor) {
        sendSuccess(res, {
          data: { withdrawals: [], total: 0, page: 1, limit: 20, totalPages: 1 },
        });
        return;
      }

      const query = withdrawalQuerySchema.parse(req.query);
      const result = await WithdrawalService.getWithdrawals({
        ...query,
        memberId: distributor.id,
      });

      sendSuccess(res, {
        message: 'Withdrawal requests retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single withdrawal by ID.
   * GET /api/v1/withdrawals/:id
   */
  public static async getWithdrawalById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const withdrawal = await WithdrawalService.getWithdrawalById(req.params.id);
      sendSuccess(res, {
        data: withdrawal,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: List all withdrawal requests across members with filters.
   * GET /api/v1/admin/withdrawals
   */
  public static async getAdminWithdrawals(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = withdrawalQuerySchema.parse(req.query);
      const result = await WithdrawalService.getWithdrawals(query);
      sendSuccess(res, {
        message: 'Admin withdrawals retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Approve withdrawal.
   * POST /api/v1/admin/withdrawals/:id/approve
   */
  public static async adminApprove(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = req.user?.id || 'admin';
      const input = approveWithdrawalSchema.parse(req.body);
      const result = await WithdrawalService.approveWithdrawal(
        req.params.id,
        adminUserId,
        input.adminNotes
      );

      sendSuccess(res, {
        message: 'Withdrawal approved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Dispatch processing with payment provider.
   * POST /api/v1/admin/withdrawals/:id/process
   */
  public static async adminProcess(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = req.user?.id || 'admin';
      const input = processWithdrawalSchema.parse(req.body);
      const result = await WithdrawalService.dispatchProcessing(
        req.params.id,
        adminUserId,
        input.provider,
        input.externalTransactionId
      );

      sendSuccess(res, {
        message: 'Withdrawal marked as PROCESSING with payout provider',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Disburse withdrawal (transitions to PAID with Platform Treasury debit).
   * POST /api/v1/admin/withdrawals/:id/disburse
   */
  public static async adminDisburse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = req.user?.id || 'admin';
      const input = disburseWithdrawalSchema.parse(req.body);
      const result = await WithdrawalService.disburseWithdrawal(req.params.id, adminUserId, {
        externalTransactionId: input.externalTransactionId,
        referenceNumber: input.referenceNumber,
        adminNotes: input.adminNotes,
      });

      sendSuccess(res, {
        message: 'Withdrawal disbursed successfully from Platform Treasury',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin / Member: Cancel withdrawal request.
   * POST /api/v1/admin/withdrawals/:id/cancel
   */
  public static async adminCancel(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = req.user?.id;
      const input = cancelOrFailWithdrawalSchema.parse(req.body);
      const result = await WithdrawalService.cancelOrFailWithdrawal(
        req.params.id,
        'CANCELLED',
        input.reason,
        adminUserId
      );

      sendSuccess(res, {
        message: 'Withdrawal cancelled and held funds restored to available balance',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Mark withdrawal as failed by payment provider.
   * POST /api/v1/admin/withdrawals/:id/fail
   */
  public static async adminFail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = req.user?.id;
      const input = cancelOrFailWithdrawalSchema.parse(req.body);
      const result = await WithdrawalService.cancelOrFailWithdrawal(
        req.params.id,
        'FAILED',
        input.reason,
        adminUserId
      );

      sendSuccess(res, {
        message: 'Withdrawal marked as FAILED and held funds restored to available balance',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Post-payout reversal.
   * POST /api/v1/admin/withdrawals/:id/reverse
   */
  public static async adminReverse(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const adminUserId = req.user?.id || 'admin';
      const input = reverseWithdrawalSchema.parse(req.body);
      const result = await WithdrawalService.reverseWithdrawal(
        req.params.id,
        input.reason,
        adminUserId
      );

      sendSuccess(res, {
        message: 'Withdrawal reversed with compensating Treasury ledger credit',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
