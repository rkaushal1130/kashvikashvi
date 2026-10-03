import { Router } from 'express';
import { PayoutController } from '../controllers/payout.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  approvePayoutSchema,
  createPayoutRequestSchema,
  markPaidPayoutSchema,
  payoutIdParamSchema,
  payoutQuerySchema,
  rejectPayoutSchema,
} from '../validators/payout.validators';

// Distributor Payout Router: /api/v1/payouts
export const payoutRouter = Router();

payoutRouter.use(authenticate);

// POST /api/v1/payouts - Submit a payout request
payoutRouter.post(
  '/',
  validate({ body: createPayoutRequestSchema }),
  PayoutController.createPayout
);

// GET /api/v1/payouts - List distributor's payout requests
payoutRouter.get(
  '/',
  validate({ query: payoutQuerySchema }),
  PayoutController.getMyPayouts
);

// GET /api/v1/payouts/:id - Get specific payout request details
payoutRouter.get(
  '/:id',
  validate({ params: payoutIdParamSchema }),
  PayoutController.getMyPayoutById
);

// Admin Payout Router: /api/v1/admin/payouts
export const adminPayoutRouter = Router();

adminPayoutRouter.use(authenticate);
adminPayoutRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// GET /api/v1/admin/payouts - List all payouts with filters
adminPayoutRouter.get(
  '/',
  validate({ query: payoutQuerySchema }),
  PayoutController.getAdminPayouts
);

// POST /api/v1/admin/payouts/:id/approve - Approve payout request
adminPayoutRouter.post(
  '/:id/approve',
  validate({ params: payoutIdParamSchema, body: approvePayoutSchema }),
  PayoutController.adminApprove
);

// POST /api/v1/admin/payouts/:id/reject - Reject payout request
adminPayoutRouter.post(
  '/:id/reject',
  validate({ params: payoutIdParamSchema, body: rejectPayoutSchema }),
  PayoutController.adminReject
);

// POST /api/v1/admin/payouts/:id/mark-paid - Mark payout as paid
adminPayoutRouter.post(
  '/:id/mark-paid',
  validate({ params: payoutIdParamSchema, body: markPaidPayoutSchema }),
  PayoutController.adminMarkPaid
);
