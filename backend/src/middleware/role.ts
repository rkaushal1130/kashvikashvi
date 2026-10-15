import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { AuthService } from '../services/auth.service';
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

/**
 * Authorization middleware for Product & Pricing Management Center.
 * Access is restricted exclusively to:
 * 1. Authenticated Administrators (ADMIN, SUPER_ADMIN).
 * 2. Authenticated, explicitly authorized Business Center Owners verified from trusted database records.
 *
 * Regular distributors, sponsored persons, customers, and unauthenticated requests are strictly denied.
 */
export const requireProductManagementAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return next(
      AppError.unauthorized(
        'Authentication required before accessing Product Management Center',
        'AUTH_UNAUTHORIZED'
      )
    );
  }

  // 1. SUPER_ADMIN and ADMIN have global product and pricing management rights
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
    return next();
  }

  // 2. Check trusted database / server-side profile for explicitly authorized business center owner
  try {
    let isAuthorizedOwner = false;

    // Check Prisma user record if available
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          role: true,
          distributorProfile: {
            include: {
              businessCenters: true,
            },
          },
        },
      });

      if (user) {
        // Check if role has manage_products permission
        const rolePermissions = user.role?.permissions as any;
        if (
          user.roleName === 'SUPER_ADMIN' ||
          user.roleName === 'ADMIN' ||
          (Array.isArray(rolePermissions) && rolePermissions.includes('manage_products')) ||
          (rolePermissions && typeof rolePermissions === 'object' && rolePermissions.manage_products === true)
        ) {
          isAuthorizedOwner = true;
        }

        // Check if explicitly authorized as business center owner
        if ((user as any).isOwner === true) {
          isAuthorizedOwner = true;
        }
      }
    } catch {
      // Offline fallback: check in-memory store
      try {
        const inMemoryUser = await AuthService.getMe(req.user.id);
        if (
          inMemoryUser &&
          (inMemoryUser.role === 'ADMIN' ||
            inMemoryUser.role === 'SUPER_ADMIN' ||
            inMemoryUser.isOwner === true)
        ) {
          isAuthorizedOwner = true;
        }
      } catch {
        isAuthorizedOwner = false;
      }
    }

    if (isAuthorizedOwner) {
      return next();
    }

    return next(
      AppError.forbidden(
        'Access denied: Product and pricing management is restricted to authorized administrators and verified business center owners.',
        'AUTH_FORBIDDEN'
      )
    );
  } catch (error) {
    return next(error);
  }
};

