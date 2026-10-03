import { Router } from 'express';
import { BVController } from '../controllers/bv.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  bvLedgerQuerySchema,
  creditBVSchema,
  debitBVSchema,
  periodParamSchema,
  reverseBVTransactionSchema,
} from '../validators/bv.validators';

const router = Router();

// All BV endpoints require authentication
router.use(authenticate);

// ==========================================
// DISTRIBUTOR PERSONAL BV ENDPOINTS
// ==========================================

// GET /api/v1/bv/balance - Retrieve current BV balance
router.get('/balance', BVController.getMyBalance);

// GET /api/v1/bv/period/:periodId - Retrieve BV accumulated in a period
router.get(
  '/period/:periodId',
  validate({ params: periodParamSchema }),
  BVController.getMyPeriodBV
);

// GET /api/v1/bv/legs - Retrieve binary left and right leg volumes
router.get('/legs', BVController.getMyLegs);

// GET /api/v1/bv/ledger - Paginated personal BV ledger history
router.get(
  '/ledger',
  validate({ query: bvLedgerQuerySchema }),
  BVController.getMyLedger
);

// ==========================================
// ADMIN & SUPPORT INSPECTION ENDPOINTS
// ==========================================

// GET /api/v1/bv/distributors/:distributorId/balance
router.get(
  '/distributors/:distributorId/balance',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT'),
  BVController.getDistributorBalance
);

// GET /api/v1/bv/distributors/:distributorId/period/:periodId
router.get(
  '/distributors/:distributorId/period/:periodId',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT'),
  validate({ params: periodParamSchema }),
  BVController.getDistributorPeriodBV
);

// GET /api/v1/bv/distributors/:distributorId/legs
router.get(
  '/distributors/:distributorId/legs',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT'),
  BVController.getDistributorLegs
);

// GET /api/v1/bv/distributors/:distributorId/ledger
router.get(
  '/distributors/:distributorId/ledger',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT'),
  validate({ query: bvLedgerQuerySchema }),
  BVController.getDistributorLedger
);

// ==========================================
// ADMIN TRANSACTION MANAGEMENT (CREDIT, DEBIT, REVERSAL)
// ==========================================

// POST /api/v1/bv/credit - Manual BV credit (mandatory reference required)
router.post(
  '/credit',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: creditBVSchema }),
  BVController.creditBV
);

// POST /api/v1/bv/debit - Manual BV debit (mandatory reference required)
router.post(
  '/debit',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: debitBVSchema }),
  BVController.debitBV
);

// POST /api/v1/bv/reverse - Compensating reversal transaction
router.post(
  '/reverse',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: reverseBVTransactionSchema }),
  BVController.reverseTransaction
);

export const bvRouter = router;
