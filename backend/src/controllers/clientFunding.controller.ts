import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { ClientFundingService } from '../services/clientFunding.service';
import { BankAccountService } from '../services/bankAccount.service';
import {
  addBankAccountSchema,
  createClientFundingOrderSchema,
  listClientFundingOrdersQuerySchema,
  verifyClientFundingPaymentSchema,
} from '../validators/clientFunding.validators';

export class ClientFundingController {
  /**
   * POST /api/v1/funding/orders
   * Create a new funding order for the authenticated client.
   */
  public static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createClientFundingOrderSchema.parse(req.body);
      const result = await ClientFundingService.createFundingOrder((req as any).user.id, validated);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Funding order created successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/funding/verify
   * Verify signature and atomically credit funds to client's wallet.
   */
  public static async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = verifyClientFundingPaymentSchema.parse(req.body);
      const result = await ClientFundingService.verifyPayment((req as any).user.id, validated);
      return sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/funding/orders
   * List authenticated client's funding history.
   */
  public static async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listClientFundingOrdersQuerySchema.parse(req.query);
      const result = await ClientFundingService.listMyOrders((req as any).user.id, query);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Funding history retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/funding/orders/:id
   * Get single order status for authenticated client.
   */
  public static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await ClientFundingService.getOrderById((req as any).user.id, req.params.id);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Funding order retrieved successfully.',
        data: { order },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/funding/bank-accounts
   * List client's registered bank accounts.
   */
  public static async listBankAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await BankAccountService.listBankAccounts((req as any).user.id);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Bank accounts retrieved successfully.',
        data: { accounts },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/funding/bank-accounts
   * Register a new bank account (saved as PENDING_VERIFICATION).
   */
  public static async addBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = addBankAccountSchema.parse(req.body);
      const account = await BankAccountService.addBankAccount((req as any).user.id, validated);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Bank account registered successfully. Verification pending.',
        data: { account },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/funding/bank-accounts/:id/verify
   * Trigger provider verification check for bank account.
   */
  public static async verifyBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const simulated = req.body?.simulatedSuccess !== false;
      const account = await BankAccountService.verifyBankAccount((req as any).user.id, req.params.id, simulated);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Bank account verification processed.',
        data: { account },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/funding/bank-accounts/:id
   */
  public static async deleteBankAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = await BankAccountService.deleteBankAccount((req as any).user.id, req.params.id);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Bank account deleted successfully.',
        data: { success: deleted },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/webhooks/client-funding
   * Public webhook endpoint for Razorpay payment captured events.
   */
  public static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) || '';
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const result = await ClientFundingService.processWebhook(rawBody, signature, req.body);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Webhook processed.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
