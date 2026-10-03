import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types';
import { AppError } from '../utils/appError';

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        AppError.unauthorized('Authentication required before role verification', 'AUTH_UNAUTHORIZED')
      );
    }

    // SUPER_ADMIN has global authorization access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          'Forbidden: You do not have permission to access this resource',
          'AUTH_FORBIDDEN'
        )
      );
    }

    return next();
  };
};
