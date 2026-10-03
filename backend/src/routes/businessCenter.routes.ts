import { Router, Request, Response, NextFunction } from 'express';
import { BusinessCenterController } from '../controllers/businessCenter.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { verifyAccessToken } from '../utils/jwt';
import {
  businessCenterIdParamSchema,
  businessCenterQuerySchema,
  businessCenterTreeQuerySchema,
} from '../validators/businessCenter.validators';

export const businessCenterRouter = Router();

// Middleware: Optional authentication (attaches user if Bearer token is provided)
const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        status: payload.status,
      };
    } catch {
      // ignore
    }
  }
  next();
};

businessCenterRouter.use(optionalAuth);

// GET /api/v1/business-centers - Retrieve all business centers for distributor
businessCenterRouter.get(
  '/',
  validate({ query: businessCenterQuerySchema }),
  BusinessCenterController.getBusinessCenters
);

// GET /api/v1/business-centers/:id - Retrieve specific business center details
businessCenterRouter.get(
  '/:id',
  validate({ params: businessCenterIdParamSchema }),
  BusinessCenterController.getBusinessCenterById
);

// GET /api/v1/business-centers/:id/tree - Retrieve independent binary tree for this center
businessCenterRouter.get(
  '/:id/tree',
  validate({ params: businessCenterIdParamSchema, query: businessCenterTreeQuerySchema }),
  BusinessCenterController.getBusinessCenterTree
);

// GET /api/v1/business-centers/:id/summary - Retrieve volume & team summary for this center
businessCenterRouter.get(
  '/:id/summary',
  validate({ params: businessCenterIdParamSchema }),
  BusinessCenterController.getBusinessCenterSummary
);
