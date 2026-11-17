import { Router } from 'express';
import { otpVerifyRateLimiter } from '../config/rateLimiter';
import { OtpController } from '../controllers/otp.controller';
import { validate } from '../middleware/validate';
import {
  verifyOtpTokenSchema,
  sendOtpSchema,
  retryOtpSchema,
  verifyOtpRestSchema,
} from '../validators/otp.validators';

const router = Router();

// Public widget configuration: GET /api/otp/config or /api/v1/otp/config
router.get('/config', OtpController.getConfig);

// Send OTP via MSG91 REST API: POST /api/otp/send or /api/v1/otp/send
router.post(
  '/send',
  otpVerifyRateLimiter,
  validate({ body: sendOtpSchema }),
  OtpController.sendOtp
);

// Resend/Retry OTP via MSG91 REST API: POST /api/otp/retry or /api/v1/otp/retry
router.post(
  '/retry',
  otpVerifyRateLimiter,
  validate({ body: retryOtpSchema }),
  OtpController.retryOtp
);

// Verify OTP via MSG91 REST API: POST /api/otp/verify or /api/v1/otp/verify
router.post(
  '/verify',
  otpVerifyRateLimiter,
  validate({ body: verifyOtpRestSchema }),
  OtpController.verifyOtp
);

// Verify MSG91 Access Token: Rate limited + Zod validated
// POST /api/otp/verify-token or /api/v1/otp/verify-token
router.post(
  '/verify-token',
  otpVerifyRateLimiter,
  validate({ body: verifyOtpTokenSchema }),
  OtpController.verifyToken
);

export const otpRouter = router;
