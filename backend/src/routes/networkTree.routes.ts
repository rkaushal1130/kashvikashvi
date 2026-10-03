import { Router } from 'express';
import { treeRateLimiter } from '../config/rateLimiter';
import { NetworkTreeController } from '../controllers/networkTree.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { distributorIdParamSchema, treeDepthQuerySchema, treeSearchQuerySchema } from '../validators/networkTree.validators';

const router = Router();

// Apply rate limiting (Requirement 15)
router.use(treeRateLimiter);

/**
 * GET /api/v1/network-tree/search?q=Rahul
 * Search authorized distributors by name or distributor ID.
 * Authentication required; non-admins can only search within their own organization.
 */
router.get(
  '/search',
  authenticate,
  validate({ query: treeSearchQuerySchema }),
  NetworkTreeController.searchDistributors
);

/**
 * GET /api/v1/network-tree?depth=3
 * Authenticated distributor's binary MLM network tree.
 * Authentication required; returns requester's own tree.
 */
router.get(
  '/',
  authenticate,
  validate({ query: treeDepthQuerySchema }),
  NetworkTreeController.getMyTree
);

/**
 * GET /api/v1/network-tree/summary
 * Authenticated distributor's network summary statistics.
 */
router.get('/summary', authenticate, NetworkTreeController.getMySummary);

/**
 * GET /api/v1/network-tree/member/:distributorId/summary
 * Summary statistics for a specific member's network.
 * Authentication required; authorized only for self, downline, or admin.
 */
router.get(
  '/member/:distributorId/summary',
  authenticate,
  validate({ params: distributorIdParamSchema }),
  NetworkTreeController.getMemberSummary
);

/**
 * GET /api/v1/network-tree/member/:distributorId?depth=3
 * Specific member's binary MLM network tree.
 * Authentication required; authorized only for self, downline, or admin.
 */
router.get(
  '/member/:distributorId',
  authenticate,
  validate({ params: distributorIdParamSchema, query: treeDepthQuerySchema }),
  NetworkTreeController.getMemberTree
);

// MLM Tree Audit Logging & Administrative Placement (Prompt 16)
import { TreeAuditController } from '../controllers/treeAudit.controller';
import { authorizeRoles } from '../middleware/role';
import { adminChangePlacementSchema, adminRemoveMemberSchema, getTreeAuditLogsQuerySchema } from '../validators/treeAudit.validators';

router.get('/audit-logs', authenticate, validate({ query: getTreeAuditLogsQuerySchema }), TreeAuditController.getAuditLogs);
router.post('/change-placement', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), validate({ body: adminChangePlacementSchema }), TreeAuditController.changePlacement);
router.post('/remove-member', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), validate({ body: adminRemoveMemberSchema }), TreeAuditController.removeMember);

// Prompt 16 Requirement: "Audit records should not be editable by normal users."
router.put('/audit-logs/:id', authenticate, TreeAuditController.blockAuditMutation);
router.patch('/audit-logs/:id', authenticate, TreeAuditController.blockAuditMutation);
router.delete('/audit-logs/:id', authenticate, TreeAuditController.blockAuditMutation);
router.delete('/audit-logs', authenticate, TreeAuditController.blockAuditMutation);

export const networkTreeRouter = router;

