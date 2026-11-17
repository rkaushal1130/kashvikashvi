import { NextFunction, Request, Response } from 'express';
import { OtpService } from '../services/otp.service';
import { sendSuccess } from '../utils/apiResponse';

export class OtpController {
  /**
   * Validates MSG91 OTP access token and creates an OTP verification session
   * POST /api/otp/verify-token or POST /api/v1/otp/verify-token
   */
  public static async verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accessToken, phone } = req.body;

      const session = await OtpService.verifyAccessToken(accessToken, phone);

      sendSuccess(res, {
        statusCode: 200,
        message: 'Mobile number verified successfully',
        data: {
          verificationSessionId: session.sessionId,
          phone: session.phone,
          expiresAt: session.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
