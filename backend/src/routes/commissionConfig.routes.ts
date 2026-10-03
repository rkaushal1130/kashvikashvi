import { Router } from 'express';
import { CommissionConfigController } from '../controllers/commissionConfig.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  updateCommissionRateSchema,
  levelNumberParamSchema,
} from '../validators/commissionConfig.validators';

const router = Router();

// Read operations (accessible to authenticated users)
router.get('/', authenticate, CommissionConfigController.getCommissionRates);
router.get('/validate', authenticate, CommissionConfigController.validateConfiguration);
router.get(
  '/:levelNumber',
  authenticate,
  validate({ params: levelNumberParamSchema }),
  CommissionConfigController.getCommissionRateByLevel
);

// Admin operations
router.put(
  '/:levelNumber',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ params: levelNumberParamSchema, body: updateCommissionRateSchema }),
  CommissionConfigController.updateCommissionRate
);

router.post(
  '/reset',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CommissionConfigController.resetDefaultRates
);

export default router;
