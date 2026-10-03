import { Router } from 'express';
import { CommissionController } from '../controllers/commission.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  createCommissionPeriodSchema,
  periodHistoryQuerySchema,
  periodIdParamSchema,
} from '../validators/commission.validators';

const router = Router();

// CRITICAL SECURITY RULE: Never expose an admin calculation endpoint without authorization.
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// POST /api/v1/admin/commission-periods - Create new commission period
router.post(
  '/',
  validate({ body: createCommissionPeriodSchema }),
  CommissionController.createPeriod
);

// GET /api/v1/admin/commission-periods - List commission periods
router.get(
  '/',
  validate({ query: periodHistoryQuerySchema }),
  CommissionController.getPeriodHistory
);

// GET /api/v1/admin/commission-periods/:id - Get period details
router.get(
  '/:id',
  validate({ params: periodIdParamSchema }),
  CommissionController.getCommissionOrPeriodById
);

// POST /api/v1/admin/commission-periods/:id/calculate - Run controlled calculation job
router.post(
  '/:id/calculate',
  validate({ params: periodIdParamSchema }),
  CommissionController.calculatePeriod
);

// POST /api/v1/admin/commission-periods/:id/approve - Approve calculated period
router.post(
  '/:id/approve',
  validate({ params: periodIdParamSchema }),
  CommissionController.approvePeriod
);

// POST /api/v1/admin/commission-periods/:id/close - Close and lock period
router.post(
  '/:id/close',
  validate({ params: periodIdParamSchema }),
  CommissionController.closePeriod
);

export const adminCommissionPeriodRouter = router;
