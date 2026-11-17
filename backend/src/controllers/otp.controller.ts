import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { OtpService } from '../services/otp.service';
import { sendSuccess } from '../utils/apiResponse';

export class OtpController {
  /**
   * Get public MSG91 widget configuration
   * GET /api/otp/config or GET /api/v1/otp/config
   */
  public static async getConfig(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      statusCode: 200,
      message: 'OTP configuration fetched successfully',
      data: {
        widgetId: env.MSG91_WIDGET_ID || '366b706c3542343638343034',
        tokenAuth: env.MSG91_AUTH_KEY || '',
      },
    });
  }

  /**
   * Send OTP via MSG91 REST API
   * POST /api/otp/send or POST /api/v1/otp/send
   */
  public static async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body;
      const result = await OtpService.sendOtpViaRest(phone);
      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: {
          reqId: result.reqId,
          type: result.type,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retry/Resend OTP via MSG91 REST API
   * POST /api/otp/retry or POST /api/v1/otp/retry
   */
  public static async retryOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reqId, channel } = req.body;
      const result = await OtpService.retryOtpViaRest(reqId, channel);
      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: {
          reqId: result.reqId,
          type: result.type,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP via MSG91 REST API and issue verification session
   * POST /api/otp/verify or POST /api/v1/otp/verify
   */
  public static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reqId, otp, phone } = req.body;
      const session = await OtpService.verifyOtpViaRest(reqId, otp, phone);
      sendSuccess(res, {
        statusCode: 200,
        message: 'Mobile number verified successfully',
        data: {
          verificationSessionId: session.sessionId,
          phone: session.phone,
          expiresAt: session.expiresAt.toISOString(),
          accessToken: session.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

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
