import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../types';
import { AppError } from '../utils/appError';

export const authorizeRoles = (...allowedRoles: (UserRole | string)[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        AppError.unauthorized('Authentication required before role verification', 'AUTH_UNAUTHORIZED')
      );
    }

    // ADMIN has administrative authorization access
    if (req.user.role === 'ADMIN' || (req.user.role as string) === 'SUPER_ADMIN') {
      return next();
    }

    const effectiveRole = req.user.role;
    const hasRole = allowedRoles.some((r) => {
      if (r === effectiveRole) return true;
      if (r === ('SUPPORT' as any) && effectiveRole === 'CUSTOMER_CARE') return true;
      return false;
    });

    if (!hasRole) {
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

  // 1. ADMIN has global product and pricing management rights
  if (req.user.role === 'ADMIN' || (req.user.role as string) === 'SUPER_ADMIN') {
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
        const roleName = user.role?.name || user.roleName;
        const rolePermissions = user.role?.permissions as any;
        if (
          roleName === 'SUPER_ADMIN' ||
          roleName === 'ADMIN' ||
          (Array.isArray(rolePermissions) && rolePermissions.includes('manage_products')) ||
          (rolePermissions && typeof rolePermissions === 'object' && rolePermissions.manage_products === true)
        ) {
          isAuthorizedOwner = true;
        }
      }
    } catch {
      isAuthorizedOwner = false;
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

