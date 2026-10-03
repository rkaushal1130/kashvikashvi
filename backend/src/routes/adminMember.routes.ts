import { Router } from 'express';
import { MemberLevelController } from '../controllers/memberLevel.controller';
import { ReconciliationController } from '../controllers/reconciliation.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';

/**
 * ============================================================================
 * ADMIN MEMBER LEVEL & VOLUME AUDIT / RECALCULATION ROUTES
 * ============================================================================
 * Strictly protected routes requiring valid authentication and administrative roles
 * (ADMIN or SUPER_ADMIN).
 *
 * Endpoints:
 * - POST /api/admin/members/:memberId/recalculate-level
 * - POST /api/admin/members/:memberId/recalculate-bb
 * - POST /api/admin/members/:memberId/recalculate-matching
 * - POST /api/admin/members/reconcile-all (Prompt 10: Batched network reconciliation)
 * - POST /api/admin/members/:memberId/reconcile (Prompt 10: Single member reconciliation)
 * - GET  /api/admin/members/reconciliation/history (Prompt 10: Audit trail history)
 * - GET  /api/admin/members/:memberId/reconciliation/history
 */

const router = Router();

// Strict RBAC: All administrative recalculations require ADMIN or SUPER_ADMIN authorization
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// Administrative recalculation actions (Prompt 7)
router.post('/:memberId/recalculate-level', MemberLevelController.adminRecalculateLevel);
router.post('/:memberId/recalculate-bb', MemberLevelController.adminRecalculateBB);
router.post('/:memberId/recalculate-matching', MemberLevelController.adminRecalculateMatching);

// Administrative reconciliation engine (Prompt 10)
router.post('/reconcile-all', ReconciliationController.adminReconcileAllMembers);
router.get('/reconciliation/history', ReconciliationController.adminGetReconciliationHistory);
router.post('/:memberId/reconcile', ReconciliationController.adminReconcileMember);
router.get('/:memberId/reconciliation/history', ReconciliationController.adminGetMemberReconciliationHistory);

export const adminMemberRouter = router;

