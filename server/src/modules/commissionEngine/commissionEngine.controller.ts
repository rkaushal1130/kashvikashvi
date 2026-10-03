import { Request, Response, NextFunction } from 'express';
import { CommissionEngineService } from './commissionEngine.service.js';
import { AuthRequest } from '../../middleware/auth.js';

export class CommissionEngineController {
  static async calculate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.user?.memberId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }
      const week = parseInt(req.query.week as string) || 38;
      const year = parseInt(req.query.year as string) || 2026;
      const result = await CommissionEngineService.calculateWeeklyCommission(memberId, week, year);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.user?.memberId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }
      const history = await CommissionEngineService.getCommissionHistory(memberId);
      res.status(200).json({ success: true, count: history.length, data: history });
    } catch (err) {
      next(err);
    }
  }
}
