import { Request, Response, NextFunction } from 'express';
import { PayoutService } from './payout.service.js';
import { AuthRequest } from '../../middleware/auth.js';

export class PayoutController {
  static async getMyPayouts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.user?.memberId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }
      const list = await PayoutService.getPayoutsByDistributor(memberId);
      res.status(200).json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async generateBatch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const batch = await PayoutService.generateWeeklyBatch(req.body.batchCode);
      res.status(200).json({ success: true, message: 'Payout batch compiled.', data: batch });
    } catch (err) {
      next(err);
    }
  }
}
