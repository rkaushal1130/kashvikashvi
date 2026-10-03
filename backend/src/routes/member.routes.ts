import { Router } from 'express';
import { MemberLevelController } from '../controllers/memberLevel.controller';
import { authenticate } from '../middleware/auth';

/**
 * ============================================================================
 * MEMBER LEVEL & VOLUME ROUTES
 * ============================================================================
 * Routes mounted at:
 * /api/members and /api/v1/members
 *
 * Endpoints:
 * - GET /:memberId/level
 * - GET /:memberId/level/progress
 * - GET /:memberId/level/history
 * - GET /:memberId/bb
 * - GET /:memberId/bb/history
 * - GET /:memberId/matching
 * - GET /:memberId/matching/history
 */

import { AppError } from '../utils/appError';

const router = Router();

// Enforce standard authentication for member data lookups
router.use(authenticate);

// IMMUTABILITY GUARD (PROMPT 9): Promotion history must NEVER be modified or deleted
router.all('/:memberId/level/history/:historyId?', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    throw AppError.forbidden('Promotion history is immutable. Modifying or deleting history records is strictly prohibited.');
  }
  next();
});

// MEMBER LEVEL & PROGRESS
router.get('/:memberId/level/progress', MemberLevelController.getMemberLevelProgress);
router.get('/:memberId/level/history', MemberLevelController.getMemberLevelHistory);
router.get('/:memberId/level', MemberLevelController.getMemberLevel);

// BB SUMMARY & LEDGER HISTORY
router.get('/:memberId/bb/history', MemberLevelController.getMemberBBHistory);
router.get('/:memberId/bb', MemberLevelController.getMemberBB);

// MATCHING VOLUME METRICS & TRANSACTION HISTORY
router.get('/:memberId/matching/history', MemberLevelController.getMemberMatchingHistory);
router.get('/:memberId/matching', MemberLevelController.getMemberMatching);

// MEMBER 5-LEVEL COMMISSIONS (PROMPT 23 & 24)
import { MemberCommissionController } from '../controllers/memberCommission.controller';
import { CommissionDashboardController } from '../controllers/commissionDashboard.controller';
router.get('/:memberId/commissions/dashboard', CommissionDashboardController.getMemberDashboard);
router.get('/:memberId/commissions/summary', MemberCommissionController.getSummary);
router.get('/:memberId/commissions/:commissionId', MemberCommissionController.getTransactionDetails);
router.get('/:memberId/commissions', MemberCommissionController.getCommissions);

export const memberRouter = router;
