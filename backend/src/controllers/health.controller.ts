import { Request, Response } from 'express';

export class HealthController {
  public static getHealth(_req: Request, res: Response): void {
    res.status(200).json({
      success: true,
      message: 'API is healthy',
    });
  }
}
