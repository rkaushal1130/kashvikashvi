import { Request, Response, NextFunction } from 'express';
import { MLMReconciliationService } from '../services/mlmReconciliation.service';
import { logger } from '../config/logger';

export class ReconciliationController {
  /**
   * POST /api/admin/members/:memberId/reconcile
   * Recalculates BB, leg volumes, matching, and eligible level from authoritative ledger records.
   */
  public static async adminReconcileMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = req.params;
      const { reason, dryRun } = req.body || {};
      const actor =
        (req as any).user?.email || (req as any).user?.id || 'ADMIN_OPERATOR';

      const result = await MLMReconciliationService.recalculateMember(memberId, {
        actor,
        reason: reason || 'Manual Admin Member Recalculation & Audit',
        dryRun: Boolean(dryRun),
      });

      const message = result.hasDiscrepancy
        ? `Reconciliation completed with discrepancies detected: BB Δ ${result.bbDiscrepancy}, Matching Δ ${result.matchingDiscrepancy}. Profile updated to match ledger.`
        : 'Reconciliation completed. Authoritative ledger totals fully matched profile.';

      res.status(200).json({
        success: true,
        message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/members/reconcile-all
   * Recalculates all members across the network in memory-safe batches.
   */
  public static async adminReconcileAllMembers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { batchSize, reason, dryRun, stopOnError } = req.body || {};
      const actor =
        (req as any).user?.email || (req as any).user?.id || 'ADMIN_OPERATOR';

      logger.info(
        { actor, batchSize, dryRun },
        'Admin triggered full network reconciliation'
      );

      const summary = await MLMReconciliationService.recalculateAllMembers({
        batchSize: batchSize ? Number(batchSize) : 50,
        actor,
        reason: reason || 'Admin Full Network Recalculation & Audit',
        dryRun: Boolean(dryRun),
        stopOnError: Boolean(stopOnError),
      });

      res.status(200).json({
        success: true,
        message: `Network reconciliation finished. Processed ${summary.totalProcessed} members across ${summary.batchesCompleted} batches with ${summary.totalDiscrepancies} discrepancies and ${summary.totalPromotions} promotions awarded.`,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/members/reconciliation/history
   * Retrieves paginated reconciliation audit records.
   */
  public static async adminGetReconciliationHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        memberId,
        hasDiscrepancy,
        actor,
        page,
        limit,
        startDate,
        endDate,
      } = req.query;

      const history = await MLMReconciliationService.getReconciliationHistory({
        memberId: memberId ? String(memberId) : undefined,
        hasDiscrepancy:
          hasDiscrepancy !== undefined
            ? String(hasDiscrepancy).toLowerCase() === 'true'
            : undefined,
        actor: actor ? String(actor) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
      });

      res.status(200).json({
        success: true,
        data: history.data,
        pagination: {
          total: history.total,
          page: history.page,
          limit: history.limit,
          totalPages: history.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/members/:memberId/reconciliation/history
   * Retrieves paginated reconciliation audit records for a specific member.
   */
  public static async adminGetMemberReconciliationHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { memberId } = req.params;
      const { hasDiscrepancy, page, limit } = req.query;

      const history = await MLMReconciliationService.getReconciliationHistory({
        memberId,
        hasDiscrepancy:
          hasDiscrepancy !== undefined
            ? String(hasDiscrepancy).toLowerCase() === 'true'
            : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.status(200).json({
        success: true,
        data: history.data,
        pagination: {
          total: history.total,
          page: history.page,
          limit: history.limit,
          totalPages: history.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
