import { Request, Response, NextFunction } from 'express';
import { CumulativeRankCommissionService } from '../services/cumulativeRankCommission.service';
import { RankCode, CommissionBaseType } from '../types/cumulativeRankCommission.types';
import { AppError } from '../utils/appError';
import { logger } from '../config/logger';

export class CumulativeRankCommissionController {
  /**
   * GET /api/v1/commissions/cumulative/ranks
   * Public/authenticated: Returns current 5 ranks configuration and commission percentages.
   */
  public static async getRankConfigs(req: Request, res: Response, next: NextFunction) {
    try {
      const configs = await CumulativeRankCommissionService.getRankConfigs();
      res.json({
        success: true,
        data: configs,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/commissions/cumulative/ranks/:rankCode
   * Admin-only: Updates rank requirements and commission rates with validation.
   */
  public static async updateRankConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { rankCode } = req.params;
      const { name, commissionPercent, minBV, minLeftMatching, minRightMatching, isActive } = req.body;

      const updated = await CumulativeRankCommissionService.updateRankConfig(rankCode as RankCode, {
        ...(name !== undefined ? { name } : {}),
        ...(commissionPercent !== undefined ? { commissionPercent: Number(commissionPercent) } : {}),
        ...(minBV !== undefined ? { minBV: Number(minBV) } : {}),
        ...(minLeftMatching !== undefined ? { minLeftMatching: Number(minLeftMatching) } : {}),
        ...(minRightMatching !== undefined ? { minRightMatching: Number(minRightMatching) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      });

      res.json({
        success: true,
        message: `Rank configuration for '${rankCode}' updated successfully`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/commissions/cumulative/member-progress/:memberId
   * Admin or Member: Returns achieved rank, gaps, progress, and eligible cumulative tiers.
   */
  public static async getMemberProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.params;
      const progress = await CumulativeRankCommissionService.getMemberRankQualification(memberId);
      res.json({
        success: true,
        data: progress,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/commissions/cumulative/me
   * Distributor: Returns authenticated distributor's rank progress, gaps, and eligible tiers.
   */
  public static async getMyProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        throw AppError.unauthorized('Authentication required');
      }

      const memberId = user.distributorProfileId || user.id;
      const progress = await CumulativeRankCommissionService.getMemberRankQualification(memberId);
      res.json({
        success: true,
        data: progress,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/commissions/cumulative/recalculate-ranks
   * Admin-only: Authoritatively recalculates ranks from ledger volumes.
   */
  public static async recalculateRanks(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId } = req.body;
      if (memberId) {
        const result = await CumulativeRankCommissionService.getMemberRankQualification(memberId);
        return res.json({
          success: true,
          message: `Rank recalculation completed for member ${memberId}`,
          data: result,
        });
      }

      const report = await CumulativeRankCommissionService.getAdminCommissionReport();
      res.json({
        success: true,
        message: `Rank recalculation completed for ${report.length} network members`,
        data: {
          recalculatedCount: report.length,
          members: report,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/commissions/cumulative/preview
   * Admin or Authenticated: Previews cumulative commission calculation for a member or period.
   */
  public static async previewCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { memberId, periodId = `CYCLE-${new Date().toISOString().slice(0, 10)}`, baseAmount, baseType } = req.body;
      const user = req.user;

      const targetMemberId = memberId || user?.distributorProfileId || user?.id;
      if (!targetMemberId) {
        throw AppError.badRequest('Member ID or authenticated distributor profile required');
      }

      const calculations = await CumulativeRankCommissionService.calculateMemberCumulativeCommissions(
        targetMemberId,
        periodId,
        { baseAmount, baseType, forceRecalculate: true }
      );

      const totalPreview = calculations.reduce((sum, c) => sum + c.calculatedAmount, 0);

      res.json({
        success: true,
        data: {
          memberId: targetMemberId,
          periodId,
          baseType: baseType || CumulativeRankCommissionService.getCommissionBaseType(),
          totalPreview,
          tiers: calculations,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/commissions/cumulative/calculate
   * Admin-only: Calculates and records period commissions idempotently.
   */
  public static async calculatePeriodCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId = `CYCLE-${new Date().toISOString().slice(0, 10)}`, baseType } = req.body;
      const result = await CumulativeRankCommissionService.calculatePeriodCommissions(periodId, { baseType });

      res.json({
        success: true,
        message: `Period commissions calculated successfully for ${result.membersQualified} qualified members`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/commissions/cumulative/approve
   * Admin-only: Approves calculated commissions for a period.
   */
  public static async approveCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId } = req.body;
      if (!periodId) {
        throw AppError.badRequest('Period ID is required to approve commissions');
      }

      const adminUserId = req.user?.id || 'admin';
      const result = await CumulativeRankCommissionService.approveCommissions(periodId, adminUserId);

      res.json({
        success: true,
        message: `Successfully approved ${result.approvedCount} commissions totaling ₹${result.approvedAmount.toFixed(2)}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/commissions/cumulative/payout
   * Admin-only: Payouts approved commissions to wallets with explicit confirmation.
   */
  public static async payoutCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { periodId, confirmPayout } = req.body;
      if (!periodId) {
        throw AppError.badRequest('Period ID is required to execute payout');
      }
      if (!confirmPayout) {
        throw AppError.badRequest('Explicit confirmation (confirmPayout: true) is required before executing wallet payouts');
      }

      const adminUserId = req.user?.id || 'admin';
      const result = await CumulativeRankCommissionService.payoutCommissions(periodId, adminUserId);

      res.json({
        success: true,
        message: `Successfully disbursed ${result.paidCount} commissions totaling ₹${result.paidAmount.toFixed(2)} to member wallets`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/commissions/cumulative/reverse
   * Admin-only: Reverses a commission with an auditable reason.
   */
  public static async reverseCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const { commissionId, reason } = req.body;
      if (!commissionId || !reason) {
        throw AppError.badRequest('Commission ID and audit reason are required for reversal');
      }

      const adminUserId = req.user?.id || 'admin';
      const result = await CumulativeRankCommissionService.reverseCommission(commissionId, reason, adminUserId);

      res.json({
        success: true,
        message: `Commission ${commissionId} reversed successfully`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/commissions/cumulative/admin/report
   * Admin-only: Complete commission and rank report with full member breakdown.
   */
  public static async getAdminReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await CumulativeRankCommissionService.getAdminCommissionReport();
      const auditTrail = CumulativeRankCommissionService.getAuditTrail();

      res.json({
        success: true,
        data: {
          report,
          auditTrail,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
