import { Request, Response, NextFunction } from 'express';
import { CommissionService } from './commission.service.js';
import { CommissionConfigService } from './commissionConfig.service.js';

export class CommissionController {
  /**
   * Central error handling utility
   */
  private static handleError(err: any, res: Response, next: NextFunction): void {
    if (err.statusCode === 404 || err.message?.includes('not found') || err.message?.includes('Not found')) {
      res.status(404).json({ success: false, message: err.message || 'Distributor not found' });
      return;
    }
    if (err.statusCode === 403 || err.message?.includes('403') || err.message?.includes('Forbidden') || err.message?.includes('Only administrators')) {
      res.status(403).json({ success: false, message: err.message || 'Forbidden: Insufficient privileges' });
      return;
    }
    if (
      err.statusCode === 400 ||
      err.message?.includes('Duplicate') ||
      err.message?.includes('not eligible') ||
      err.message?.includes('required') ||
      err.message?.includes('invalid') ||
      err.message?.includes('negative')
    ) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }

  /**
   * GET /api/commission/:distributorId
   * Return commission summary for distributor (matched volume, commission amount, carry-forward).
   */
  static async getCommissionSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'distributorId parameter is required' });
        return;
      }

      const summary = await CommissionService.getCommissionSummary(distributorId);
      res.status(200).json({
        success: true,
        data: summary,
        ...summary,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/commission/:distributorId/eligibility
   * Return qualification and eligibility status for a distributor.
   */
  static async checkEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'distributorId parameter is required' });
        return;
      }

      const eligibility = await CommissionService.checkCommissionEligibility(distributorId);
      res.status(200).json({
        success: true,
        data: eligibility,
        distributorId: eligibility.distributorId,
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
        requirements: eligibility.requirements,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/commission/calculate
   * Preview commission calculation without writing to ledger or wallet.
   */
  static async calculateCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        distributorId,
        cycleId,
        periodId,
        periodType,
        overrideLeftVolume,
        overrideRightVolume,
      } = req.body;

      const targetId = distributorId || (req as any).user?.memberId || (req as any).user?.distributorId;
      if (!targetId) {
        res.status(400).json({ success: false, message: 'distributorId is required in request body' });
        return;
      }

      const calculation = await CommissionService.calculateCommission(targetId, {
        cycleId: cycleId || periodId,
        periodType,
        overrideLeftVolume: overrideLeftVolume !== undefined ? Number(overrideLeftVolume) : undefined,
        overrideRightVolume: overrideRightVolume !== undefined ? Number(overrideRightVolume) : undefined,
      });

      res.status(200).json({
        success: true,
        data: calculation,
        distributorId: calculation.distributorId,
        leftVolume: calculation.leftVolume,
        rightVolume: calculation.rightVolume,
        matchedVolume: calculation.matchedVolume,
        commissionRate: calculation.commissionRate,
        commissionAmount: calculation.grossCommission,
        carryForwardLeft: calculation.carryForwardLeft,
        carryForwardRight: calculation.carryForwardRight,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/commission/post
   * Post commission atomically to ledger and wallet with duplicate cycle protection.
   */
  static async postCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Prompt 6 Section 21: Authorization for Commission posting
      const user = (req as any).user;
      if (user && user.role?.toLowerCase() !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only administrators can manually post commission payouts.',
        });
        return;
      }

      const {
        distributorId,
        cycleId,
        periodId,
        periodType,
        overrideLeftVolume,
        overrideRightVolume,
        notes,
      } = req.body;

      const targetId = distributorId || (req as any).user?.memberId || (req as any).user?.distributorId;
      if (!targetId) {
        res.status(400).json({ success: false, message: 'distributorId is required in request body' });
        return;
      }

      const result = await CommissionService.postCommission(targetId, {
        cycleId: cycleId || periodId,
        periodType,
        overrideLeftVolume: overrideLeftVolume !== undefined ? Number(overrideLeftVolume) : undefined,
        overrideRightVolume: overrideRightVolume !== undefined ? Number(overrideRightVolume) : undefined,
        notes,
      });

      res.status(201).json({
        success: true,
        data: result,
        transactionId: result.ledgerId,
        ledgerId: result.ledgerId,
        amount: result.netPayout,
        status: 'POSTED',
        message: result.message,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/commission/reverse
   * Reverse a posted commission (refunds / adjustments) by adding a reversal ledger record and debiting wallet.
   */
  static async reverseCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, ledgerId, reason } = req.body;
      const targetLedgerId = ledgerId || transactionId;

      if (!targetLedgerId) {
        res.status(400).json({ success: false, message: 'transactionId or ledgerId is required to reverse' });
        return;
      }

      const userRole = (req as any).user?.role || (req.headers['x-user-role'] as string);
      const result = await CommissionService.reverseCommission(targetLedgerId, reason, userRole);

      res.status(200).json({
        success: true,
        data: result,
        transactionId: result.reversalLedgerId,
        status: 'REVERSED',
        message: result.message,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/commission/:distributorId/history
   * Retrieve historical commission ledger entries for a distributor.
   */
  static async getCommissionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'distributorId parameter is required' });
        return;
      }

      const history = await CommissionService.getCommissionHistory(distributorId);
      res.status(200).json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/commission/config
   * Retrieve active commission rule configuration.
   */
  static async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeConfig = CommissionConfigService.getConfig();
      res.status(200).json({
        success: true,
        data: activeConfig,
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }

  /**
   * PUT /api/commission/config
   * Update commission configuration rules (Admin only).
   */
  static async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userRole = (req as any).user?.role || (req.headers['x-user-role'] as string);
      if (!userRole || !['admin', 'super_admin'].includes(userRole.toLowerCase())) {
        res.status(403).json({
          success: false,
          message: '403 Forbidden: Only administrators can modify commission rules.',
        });
        return;
      }

      const updated = CommissionConfigService.updateConfig(req.body, userRole);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Commission rules updated successfully',
      });
    } catch (err: any) {
      CommissionController.handleError(err, res, next);
    }
  }
}
