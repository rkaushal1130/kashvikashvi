import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AppError } from '../utils/appError';
import { verifyAccessToken } from '../utils/jwt';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.accessToken || req.cookies?.token) {
    token = req.cookies.accessToken || req.cookies.token;
  }

  if (!token) {
    return next(
      AppError.unauthorized('Authorization token is missing or malformed', 'AUTH_TOKEN_MISSING')
    );
  }

  try {
    const payload = verifyAccessToken(token);

    // Verify account status
    if (payload.status === 'BLOCKED') {
      return next(
        AppError.forbidden(
          'Your account has been blocked. Access denied.',
          'AUTH_ACCOUNT_BLOCKED'
        )
      );
    }

    if (payload.status === 'SUSPENDED') {
      return next(
        AppError.forbidden(
          'Your account is temporarily suspended. Please contact support.',
          'AUTH_ACCOUNT_SUSPENDED'
        )
      );
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };

    return next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(
        AppError.unauthorized('Authentication token has expired', 'AUTH_TOKEN_EXPIRED')
      );
    }
    if (error instanceof JsonWebTokenError) {
      return next(
        AppError.unauthorized('Invalid authentication token', 'AUTH_INVALID_TOKEN')
      );
    }
    return next(
      AppError.unauthorized('Token authentication failed', 'AUTH_UNAUTHORIZED')
    );
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);
      if (payload.status !== 'BLOCKED' && payload.status !== 'SUSPENDED') {
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          status: payload.status,
        };
      }
    } catch {
      // Ignored for optional authentication
    }
  }
  next();
};
