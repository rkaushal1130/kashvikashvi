import { Router } from 'express';
import { CumulativeRankCommissionController } from '../controllers/cumulativeRankCommission.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';

const router = Router();

// ==========================================
// PUBLIC & OPTIONAL AUTH ENDPOINTS
// ==========================================

// GET /api/v1/commissions/cumulative/ranks - Rank configuration (Silver, Gold, Platinum, Diamond, Ruby)
router.get('/ranks', optionalAuth, CumulativeRankCommissionController.getRankConfigs);

// ==========================================
// AUTHENTICATED DISTRIBUTOR ENDPOINTS
// ==========================================

// GET /api/v1/commissions/cumulative/me - Authenticated member's current rank, next rank, BV/matching gaps, eligible tiers
router.get('/me', authenticate, CumulativeRankCommissionController.getMyProgress);

// GET /api/v1/commissions/cumulative/member-progress/:memberId - Rank qualification and gaps
router.get('/member-progress/:memberId', authenticate, CumulativeRankCommissionController.getMemberProgress);

// POST /api/v1/commissions/cumulative/preview - Preview cumulative commission calculation
router.post('/preview', authenticate, CumulativeRankCommissionController.previewCommissions);

// ==========================================
// ADMIN-ONLY MANAGEMENT ENDPOINTS
// ==========================================

// PUT /api/v1/commissions/cumulative/ranks/:rankCode - Update rank thresholds / percentages with validation
router.put(
  '/ranks/:rankCode',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.updateRankConfig
);

// POST /api/v1/commissions/cumulative/recalculate-ranks - Authoritative rank recalculation
router.post(
  '/recalculate-ranks',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.recalculateRanks
);

// POST /api/v1/commissions/cumulative/calculate - Idempotently calculate & record commissions for period
router.post(
  '/calculate',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.calculatePeriodCommissions
);

// POST /api/v1/commissions/cumulative/approve - Approve eligible commissions
router.post(
  '/approve',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.approveCommissions
);

// POST /api/v1/commissions/cumulative/payout - Trigger payout workflow to member wallets
router.post(
  '/payout',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.payoutCommissions
);

// POST /api/v1/commissions/cumulative/reverse - Reverse commission entry with auditable record
router.post(
  '/reverse',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.reverseCommission
);

// GET /api/v1/commissions/cumulative/admin/report - Full admin commission report
router.get(
  '/admin/report',
  authenticate,
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  CumulativeRankCommissionController.getAdminReport
);

export default router;
