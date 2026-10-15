import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';
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
