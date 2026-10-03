import { NextFunction, Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../utils/apiResponse';

export class DashboardController {
  /**
   * Retrieves full aggregated dashboard payload matching the frontend portal layout.
   * GET /api/v1/dashboard
   *
   * Note: No commission calculations are performed inside the controller;
   * all logic is encapsulated within DashboardService and CommissionService.
   */
  public static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const dashboardData = await DashboardService.getDashboard(userId);

      sendSuccess(res, {
        statusCode: 200,
        message: 'Dashboard data retrieved successfully.',
        data: dashboardData,
      });
    } catch (error) {
      next(error);
    }
  }
}
