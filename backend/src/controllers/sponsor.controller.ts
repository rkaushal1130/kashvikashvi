import { NextFunction, Request, Response } from 'express';
import { SponsorService } from '../services/sponsor.service';
import { sendSuccess } from '../utils/apiResponse';

export class SponsorController {
  /**
   * Validates a Sponsor by Distributor ID, Code, or UUID.
   * GET /api/v1/sponsors/:sponsorId
   */
  public static async validateSponsor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sponsorId } = req.params;
      const result = await SponsorService.validateSponsor(sponsorId);

      sendSuccess(res, {
        statusCode: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
