import { NextFunction, Request, Response } from 'express';
import { WalletService } from '../services/wallet.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  adminWalletAdjustmentSchema,
  walletTransactionQuerySchema,
} from '../validators/wallet.validators';

export class WalletController {
  /**
   * Retrieves the authenticated distributor's wallet.
   * GET /api/v1/wallet
   */
  public static async getMyWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required to access wallet.', 'AUTH_REQUIRED');
      }

      const wallet = await WalletService.getWalletByUserId(req.user.id);

      sendSuccess(res, {
        message: 'Wallet retrieved successfully',
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves the authenticated distributor's wallet transactions (paginated & filtered).
   * GET /api/v1/wallet/transactions
   */
  public static async getMyTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized(
          'Authentication required to access wallet transactions.',
          'AUTH_REQUIRED'
        );
      }

      const query = walletTransactionQuerySchema.parse(req.query);
      const result = await WalletService.getTransactions({ userId: req.user.id }, query);

      sendSuccess(res, {
        message: 'Wallet transactions retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-only wallet adjustment with mandatory immutable transaction and audit log creation.
   * POST /api/v1/admin/wallet/adjust or POST /api/v1/wallet/adjust
   */
  public static async adminAdjust(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const input = adminWalletAdjustmentSchema.parse(req.body);
      const result = await WalletService.adjustWalletBalance(req.user.id, input, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        statusCode: 200,
        message: 'Wallet balance adjusted successfully and recorded in audit log.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Guard handler preventing any direct frontend modifications to wallet balance.
   */
  public static blockDirectMutation(req: Request, res: Response, next: NextFunction): void {
    throw AppError.forbidden(
      'Direct wallet balance modifications are prohibited. Wallet updates must occur through official business transactions (Commissions, Orders, Payouts) or authorized Administrative Adjustments.',
      'WALLET_MUTATION_PROHIBITED'
    );
  }
}
