import { NextFunction, Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export class PaymentController {
  /**
   * Generates a pending wholesale order and registers a Razorpay Order ID.
   * POST /api/v1/payments/razorpay/order
   */
  public static async createRazorpayOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required to initiate payment.', 'AUTH_REQUIRED');
      }

      const result = await PaymentService.createRazorpayOrder(req.user.id, req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Razorpay order created successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verifies Razorpay HMAC-SHA256 signature and transitions order to PAID.
   * POST /api/v1/payments/razorpay/verify
   */
  public static async verifyRazorpayPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const result = await PaymentService.verifyRazorpayPayment(req.user.id, req.body);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Payment verified and wholesale order confirmed.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atomic Commission Balance Wallet Checkout (Option A).
   * POST /api/v1/payments/wallet-checkout or POST /api/v1/orders/wallet-checkout
   */
  public static async walletCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.', 'AUTH_REQUIRED');
      }

      const result = await PaymentService.walletCheckout(req.user.id, req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Order paid successfully from Commission Balance Wallet.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ingests Razorpay webhook notifications.
   * POST /api/v1/payments/razorpay/webhook
   */
  public static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) || '';
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      const result = await PaymentService.processWebhook(rawBody, signature, req.body);
      res.status(200).json({ success: true, ...result, data: result });
    } catch (error) {
      next(error);
    }
  }
}
