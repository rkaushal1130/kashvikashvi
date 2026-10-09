import { Router } from 'express';
import { WithdrawalController } from '../controllers/withdrawal.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  approveWithdrawalSchema,
  cancelOrFailWithdrawalSchema,
  createWithdrawalSchema,
  disburseWithdrawalSchema,
  processWithdrawalSchema,
  reverseWithdrawalSchema,
  validateWithdrawalQuerySchema,
  withdrawalIdParamSchema,
  withdrawalQuerySchema,
} from '../validators/withdrawal.validators';

/**
 * ============================================================================
 * MEMBER WITHDRAWAL ROUTER: /api/v1/withdrawals
 * ============================================================================
 */
export const withdrawalRouter = Router();

withdrawalRouter.use(authenticate);

// Pre-check withdrawal against the 8 verification rules
withdrawalRouter.get(
  '/validate',
  validate({ query: validateWithdrawalQuerySchema }),
  WithdrawalController.validateWithdrawal
);

// Submit a withdrawal request
withdrawalRouter.post(
  '/',
  validate({ body: createWithdrawalSchema }),
  WithdrawalController.createWithdrawal
);

// List member's own withdrawals
withdrawalRouter.get(
  '/',
  validate({ query: withdrawalQuerySchema }),
  WithdrawalController.getMyWithdrawals
);

// Get single withdrawal details
withdrawalRouter.get(
  '/:id',
  validate({ params: withdrawalIdParamSchema }),
  WithdrawalController.getWithdrawalById
);

// Member can cancel pending withdrawal
withdrawalRouter.post(
  '/:id/cancel',
  validate({ params: withdrawalIdParamSchema, body: cancelOrFailWithdrawalSchema }),
  WithdrawalController.adminCancel
);

/**
 * ============================================================================
 * ADMIN WITHDRAWAL ROUTER: /api/v1/admin/withdrawals
 * ============================================================================
 */
export const adminWithdrawalRouter = Router();

adminWithdrawalRouter.use(authenticate);
adminWithdrawalRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// List all withdrawals
adminWithdrawalRouter.get(
  '/',
  validate({ query: withdrawalQuerySchema }),
  WithdrawalController.getAdminWithdrawals
);

// Get single withdrawal
adminWithdrawalRouter.get(
  '/:id',
  validate({ params: withdrawalIdParamSchema }),
  WithdrawalController.getWithdrawalById
);

// Approve withdrawal
adminWithdrawalRouter.post(
  '/:id/approve',
  validate({ params: withdrawalIdParamSchema, body: approveWithdrawalSchema }),
  WithdrawalController.adminApprove
);

// Dispatch processing with payment provider
adminWithdrawalRouter.post(
  '/:id/process',
  validate({ params: withdrawalIdParamSchema, body: processWithdrawalSchema }),
  WithdrawalController.adminProcess
);

// Disburse withdrawal from Platform Treasury
adminWithdrawalRouter.post(
  '/:id/disburse',
  validate({ params: withdrawalIdParamSchema, body: disburseWithdrawalSchema }),
  WithdrawalController.adminDisburse
);

// Cancel withdrawal and restore held funds
adminWithdrawalRouter.post(
  '/:id/cancel',
  validate({ params: withdrawalIdParamSchema, body: cancelOrFailWithdrawalSchema }),
  WithdrawalController.adminCancel
);

// Fail withdrawal and restore held funds
adminWithdrawalRouter.post(
  '/:id/fail',
  validate({ params: withdrawalIdParamSchema, body: cancelOrFailWithdrawalSchema }),
  WithdrawalController.adminFail
);

// Reverse withdrawal
adminWithdrawalRouter.post(
  '/:id/reverse',
  validate({ params: withdrawalIdParamSchema, body: reverseWithdrawalSchema }),
  WithdrawalController.adminReverse
);
