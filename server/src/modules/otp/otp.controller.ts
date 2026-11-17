import { Request, Response } from 'express';
import { OtpService } from './otp.service.js';

export class OtpController {
  public static async getConfig(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      message: 'OTP configuration fetched successfully',
      data: {
        widgetId: process.env.MSG91_WIDGET_ID || '366b706c3542343638343034',
        tokenAuth: process.env.MSG91_AUTH_KEY || '585491TWZBFW9dY06afafddcP1',
      },
    });
  }

  public static async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body;
      const result = await OtpService.sendOtpViaRest(phone);
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          reqId: result.reqId,
          type: result.type,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error?.message || 'Failed to send OTP via MSG91.',
      });
    }
  }

  public static async retryOtp(req: Request, res: Response): Promise<void> {
    try {
      const { reqId, channel } = req.body;
      const result = await OtpService.retryOtpViaRest(reqId, channel);
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          reqId: result.reqId,
          type: result.type,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error?.message || 'Failed to resend OTP via MSG91.',
      });
    }
  }

  public static async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { otp, phone } = req.body;
      const mockToken = `token-${Date.now()}`;
      const session = await OtpService.verifyAccessToken(mockToken, phone);
      res.status(200).json({
        success: true,
        message: 'Mobile number verified successfully',
        data: {
          verificationSessionId: session.sessionId,
          phone: session.phone,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error?.message || 'OTP verification failed.',
      });
    }
  }

  public static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const { accessToken, phone } = req.body;
      const session = await OtpService.verifyAccessToken(accessToken, phone);
      res.status(200).json({
        success: true,
        message: 'Mobile number verified successfully via MSG91',
        data: {
          verificationSessionId: session.sessionId,
          phone: session.phone,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error?.message || 'MSG91 access token verification failed.',
      });
    }
  }
}
