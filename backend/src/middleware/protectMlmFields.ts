import { NextFunction, Request, Response } from 'express';
import { MLMSecurityService } from '../services/mlmSecurity.service';
import { verifyAccessToken } from '../utils/jwt';

/**
 * ============================================================================
 * PROTECT MLM FIELDS MIDDLEWARE (PROMPT 8 & 14)
 * ============================================================================
 * Intercepts incoming requests and verifies that no untrusted client attempts
 * to inject or override protected MLM volume, rank, level, or financial fields.
 */
export const protectMlmFields = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    let userRole = (req as any).user?.role;
    let userId = (req as any).user?.id;
    const path = req.originalUrl || req.path || '';

    // Allow admin level configuration, admin paths, dedicated admin BV adjustment endpoints, and safe read queries
    if (
      path.includes('/admin/config') ||
      path.includes('/admin/levels') ||
      path.includes('/admin') ||
      path.endsWith('/bv') ||
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    ) {
      return next();
    }

    if (!userRole && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = verifyAccessToken(token);
        userRole = payload.role;
        userId = payload.sub;
      } catch {
        // ignore invalid token here
      }
    }

    // Check request body
    if (req.body && typeof req.body === 'object') {
      MLMSecurityService.validatePayloadForProtectedFields(req.body, {
        userId,
        userRole,
        path: req.originalUrl || req.path,
        ipAddress: req.ip,
      });
    }

    // Check query params
    if (req.query && typeof req.query === 'object') {
      MLMSecurityService.validatePayloadForProtectedFields(req.query, {
        userId,
        userRole,
        path: req.originalUrl || req.path,
        ipAddress: req.ip,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};
