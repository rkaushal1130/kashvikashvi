import { Request, Response, NextFunction } from 'express';
import { BusinessVolumeService } from './businessVolume.service.js';

export class BusinessVolumeController {
  /**
   * Helper: standard error response
   */
  private static handleError(err: any, res: Response, next: NextFunction): void {
    if (err.statusCode === 404 || err.message?.includes('not found') || err.message?.includes('Not found')) {
      res.status(404).json({ success: false, message: err.message || 'Distributor not found' });
      return;
    }
    if (err.statusCode === 400 || err.message?.includes('required') || err.message?.includes('Duplicate') || err.message?.includes('negative')) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }

  /**
   * POST /api/business-volume
   * Create or record a new business volume transaction.
   */
  static async createBusinessVolume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Prompt 6 Section 22: Authorization for Business Volume
      const user = (req as any).user;
      if (user && user.role?.toLowerCase() !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only administrators or automated order systems can record business volume directly.',
        });
        return;
      }

      const { distributorId, orderId, amount, businessVolume, type, status, description } = req.body;
      const transaction = await BusinessVolumeService.recordBusinessVolume({
        distributorId,
        orderId,
        amount: Number(amount || 0),
        businessVolume: Number(businessVolume || 0),
        type,
        status,
        description,
      });

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Business volume transaction recorded successfully',
      });
    } catch (err: any) {
      BusinessVolumeController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/business-volume/:distributorId
   * Retrieve all business volume transactions and personal volume for a distributor.
   */
  static async getDistributorVolume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      const personalBV = await BusinessVolumeService.getPersonalBusinessVolume(distributorId);
      const transactions = await BusinessVolumeService.getTransactions(distributorId);

      res.status(200).json({
        success: true,
        data: {
          distributorId,
          personalBV,
          transactions,
        },
        message: 'Distributor business volume retrieved successfully',
      });
    } catch (err: any) {
      BusinessVolumeController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/business-volume/:distributorId/left
   * Retrieve LEFT team business volume.
   */
  static async getLeftTeamVolume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      const details = await BusinessVolumeService.getTeamVolumeDetails(distributorId, 'LEFT');

      res.status(200).json({
        success: true,
        data: details,
        ...details,
        leg: 'LEFT',
        team: 'LEFT',
        message: 'LEFT team business volume retrieved successfully',
      });
    } catch (err: any) {
      BusinessVolumeController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/business-volume/:distributorId/right
   * Retrieve RIGHT team business volume.
   */
  static async getRightTeamVolume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      const details = await BusinessVolumeService.getTeamVolumeDetails(distributorId, 'RIGHT');

      res.status(200).json({
        success: true,
        data: details,
        ...details,
        leg: 'RIGHT',
        team: 'RIGHT',
        message: 'RIGHT team business volume retrieved successfully',
      });
    } catch (err: any) {
      BusinessVolumeController.handleError(err, res, next);
    }
  }

  /**
   * GET /api/business-volume/:distributorId/summary
   * Retrieve full volume summary: personalBV, leftTeamBV, rightTeamBV, totalTeamBV, totalNetworkBV.
   */
  static async getVolumeSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      const summary = await BusinessVolumeService.getBusinessVolumeSummary(distributorId);
      const normalizedSummary = {
        ...summary,
        personalBv: summary.personalBV,
        leftTeamBv: summary.leftTeamBV,
        rightTeamBv: summary.rightTeamBV,
        totalTeamBv: summary.totalTeamBV,
        totalNetworkBv: summary.totalNetworkBV,
      };

      res.status(200).json({
        success: true,
        data: normalizedSummary,
        ...normalizedSummary,
        message: 'Business volume summary retrieved successfully',
      });
    } catch (err: any) {
      BusinessVolumeController.handleError(err, res, next);
    }
  }
}
