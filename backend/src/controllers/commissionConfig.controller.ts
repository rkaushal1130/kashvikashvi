import { Request, Response, NextFunction } from 'express';
import { CommissionConfigService } from '../services/commissionConfig.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export class CommissionConfigController {
  /**
   * GET /api/v1/commissions/config
   * Retrieves all 5 active unilevel commission rates.
   */
  public static async getCommissionRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rates = await CommissionConfigService.getCommissionRates();
      sendSuccess(res, {
        data: rates,
        message: 'Commission rates retrieved successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/config/validate
   * Validates integrity of commission configuration.
   */
  public static async validateConfiguration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CommissionConfigService.validateCommissionConfiguration();
      sendSuccess(res, {
        data: result,
        message: result.isValid
          ? 'Commission configuration is fully valid and active'
          : 'Commission configuration has validation issues',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/commissions/config/:levelNumber
   * Retrieves rate for a specific generation level (1 through 5).
   */
  public static async getCommissionRateByLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const levelNumber = parseInt(req.params.levelNumber, 10);
      if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > 5) {
        throw AppError.badRequest('Level number must be an integer between 1 and 5', 'INVALID_COMMISSION_LEVEL');
      }

      const rate = await CommissionConfigService.getCommissionRate(levelNumber);
      sendSuccess(res, {
        data: rate,
        message: `Commission rate for Level ${levelNumber} retrieved successfully`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/commissions/config/:levelNumber
   * Updates commission rate for a specific generation level (Admin only).
   */
  public static async updateCommissionRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const levelNumber = parseInt(req.params.levelNumber, 10);
      if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > 5) {
        throw AppError.badRequest('Level number must be an integer between 1 and 5', 'INVALID_COMMISSION_LEVEL');
      }

      const { percentage, isActive } = req.body;
      const updated = await CommissionConfigService.updateCommissionRate({
        levelNumber,
        percentage,
        isActive,
      });

      sendSuccess(res, {
        data: updated,
        message: `Commission rate for Level ${levelNumber} updated successfully`,
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/commissions/config/reset
   * Resets all 5 levels to canonical defaults (Admin only).
   */
  public static async resetDefaultRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reset = await CommissionConfigService.initializeDefaultRates();
      sendSuccess(res, {
        data: reset,
        message: 'Commission configuration reset to default canonical rates successfully',
        statusCode: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}
