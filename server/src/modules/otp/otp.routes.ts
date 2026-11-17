import { Router } from 'express';
import { OtpController } from './otp.controller.js';

const router = Router();

router.get('/config', OtpController.getConfig);
router.post('/send', OtpController.sendOtp);
router.post('/retry', OtpController.retryOtp);
router.post('/verify', OtpController.verifyOtp);
router.post('/verify-token', OtpController.verifyToken);

export default router;
