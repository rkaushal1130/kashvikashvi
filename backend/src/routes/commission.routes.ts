import { Router, Request, Response, NextFunction } from 'express';
import { CommissionController } from '../controllers/commission.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import { verifyAccessToken } from '../utils/jwt';
import {
  calculateMilestoneBonusSchema,
  calculateRankBonusSchema,
  createCommissionRuleSchema,
  payoutCommissionsSchema,
  processPCOrderBonusSchema,
  updateCommissionRuleSchema,
} from '../validators/commission.validators';

const router = Router();

// Middleware: Optional authentication for current period (attaches user if Bearer token is present)
const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        status: payload.status,
      };
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
};

// ==========================================
// DISTRIBUTOR COMMISSION VIEWS
// ==========================================

// 5-Level Unilevel Commissions sub-router
import levelCommissionRouter from './levelCommission.routes';
import commissionConfigRoutes from './commissionConfig.routes';
import commissionLedgerRouter from './commissionLedger.routes';
router.use('/levels', levelCommissionRouter);
router.use('/config', commissionConfigRoutes);
router.use('/ledger', commissionLedgerRouter);

// GET /api/v1/commissions/current - Current active period and qualification
router.get('/current', optionalAuth, CommissionController.getCurrentPeriod);

// GET /api/v1/commissions/summary - 5-stream commission breakdown summary
router.get('/summary', optionalAuth, CommissionController.getSummary);

// All remaining commission endpoints require authentication
router.use(authenticate);

// GET /api/v1/commissions/history - Historical commission periods
router.get('/history', CommissionController.getPeriodHistory);

// GET /api/v1/commissions/me - Personal commission ledger history
router.get('/me', CommissionController.getMyCommissions);

// GET /api/v1/commissions/rules - List active commission rules
router.get('/rules', CommissionController.getRules);

// GET /api/v1/commissions/:id - Details of specific commission or period
router.get('/:id', CommissionController.getCommissionOrPeriodById);

// ==========================================
// ADMIN RULE MANAGEMENT
// ==========================================

// POST /api/v1/commissions/rules - Create new database-driven rule
router.post(
  '/rules',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createCommissionRuleSchema }),
  CommissionController.createRule
);

// PATCH /api/v1/commissions/rules/:id - Update existing rule
router.patch(
  '/rules/:id',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: updateCommissionRuleSchema }),
  CommissionController.updateRule
);

// ==========================================
// COMMISSION CALCULATION ENGINE TRIGGERS
// ==========================================

// POST /api/v1/commissions/calculate-weekly - Run weekly commission cycle
router.post(
  '/calculate-weekly',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  CommissionController.calculateWeekly
);

// POST /api/v1/commissions/process-pc-order - Process PC order bonus idempotently
router.post(
  '/process-pc-order',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: processPCOrderBonusSchema }),
  CommissionController.processPCOrder
);

// POST /api/v1/commissions/calculate/milestone - Calculate milestone bonus
router.post(
  '/calculate/milestone',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: calculateMilestoneBonusSchema }),
  CommissionController.calculateMilestone
);

// POST /api/v1/commissions/calculate/rank - Calculate rank bonus
router.post(
  '/calculate/rank',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: calculateRankBonusSchema }),
  CommissionController.calculateRank
);

// ==========================================
// WALLET PAYOUT PROCESSING
// ==========================================

// POST /api/v1/commissions/payout - Process eligible payable commissions to wallet
router.post(
  '/payout',
  authorizeRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: payoutCommissionsSchema }),
  CommissionController.payout
);

export const commissionRouter = router;
