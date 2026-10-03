import { Request, Response, NextFunction } from 'express';
import { EnrollmentService } from './enrollment.service.js';

export class EnrollmentController {
  static async verifySponsor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sponsorId } = req.params;
      if (!sponsorId) {
        res.status(400).json({ success: false, message: 'Sponsor ID parameter is required.' });
        return;
      }
      const result = await EnrollmentService.verifySponsor(sponsorId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async enroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sponsorId, fullName, email, phone } = req.body;
      if (!sponsorId || !fullName || !email || !phone) {
        res.status(400).json({
          success: false,
          message: 'sponsorId, fullName, email, and phone are mandatory fields.',
        });
        return;
      }
      const result = await EnrollmentService.enrollApplicant(req.body);
      res.status(201).json({
        success: true,
        message: 'Applicant successfully enrolled into the binary business tree!',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
