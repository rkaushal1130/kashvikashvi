import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods don't modify server state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    // Generate and set CSRF cookie if not present
    if (!req.cookies?.['kashvi_csrf_token']) {
      const token = crypto.randomBytes(24).toString('hex');
      res.cookie('kashvi_csrf_token', token, {
        httpOnly: false, // Must be readable by client JS to attach to X-CSRF-Token header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }
    return next();
  }

  // If request uses Bearer token, it is already immune to browser automatic credential CSRF
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // If request relies on cookies (e.g. refresh token or session cookie)
  const cookieCsrf = req.cookies?.['kashvi_csrf_token'];
  const headerCsrf = req.headers['x-csrf-token'] as string;

  if (req.cookies?.['kashvi_refresh_token'] || req.cookies?.['kashvi_session']) {
    if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf) {
      res.status(403).json({
        success: false,
        message: 'CSRF token mismatch or missing. Action rejected for security.',
      });
      return;
    }
  }

  next();
}
