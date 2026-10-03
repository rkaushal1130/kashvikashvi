import { Request, Response, NextFunction } from 'express';
import { CommissionLedgerService } from '../services/commissionLedger.service';
import { AtomicCommissionPostingService } from '../services/atomicCommissionPosting.service';
import { CommissionWalletService } from '../services/commissionWallet.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { prisma } from '../config/database';

export class CommissionLedgerController {
  /**
   * GET /api/v1/commissions/ledger/order/:orderId
   * Retrieves all immutable commission transactions for a specific order.
   */
  public static async getByOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        throw AppError.badRequest('Order ID is required');
      }

      const transactions = await CommissionLedgerService.getTransactionsByOrder(orderId);
      sendSuccess(res, {
        data: transactions,
        message: 'Commission ledger transactions retrieved successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/ledger/me
   * Retrieves the authenticated distributor's paginated commission transactions.
   */
  public static async getMyLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw AppError.unauthorized('Authentication required');
      }

      const profile = await prisma.distributorProfile.findFirst({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        throw AppError.notFound('Distributor profile not found');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as any;
      const commissionLevel = req.query.commissionLevel ? parseInt(req.query.commissionLevel as string, 10) : undefined;

      const result = await CommissionLedgerService.getTransactionsByRecipient(profile.id, {
        page,
        limit,
        status,
        commissionLevel,
      });

      sendSuccess(res, {
        data: result.transactions,
        message: 'Personal commission ledger retrieved successfully',
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
   * GET /api/v1/commissions/ledger/:id/audit
   * Retrieves complete 8-dimensional audit trail for a commission transaction.
   */
  public static async getAuditTrail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        throw AppError.badRequest('Transaction ID is required');
      }

      const audit = await CommissionLedgerService.getAuditTrail(id);
      sendSuccess(res, {
        data: audit,
        message: 'Commission audit trail retrieved successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/ledger/approve-order/:orderId
   * Admin endpoint: Batch approves all pending commission transactions for an order.
   */
  public static async approveOrderCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        throw AppError.badRequest('Order ID is required');
      }

      const result = await CommissionLedgerService.approveOrderCommissions(orderId);
      sendSuccess(res, {
        data: result,
        message: `Successfully approved ${result.approvedCount} commission transactions for order ${orderId}`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/ledger/:id/credit-wallet
   * Admin endpoint: Credits an available/approved commission transaction to recipient wallet.
   * Strictly records WalletTransaction first.
   */
  public static async creditToWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        throw AppError.badRequest('Transaction ID is required');
      }

      const result = await CommissionLedgerService.creditCommissionToWallet(id);
      sendSuccess(res, {
        data: result,
        message: `Commission successfully credited to wallet with transaction ${result.walletTransactionId}`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/ledger/:id/reverse
   * Admin endpoint: Post-payout compensatory reversal.
   */
  public static async reverseCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      if (!id) {
        throw AppError.badRequest('Transaction ID is required');
      }
      if (!reason || !reason.trim()) {
        throw AppError.badRequest('Reversal reason is required');
      }

      const result = await CommissionLedgerService.reversePaidCommission(id, reason);
      sendSuccess(res, {
        data: result,
        message: 'Commission transaction successfully reversed',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/ledger/post-order/:orderId
   * Admin endpoint: Atomically posts commissions for an order (Prompt 19).
   * Validates order, BV, uplines, rates, writes ledger and wallet transactions atomically.
   */
  public static async postOrderCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        throw AppError.badRequest('Order ID is required');
      }

      const result = await AtomicCommissionPostingService.postCommissionForOrder(orderId);
      sendSuccess(res, {
        data: result,
        message: result.message || 'Commissions posted atomically',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/ledger/reconciliation
   * Admin endpoint: Audits and reconciles Commission Ledger against Wallet Ledger (Prompt 20).
   */
  public static async reconcileLedgers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.query.memberId as string | undefined;
      const orderId = req.query.orderId as string | undefined;

      const report = await CommissionWalletService.reconcileCommissionAndWalletLedgers({
        memberId,
        orderId,
      });

      sendSuccess(res, {
        data: report,
        message: report.isReconciled
          ? 'Commission and Wallet ledgers are fully reconciled with 0 discrepancies'
          : `Reconciliation detected ${report.discrepancyCount} discrepancy(s)`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/ledger/withdrawal-eligibility/:memberId
   * Checks if a member can withdraw requested amount and verifies PENDING/REVERSED guards (Prompt 20).
   */
  public static async checkWithdrawalEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId } = req.params;
      const amount = req.query.amount ? parseFloat(req.query.amount as string) : 0;

      const result = await CommissionWalletService.validateWithdrawalEligibility(memberId, amount);
      sendSuccess(res, {
        data: result,
        message: result.canWithdraw
          ? 'Member is eligible for withdrawal'
          : result.reason || 'Member is not eligible for withdrawal',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/ledger/reversal/order/:orderId
   * Admin endpoint: Reverses commissions for an order (Prompt 22).
   */
  public static async reverseOrderCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      const { CommissionReversalService } = await import('../services/commissionReversal.service');
      const result = await CommissionReversalService.reverseOrderCommissions(orderId, req.body);
      sendSuccess(res, {
        data: result,
        message: `Order commissions reversed successfully (${result.totalReversalsCreated} reversals created).`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/ledger/reversals/order/:orderId
   * Retrieves all reversals recorded for an order.
   */
  public static async getOrderReversals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      const { CommissionReversalService } = await import('../services/commissionReversal.service');
      const reversals = await CommissionReversalService.getReversalsForOrder(orderId);
      sendSuccess(res, {
        data: reversals,
        message: `Retrieved ${reversals.length} reversal(s) for order ${orderId}.`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/ledger/reversals/pending-reconciliations
   * Admin endpoint: Lists all reversals requiring administrative reconciliation (shortfalls from withdrawn commissions).
   */
  public static async getPendingReconciliations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { CommissionReversalService } = await import('../services/commissionReversal.service');
      const pending = await CommissionReversalService.getPendingReconciliations();
      sendSuccess(res, {
        data: pending,
        message: `Retrieved ${pending.length} reversal(s) requiring administrative reconciliation.`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/ledger/reversals/:reversalId/resolve
   * Admin endpoint: Resolves an administrative reconciliation deficit.
   */
  public static async resolveReconciliation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reversalId } = req.params;
      const { resolutionType, notes } = req.body;
      const { CommissionReversalService } = await import('../services/commissionReversal.service');
      const resolved = await CommissionReversalService.resolveAdministrativeReconciliation({
        reversalId,
        resolutionType,
        notes,
        adminUserId: req.user!.id,
      });
      sendSuccess(res, {
        data: resolved,
        message: 'Administrative reconciliation deficit resolved successfully.',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

