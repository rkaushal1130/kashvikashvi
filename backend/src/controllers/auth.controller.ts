import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

const isProduction = process.env.NODE_ENV === 'production';

export const REFRESH_COOKIE_NAME = 'kashvi_refresh';

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
});

export const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
  path: '/',
  maxAge: 0,
});

export class AuthController {
  /**
   * Registers a new distributor or customer.
   * POST /api/v1/auth/register
   */
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      };

      const result = await AuthService.register(req.body, metadata);

      if (result.tokens?.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, getRefreshCookieOptions());
        res.cookie('refreshToken', result.tokens.refreshToken, getRefreshCookieOptions());
      }

      const safeUser = {
        userId: result.user.userId || result.user.id,
        id: result.user.id,
        fullName:
          result.user.fullName ||
          result.user.name ||
          `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() ||
          'Distributor',
        email: result.user.email,
        referralCode:
          result.user.referralCode ||
          result.user.distributorCode ||
          result.user.memberId,
        sponsorId: result.user.sponsorId,
        sponsor: result.user.sponsor,
      };

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: safeUser,
        tokens: result.tokens,
        data: {
          ...result,
          user: {
            ...result.user,
            ...safeUser,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Authenticates user and issues access + rotated refresh tokens.
   * POST /api/v1/auth/login
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      };

      const result = await AuthService.login(req.body, metadata);

      if (result.tokens?.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, getRefreshCookieOptions());
        res.cookie('refreshToken', result.tokens.refreshToken, getRefreshCookieOptions());
      }

      const safeUser = {
        userId: result.user.userId || result.user.id,
        id: result.user.id,
        fullName:
          result.user.fullName ||
          result.user.name ||
          result.user.displayName ||
          `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() ||
          'Distributor',
        email: result.user.email,
        role: result.user.role || (result.user as any).roleName,
        status: result.user.status,
        referralCode:
          result.user.referralCode ||
          result.user.distributorCode ||
          result.user.memberId,
        distributorCode:
          result.user.distributorCode ||
          result.user.referralCode ||
          result.user.memberId,
        sponsorId: result.user.sponsorId,
        lastLoginAt: result.user.lastLoginAt,
      };

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: safeUser,
        tokens: result.tokens,
        accessToken: result.accessToken || result.tokens?.accessToken,
        refreshToken: result.tokens?.refreshToken,
        data: {
          ...result,
          user: {
            ...result.user,
            ...safeUser,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refreshes access token with Refresh Token Rotation.
   * POST /api/v1/auth/refresh
   */
  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
      };

      const refreshToken =
        req.cookies?.[REFRESH_COOKIE_NAME] ||
        req.cookies?.refreshToken ||
        req.body?.refreshToken;

      if (!refreshToken) {
        throw AppError.unauthorized('Refresh token is missing or expired', 'AUTH_TOKEN_MISSING');
      }

      const result = await AuthService.refreshToken(refreshToken, metadata);

      if (result.tokens?.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, getRefreshCookieOptions());
        res.cookie('refreshToken', result.tokens.refreshToken, getRefreshCookieOptions());
      }

      sendSuccess(res, {
        statusCode: 200,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revokes session refresh token.
   * POST /api/v1/auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken =
        req.cookies?.[REFRESH_COOKIE_NAME] ||
        req.cookies?.refreshToken ||
        req.body?.refreshToken;
      const userId = req.user?.id;

      await AuthService.logout(refreshToken, userId);

      res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
      res.clearCookie('refreshToken', getClearCookieOptions());
      res.clearCookie('accessToken', { path: '/' });

      sendSuccess(res, {
        statusCode: 200,
        message: 'Logged out successfully',
        data: {},
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves profile of authenticated user.
   * GET /api/v1/auth/me
   */
  public static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await AuthService.getMe(userId);

      sendSuccess(res, {
        statusCode: 200,
        message: 'User profile retrieved',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Requests password reset link/token.
   * POST /api/v1/auth/forgot-password
   */
  public static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);

      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resets password using token.
   * POST /api/v1/auth/reset-password
   */
  public static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.resetPassword(req.body);

      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: {},
      });
    } catch (error) {
      next(error);
    }
  }
}
