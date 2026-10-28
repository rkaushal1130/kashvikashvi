import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createRazorpayOrderSchema,
  verifyRazorpayPaymentSchema,
  walletCheckoutSchema,
} from '../validators/payment.validators';

const router = Router();

// Public Webhook endpoints (verified via HMAC signature on rawBody)
router.post('/razorpay/webhook', PaymentController.handleWebhook);
router.post('/webhook', PaymentController.handleWebhook);

// Enrollment Payment Order & Verification
router.post('/enrollment/order', PaymentController.createEnrollmentOrder);
router.post('/verify-enrollment', PaymentController.verifyEnrollmentPayment);
router.post('/enrollment/verify', PaymentController.verifyEnrollmentPayment);

// Admin Payment Management & Manual Verification
router.get('/admin/enrollments', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), PaymentController.getAdminEnrollments);
router.post('/admin/verify-manual', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), PaymentController.adminVerifyPayment);

// Protected Payment Endpoints
router.post(
  '/razorpay/order',
  authenticate,
  validate({ body: createRazorpayOrderSchema }),
  PaymentController.createRazorpayOrder
);

router.post(
  '/razorpay/verify',
  authenticate,
  validate({ body: verifyRazorpayPaymentSchema }),
  PaymentController.verifyRazorpayPayment
);

router.post(
  '/wallet-checkout',
  authenticate,
  validate({ body: walletCheckoutSchema }),
  PaymentController.walletCheckout
);

export const paymentRouter = router;
