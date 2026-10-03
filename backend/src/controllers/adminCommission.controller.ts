import { Request, Response, NextFunction } from 'express';
import { CommissionApiService } from '../services/commissionApi.service';
import { OrderCommissionLifecycleService } from '../services/orderCommissionLifecycle.service';
import { CommissionReversalService } from '../services/commissionReversal.service';
import { CommissionReconciliationService } from '../services/commissionReconciliation.service';
import { AuditService } from '../services/audit.service';
import { assertNoCommissionFieldOverrides } from '../validators/commissionApi.validators';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

/**
 * ============================================================================
 * ADMIN COMMISSION CONTROLLER (PROMPT 23)
 * ============================================================================
 * Handles Administrative commission endpoints:
 * 1. GET /api/admin/commissions
 *    Supports filters: member, source member, order, level, status, date range
 * 2. POST /api/admin/orders/:orderId/process-commission
 *    Authoritatively processes commissions for an order.
 *    Never accepts commission amount, percentage, recipientId, or volume from frontend.
 * 3. POST /api/admin/commissions/:commissionId/reverse
 *    Authoritatively reverses a commission transaction with immutable audit ledger.
 */
export class AdminCommissionController {
  /**
   * GET /api/admin/commissions
   * Support filters:
   * - member
   * - source member
   * - order
   * - level
   * - status
   * - date range
   */
  public static async getCommissions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await CommissionApiService.getAdminCommissions(req.query as any);

      sendSuccess(res, {
        message: 'Admin commissions retrieved successfully',
        data: result.transactions,
        statusCode: 200,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          filtersApplied: result.filtersApplied,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/orders/:orderId/process-commission
   * Admin endpoint to process commissions for an order.
   *
   * ZERO-TRUST INVARIANTS:
   * - Never accept commission amount from the frontend.
   * - Never accept percentage from the frontend.
   * - Never accept recipientId from a normal commission-generation request.
   * - The backend authoritatively determines: BV, upline, level, percentage, commission amount, eligibility.
   */
  public static async processOrderCommission(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = req.params.orderId || req.params.id;
      if (!orderId) {
        throw AppError.badRequest('Order identifier is required');
      }

      // Assert zero client manipulation of commission values
      assertNoCommissionFieldOverrides(
        req.body,
        'POST /api/admin/orders/:orderId/process-commission',
        req.user?.id
      );

      const result = await OrderCommissionLifecycleService.processOrderCommission(orderId);

      // Record administrative commission audit log (Prompt 25)
      await AuditService.recordLog({
        userId: req.user?.id,
        action: 'ADMIN_COMMISSION_PROCESS_ORDER',
        entityType: 'OrderCommission',
        entityId: orderId,
        oldValue: null,
        newValue: {
          status: result.status,
          commissionsCreated: result.commissionsCreated,
          totalCommission: result.totalCommission,
          isIdempotentSkip: result.isIdempotentSkip,
          orderStatus: result.orderStatus,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      const message =
        result.status === 'ALREADY_PROCESSED'
          ? 'Commissions already processed for this order (idempotent skip).'
          : result.status === 'SUCCESS'
          ? 'Commissions processed and distributed successfully.'
          : result.reason || 'Commission lifecycle evaluated.';

      sendSuccess(res, {
        message,
        data: result,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/commissions/:commissionId/reverse
   * Admin endpoint to reverse a single commission transaction.
   *
   * ZERO-TRUST INVARIANTS:
   * - Never accept commission amount or percentage override.
   * - Compensatory reversal is calculated authoritatively from the original immutable record.
   */
  public static async reverseCommission(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const commissionId = req.params.commissionId || req.params.id;
      if (!commissionId) {
        throw AppError.badRequest('Commission identifier is required');
      }

      // Assert zero client manipulation of commission values
      assertNoCommissionFieldOverrides(
        req.body,
        'POST /api/admin/commissions/:commissionId/reverse',
        req.user?.id
      );

      const reason =
        req.body?.reason && typeof req.body.reason === 'string' && req.body.reason.trim()
          ? req.body.reason.trim()
          : 'Administrative commission reversal';

      const result = await CommissionReversalService.reverseSingleCommission(
        commissionId,
        { reason }
      );

      // Record administrative commission audit log (Prompt 25)
      await AuditService.recordLog({
        userId: req.user?.id,
        action: 'ADMIN_COMMISSION_REVERSAL',
        entityType: 'CommissionTransaction',
        entityId: commissionId,
        oldValue: null,
        newValue: {
          reversalAmount: result.reversalAmount,
          recoveryStatus: result.recoveryStatus,
          isIdempotentSkip: result.isIdempotentSkip,
          reason,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        message: result.isIdempotentSkip
          ? 'Commission transaction already reversed (idempotent skip).'
          : 'Commission transaction reversed successfully.',
        data: result,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/commissions/reconcile/order/:orderId
   * GET  /api/admin/commissions/reconcile/order/:orderId
   * Audits Order, BV, Commission Ledger, and Wallet Ledger for a specific order.
   */
  public static async reconcileOrder(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = req.params.orderId || req.params.id;
      if (!orderId) {
        throw AppError.badRequest('Order identifier is required');
      }

      const autoCorrect = req.body?.autoCorrect === true || req.query?.autoCorrect === 'true';

      const result = await CommissionReconciliationService.reconcileOrderCommission(orderId, {
        autoCorrect,
        actor: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        message: result.hasDiscrepancies
          ? `Reconciliation detected ${result.discrepancyCount} discrepancies.`
          : 'Order commission reconciliation completed. No discrepancies detected.',
        data: result,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/commissions/reconcile/member/:memberId
   * GET  /api/admin/commissions/reconcile/member/:memberId
   * Audits Commission transactions, ledger integrity, and wallet balance for a specific member.
   */
  public static async reconcileMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const memberId = req.params.memberId || req.params.id;
      if (!memberId) {
        throw AppError.badRequest('Member identifier is required');
      }

      const autoCorrect = req.body?.autoCorrect === true || req.query?.autoCorrect === 'true';

      const result = await CommissionReconciliationService.reconcileMemberCommissions(memberId, {
        autoCorrect,
        actor: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        message: result.hasDiscrepancies
          ? `Member reconciliation detected ${result.discrepancyCount} discrepancies.`
          : 'Member commission reconciliation completed. No discrepancies detected.',
        data: result,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/commissions/reconcile/period
   * Audits all orders and commissions created/updated within a time window.
   */
  public static async reconcilePeriod(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const startDate = req.body?.startDate || req.query?.startDate;
      const endDate = req.body?.endDate || req.query?.endDate;

      if (!startDate || !endDate) {
        throw AppError.badRequest('Both startDate and endDate are required');
      }

      const autoCorrect = req.body?.autoCorrect === true || req.query?.autoCorrect === 'true';

      const result = await CommissionReconciliationService.reconcileCommissionPeriod(
        startDate as string,
        endDate as string,
        {
          autoCorrect,
          actor: req.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        }
      );

      sendSuccess(res, {
        message: `Period reconciliation completed. Analyzed ${result.ordersAnalyzed} orders with ${result.totalDiscrepancies} discrepancies detected.`,
        data: result,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}
