import { Router } from 'express';
import { LevelCommissionController } from '../controllers/levelCommission.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  calculateOrderCommissionSchema,
  previewOrderCommissionSchema,
  payoutLevelCommissionsSchema,
  reverseLevelCommissionsSchema,
  queryLevelCommissionsSchema,
} from '../validators/levelCommission.validators';

import commissionConfigRoutes from './commissionConfig.routes';

const router = Router();

// Configuration endpoints (Levels 1-5 rate configuration)
router.use('/config', commissionConfigRoutes);

// Member / Distributor endpoints
router.get(
  '/summary',
  authenticate,
  validate({ query: queryLevelCommissionsSchema }),
  LevelCommissionController.getMySummary
);

router.post(
  '/preview',
  authenticate,
  validate({ body: previewOrderCommissionSchema }),
  LevelCommissionController.previewCommissions
);

router.get(
  '/order/:orderId',
  authenticate,
  LevelCommissionController.getByOrder
);

// Admin-managed financial endpoints
router.post(
  '/calculate',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ body: calculateOrderCommissionSchema }),
  LevelCommissionController.calculateForOrder
);

router.post(
  '/payout',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ body: payoutLevelCommissionsSchema }),
  LevelCommissionController.payoutCommissions
);

router.post(
  '/reverse',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  validate({ body: reverseLevelCommissionsSchema }),
  LevelCommissionController.reverseCommissions
);

export default router;
