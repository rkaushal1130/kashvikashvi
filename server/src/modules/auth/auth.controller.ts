import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';

export class AuthController {
  private static setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('kashvi_refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * Centralized error response helper that prevents exposing internal system details
   */
  private static handleError(err: any, res: Response, next: NextFunction): void {
    const msg: string = err.message || 'Authentication error';

    if (msg.includes('suspended') || msg.includes('inactive') || msg.includes('restricted')) {
      res.status(403).json({ success: false, message: msg });
      return;
    }
    if (msg.includes('already registered')) {
      res.status(409).json({ success: false, message: msg });
      return;
    }
    if (msg.includes('Invalid credentials') || msg.includes('not found')) {
      res.status(401).json({ success: false, message: msg });
      return;
    }
    if (msg.includes('temporarily locked') || msg.includes('excessive')) {
      res.status(429).json({ success: false, message: msg });
      return;
    }
    if (msg.includes('required') || msg.includes('incorrect') || msg.includes('match') || msg.includes('least')) {
      res.status(400).json({ success: false, message: msg });
      return;
    }

    // Default safe fallback without leaking stack traces or internal secrets
    res.status(400).json({
      success: false,
      message: msg,
    });
  }

  /**
   * POST /api/auth/register
   * Registers distributor, hashes password with Argon2id, generates JWT tokens
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, email, phone, username, password, confirmPassword, sponsorId, referralCode } = req.body;
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required for registration.',
        });
        return;
      }

      const result = await AuthService.register({
        fullName: fullName || email.split('@')[0],
        email,
        phone,
        username,
        password,
        confirmPassword,
        sponsorId: sponsorId || referralCode,
      });

      // Set HTTP-Only Secure Cookie for Refresh Token
      AuthController.setRefreshTokenCookie(res, result.refreshToken);

      // Audit Log: USER_CREATED
      await AuditService.recordFromRequest(
        req,
        AuditAction.USER_CREATED,
        'User',
        result.user?.id || null,
        null,
        { username: result.user?.username, email: result.user?.email, memberId: result.user?.memberId }
      );

      res.status(201).json({
        success: true,
        message: 'Registration successful! Welcome to Kashvimlm.',
        data: result,
        token: result.accessToken,
        user: result.user,
      });
    } catch (err: any) {
      AuthController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates user, verifies password, enforces account status and lockout protection
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password, sponsorId, rememberMe } = req.body;
      const identifier = username || email;

      if (!identifier || !password) {
        res.status(400).json({
          success: false,
          message: 'Username/Email and Password are required to log in.',
        });
        return;
      }

      const clientIp =
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';

      const result = await AuthService.login(
        { username: identifier, email, password, sponsorId, rememberMe },
        clientIp
      );

      // Set HTTP-Only Secure Cookie for Refresh Token
      AuthController.setRefreshTokenCookie(res, result.refreshToken);

      // Audit Log: LOGIN
      await AuditService.recordFromRequest(
        req,
        AuditAction.LOGIN,
        'User',
        result.user?.id || null,
        null,
        { username: result.user?.username, role: result.user?.role, memberId: result.user?.memberId }
      );

      res.status(200).json({
        success: true,
        message: 'Login successful. Welcome back!',
        data: result,
        token: result.accessToken,
        user: result.user,
      });
    } catch (err: any) {
      AuthController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/auth/change-password
   * Verifies current password, hashes new password with Argon2id, invalidates old sessions
   */
  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'currentPassword and newPassword are both required.',
        });
        return;
      }

      const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);

      // Clear session cookie upon password change
      res.clearCookie('kashvi_refresh_token', { path: '/' });

      // Audit Log: USER_UPDATED (PASSWORD_CHANGE)
      await AuditService.recordFromRequest(
        req,
        AuditAction.USER_UPDATED,
        'User',
        req.user.id,
        null,
        { actionDetail: 'PASSWORD_CHANGE' }
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (err: any) {
      AuthController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/auth/refresh
   * Rotates refresh token with reuse detection
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.cookies?.['kashvi_refresh_token'] || req.body?.refreshToken;

      if (!rawToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token not provided in cookie or request body.',
        });
        return;
      }

      const rotated = await AuthService.refreshToken(rawToken);
      AuthController.setRefreshTokenCookie(res, rotated.refreshToken);

      res.status(200).json({
        success: true,
        message: 'Tokens rotated successfully.',
        data: {
          token: rotated.accessToken,
          accessToken: rotated.accessToken,
          refreshToken: rotated.refreshToken,
          expiresIn: rotated.expiresIn,
          user: rotated.user,
        },
      });
    } catch (err: any) {
      res.clearCookie('kashvi_refresh_token', { path: '/' });
      res.status(401).json({
        success: false,
        message: err.message || 'Token refresh failed.',
      });
    }
  }

  /**
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ success: false, message: 'Email address is required.' });
        return;
      }

      const result = await AuthService.forgotPassword(email);
      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      AuthController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Reset token and newPassword are required.',
        });
        return;
      }

      const result = await AuthService.resetPassword(token, newPassword);
      res.clearCookie('kashvi_refresh_token', { path: '/' });

      await AuditService.recordFromRequest(
        req,
        AuditAction.USER_UPDATED,
        'User',
        null,
        null,
        { actionDetail: 'PASSWORD_RESET_EXECUTED' }
      );

      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Password reset failed.',
      });
    }
  }

  /**
   * GET /api/auth/me
   * Return safe authenticated user profile (never returns password or passwordHash)
   */
  static async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }
      const profile = await AuthService.getMe(req.user.id);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err: any) {
      AuthController.handleError(err, res, next);
    }
  }

  /**
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('kashvi_refresh_token', { path: '/' });

    await AuditService.recordFromRequest(
      req,
      AuditAction.LOGOUT,
      'User',
      (req as any).user?.id || null,
      null,
      { status: 'Logged Out' }
    );

    res.status(200).json({
      success: true,
      message: 'Logged out successfully. All sessions cleared.',
    });
  }
}
