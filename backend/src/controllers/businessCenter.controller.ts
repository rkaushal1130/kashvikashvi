import { NextFunction, Request, Response } from 'express';
import { BusinessCenterService } from '../services/businessCenter.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  businessCenterQuerySchema,
  businessCenterTreeQuerySchema,
} from '../validators/businessCenter.validators';

export class BusinessCenterController {
  /**
   * Retrieves all Business Centers for the authenticated distributor.
   * GET /api/v1/business-centers
   */
  public static async getBusinessCenters(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id || 'usr-demo-1';
      const userRole = req.user?.role || 'DISTRIBUTOR';

      const query = businessCenterQuerySchema.parse(req.query);
      const centers = await BusinessCenterService.getBusinessCenters(
        userId,
        query,
        userRole
      );

      sendSuccess(res, {
        message: 'Business centers retrieved successfully.',
        data: centers,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves single Business Center by UUID or centerCode.
   * GET /api/v1/business-centers/:id
   */
  public static async getBusinessCenterById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id || 'usr-demo-1';
      const userRole = req.user?.role || 'DISTRIBUTOR';

      const center = await BusinessCenterService.getBusinessCenterById(
        userId,
        req.params.id,
        userRole
      );

      sendSuccess(res, {
        message: 'Business center retrieved successfully.',
        data: center,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves the independent binary tree rooted at the specified Business Center.
   * Tree queries strictly never mix different business centers.
   * GET /api/v1/business-centers/:id/tree
   */
  public static async getBusinessCenterTree(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id || 'usr-demo-1';
      const userRole = req.user?.role || 'DISTRIBUTOR';

      const query = businessCenterTreeQuerySchema.parse(req.query);
      const result = await BusinessCenterService.getBusinessCenterTree(
        userId,
        req.params.id,
        query.depth,
        userRole
      );

      sendSuccess(res, {
        message: 'Business center tree retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves volume metrics and team summary for the specified Business Center.
   * GET /api/v1/business-centers/:id/summary
   */
  public static async getBusinessCenterSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id || 'usr-demo-1';
      const userRole = req.user?.role || 'DISTRIBUTOR';

      const summary = await BusinessCenterService.getBusinessCenterSummary(
        userId,
        req.params.id,
        userRole
      );

      sendSuccess(res, {
        message: 'Business center summary retrieved successfully.',
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}
