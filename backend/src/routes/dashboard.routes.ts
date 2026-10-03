import { Router, Request, Response, NextFunction } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { verifyAccessToken } from '../utils/jwt';

const router = Router();

// Middleware: Optional authentication (attaches user if Bearer token is passed, allows preview fallback otherwise)
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
      // Invalid token ignored for optional auth
    }
  }
  next();
};

// GET /api/v1/dashboard
router.get('/', optionalAuth, DashboardController.getDashboard);

export const dashboardRouter = router;
