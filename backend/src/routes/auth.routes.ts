import { Router } from 'express';
import {
  loginRateLimiter,
  passwordResetRateLimiter,
  registerRateLimiter,
} from '../config/rateLimiter';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth.validators';

const router = Router();

// Registration: Rate limited (10/hr) + Zod validated
router.post(
  '/register',
  registerRateLimiter,
  validate({ body: registerSchema }),
  AuthController.register
);

// Login: Rate limited (10/15m) + Zod validated
router.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  AuthController.login
);

// Refresh Token: Refresh Token Rotation
router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  AuthController.refresh
);

// Logout: Revoke refresh session
router.post(
  '/logout',
  validate({ body: logoutSchema }),
  AuthController.logout
);

// Get current user profile: Protected route
router.get(
  '/me',
  authenticate,
  AuthController.me
);

// Forgot Password: Rate limited (5/15m) + Zod validated
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate({ body: forgotPasswordSchema }),
  AuthController.forgotPassword
);

// Reset Password: Rate limited (5/15m) + Zod validated
router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validate({ body: resetPasswordSchema }),
  AuthController.resetPassword
);

export const authRouter = router;
