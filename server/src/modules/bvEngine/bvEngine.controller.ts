import { Request, Response, NextFunction } from 'express';
import { BvEngineService } from './bvEngine.service.js';
import { AuthRequest } from '../../middleware/auth.js';

export class BvEngineController {
  static async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.user?.memberId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }
      const summary = await BvEngineService.getVolumeSummary(memberId);
      res.status(200).json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  static async getLedger(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.user?.memberId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 20;
      const ledger = await BvEngineService.getLedgerHistory(memberId, limit);
      res.status(200).json({ success: true, count: ledger.length, data: ledger });
    } catch (err) {
      next(err);
    }
  }
}
