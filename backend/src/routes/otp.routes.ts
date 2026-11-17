import { Router } from 'express';
import { otpVerifyRateLimiter } from '../config/rateLimiter';
import { OtpController } from '../controllers/otp.controller';
import { validate } from '../middleware/validate';
import { verifyOtpTokenSchema } from '../validators/otp.validators';

const router = Router();

// Verify MSG91 Access Token: Rate limited + Zod validated
// POST /api/otp/verify-token or /api/v1/otp/verify-token
router.post(
  '/verify-token',
  otpVerifyRateLimiter,
  validate({ body: verifyOtpTokenSchema }),
  OtpController.verifyToken
);

export const otpRouter = router;
