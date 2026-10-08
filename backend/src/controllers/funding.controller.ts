import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { FundingService } from '../services/funding.service';
import { FundingWorkflowService } from '../services/fundingWorkflow.service';
import { PlatformTreasuryService } from '../services/platformTreasury.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  connectFundingAccountSchema,
  fundingQuerySchema,
  initiateFundingSchema,
  reconcileFundingSchema,
  reverseFundingSchema,
  treasuryTransactionQuerySchema,
  verifyFundingSchema,
} from '../validators/funding.validators';

/**
 * ============================================================================
 * ADMIN FUNDING & TREASURY CONTROLLER (PROMPT 34)
 * ============================================================================
 *
 * Implements secure administrative APIs for corporate treasury & bank funding:
 *
 * 1.  GET  /api/admin/funding/accounts             -> Get funding accounts
 * 2.  POST /api/admin/funding/accounts/connect     -> Connect funding account
 * 3.  POST /api/admin/funding/accounts/:id/disconnect -> Disconnect funding account
 * 4.  GET  /api/admin/funding/accounts/:id/status  -> Get account status
 * 5.  POST /api/admin/funding                      -> Create funding request
 * 6.  GET  /api/admin/funding/:id                  -> Get funding transaction
 * 7.  GET  /api/admin/funding                      -> List funding history
 * 8.  GET  /api/admin/treasury                     -> Get treasury balance
 * 9.  GET  /api/admin/treasury/transactions        -> Get treasury transactions
 * 10. POST /api/admin/funding/:id/reconcile        -> Reconcile funding
 */
export class FundingController {
  /**
   * GET /api/admin/funding/dashboard
   * Returns current platform treasury balance, active accounts, recent transactions, and stats.
   */
  public static async getDashboard(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const dashboard = await FundingWorkflowService.getFundingDashboard();
      sendSuccess(res, {
        statusCode: 200,
        message: 'Admin funding dashboard retrieved successfully',
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 1. GET /api/admin/funding/accounts
   * Lists all corporate funding accounts.
   */
  public static async getAccounts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const provider = req.query.provider as string | undefined;
      const accounts = await FundingService.listFundingAccounts({ provider });
      sendSuccess(res, {
        statusCode: 200,
        message: 'Corporate funding accounts retrieved successfully',
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 2. POST /api/admin/funding/accounts/connect
   * Connects/registers a new corporate bank/payment provider account.
   */
  public static async connectAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = connectFundingAccountSchema.parse(req.body);
      const account = await FundingService.registerFundingAccount(input);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Corporate funding account connected successfully',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 3. POST /api/admin/funding/accounts/:id/disconnect
   * Disconnects / deactivates a corporate funding account.
   */
  public static async disconnectAccount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const account = await FundingService.disconnectFundingAccount(req.params.id, req.user.id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Corporate funding account disconnected successfully',
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 4. GET /api/admin/funding/accounts/:id/status
   * Queries provider for real-time status, KYC state, and available balance.
   */
  public static async getAccountStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await FundingService.getFundingAccountStatus(req.params.id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Corporate funding account real-time status retrieved',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 5. POST /api/admin/funding
   * Admin enters funding amount; creates PENDING funding transaction & provider session.
   *
   * IMPORTANT:
   * The backend validates the amount.
   * The backend creates the funding transaction.
   * The backend communicates with the payment/banking provider.
   * NEVER credit the treasury merely because this endpoint returned successfully.
   */
  public static async createFundingRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = initiateFundingSchema.parse(req.body);
      const result = await FundingWorkflowService.initiateFunding(req.user.id, input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'Funding request created successfully. Awaiting external settlement authorization.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Alias for initiateFunding: POST /api/admin/funding/initiate
   */
  public static initiateFunding = FundingController.createFundingRequest;

  /**
   * 6. GET /api/admin/funding/:id
   * Retrieves single funding transaction details.
   */
  public static async getTransactionById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tx = await FundingService.getFundingTransactionById(req.params.id);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Funding transaction details retrieved',
        data: tx,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 7. GET /api/admin/funding
   * Lists funding history with rich filters:
   * - status
   * - date range (startDate / endDate / from / to)
   * - amount (exact amount or minAmount / maxAmount)
   * - provider
   * - transaction ID (matches id or providerTransactionId)
   * - admin (matches adminId or admin email)
   */
  public static async listTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = fundingQuerySchema.parse(req.query);

      const startDate = query.startDate || query.from;
      const endDate = query.endDate || query.to;

      const whereClause: any = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.provider ? { provider: query.provider.toUpperCase() } : {}),
      };

      // Date range filter
      if (startDate || endDate) {
        whereClause.createdAt = {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        };
      }

      // Amount filter
      if (query.amount !== undefined) {
        whereClause.amount = query.amount;
      } else if (query.minAmount !== undefined || query.maxAmount !== undefined) {
        whereClause.amount = {
          ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
          ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {}),
        };
      }

      // Transaction ID filter
      if (query.transactionId) {
        const idSearch = query.transactionId.trim();
        whereClause.OR = [
          { id: idSearch },
          { providerTransactionId: idSearch },
          { idempotencyKey: idSearch },
        ];
      }

      // Admin filter
      if (query.admin) {
        const adminSearch = query.admin.trim();
        const adminOr = [
          { initiatedByAdminId: adminSearch },
          { initiatedByAdmin: { email: { contains: adminSearch, mode: 'insensitive' } } },
          { initiatedByAdmin: { fullName: { contains: adminSearch, mode: 'insensitive' } } },
        ];

        if (whereClause.OR) {
          whereClause.AND = [{ OR: whereClause.OR }, { OR: adminOr }];
          delete whereClause.OR;
        } else {
          whereClause.OR = adminOr;
        }
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [total, rawTransactions] = await Promise.all([
        prisma.fundingTransaction.count({ where: whereClause }),
        prisma.fundingTransaction.findMany({
          where: whereClause,
          include: {
            fundingAccount: true,
            initiatedByAdmin: { select: { id: true, email: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      sendSuccess(res, {
        statusCode: 200,
        message: 'Funding transactions retrieved successfully',
        data: rawTransactions.map((t) => FundingService.formatTransaction(t)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 8. GET /api/admin/treasury
   * Retrieves platform treasury current available and pending balances.
   */
  public static async getTreasuryBalance(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const balance = await PlatformTreasuryService.getTreasuryBalance();
      sendSuccess(res, {
        statusCode: 200,
        message: 'Platform treasury balance retrieved successfully',
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 9. GET /api/admin/treasury/transactions
   * Retrieves paginated immutable platform treasury ledger transactions.
   */
  public static async getTreasuryTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = treasuryTransactionQuerySchema.parse(req.query);
      const result = await PlatformTreasuryService.getTreasuryTransactions(query);

      sendSuccess(res, {
        statusCode: 200,
        message: 'Platform treasury transactions retrieved successfully',
        data: result.transactions,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 10. POST /api/admin/funding/:id/reconcile
   * Reconciles external transaction against provider.
   * If external provider reports settled, credits treasury atomically.
   */
  public static async reconcileFunding(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = reconcileFundingSchema.parse(req.body);
      const result = await FundingWorkflowService.reconcileFundingTransaction(
        req.user.id,
        req.params.id,
        input
      );

      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/funding/transactions/:id/verify
   * Authoritatively verifies external payment via provider; credits treasury ONLY upon success.
   */
  public static async verifyFunding(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = verifyFundingSchema.parse(req.body);
      const result = await FundingWorkflowService.verifyAndProcessFunding(
        req.user.id,
        req.params.id,
        input
      );

      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/funding/transactions/:id/reverse
   * Reverses a previously succeeded funding transaction and debits Platform Treasury.
   */
  public static async reverseFunding(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }

      const input = reverseFundingSchema.parse(req.body);
      const result = await FundingWorkflowService.processFundingReversal(
        req.user.id,
        req.params.id,
        input.reason
      );

      sendSuccess(res, {
        statusCode: 200,
        message: 'Funding transaction reversed and treasury debited successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/funding/treasury/reconcile
   * Reconciles current Platform Treasury balance with transaction sequence.
   */
  public static async reconcileTreasury(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const report = await PlatformTreasuryService.reconcileTreasury();
      sendSuccess(res, {
        statusCode: 200,
        message: 'Platform treasury reconciliation executed',
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/webhooks/funding/:provider?
   * Ingests asynchronous payment provider webhooks (e.g. RazorpayX / Cashfree).
   */
  public static async handleWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const provider = (req.params.provider || req.headers['x-provider'] || 'RAZORPAYX') as string;
      const signature =
        (req.headers['x-razorpay-signature'] as string) ||
        (req.headers['x-webhook-signature'] as string) ||
        (req.headers['x-cashfree-signature'] as string) ||
        (req.headers['signature'] as string) ||
        '';

      const payload = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      const result = await FundingWorkflowService.handleProviderWebhook(
        payload,
        signature,
        provider.toUpperCase(),
        req.headers as any
      );

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
