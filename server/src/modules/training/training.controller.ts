import { Request, Response, NextFunction } from 'express';
import { TrainingService } from './training.service.js';
import { AuthRequest } from '../../middleware/auth.js';

export class TrainingController {
  static async getModules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.user?.memberId;
      const modules = await TrainingService.getModules(memberId);
      res.status(200).json({ success: true, count: modules.length, data: modules });
    } catch (err) {
      next(err);
    }
  }

  static async completeModule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.user?.memberId || '88767139';
      const { moduleCode } = req.body;
      if (!moduleCode) {
        res.status(400).json({ success: false, message: 'moduleCode is required.' });
        return;
      }
      const result = await TrainingService.completeModule(memberId, moduleCode);
      res.status(200).json({ success: true, message: 'Module marked as completed.', data: result });
    } catch (err) {
      next(err);
    }
  }
}
