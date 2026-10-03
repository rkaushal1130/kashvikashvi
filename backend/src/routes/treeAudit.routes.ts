import { Router } from 'express';
import { TreeAuditController } from '../controllers/treeAudit.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import {
  adminChangePlacementSchema,
  adminRemoveMemberSchema,
  getTreeAuditLogsQuerySchema,
} from '../validators/treeAudit.validators';

// 1. General Tree Audit Router (/api/v1/tree/audit or /api/v1/network-tree/audit)
const router = Router();

// Authentication required for reading tree audit logs
router.use(authenticate);

// Query audit logs with pagination and filters
router.get(
  '/',
  validate({ query: getTreeAuditLogsQuerySchema }),
  TreeAuditController.getAuditLogs
);

router.get(
  '/logs',
  validate({ query: getTreeAuditLogsQuerySchema }),
  TreeAuditController.getAuditLogs
);

router.get('/logs/:id', TreeAuditController.getAuditLogById);

// Prompt 16 Requirement: "Audit records should not be editable by normal users."
// Immutability: Block PUT, PATCH, DELETE operations on audit records for all users (returns 403)
router.put('/logs/:id', TreeAuditController.blockAuditMutation);
router.patch('/logs/:id', TreeAuditController.blockAuditMutation);
router.delete('/logs/:id', TreeAuditController.blockAuditMutation);
router.delete('/logs', TreeAuditController.blockAuditMutation);

export const treeAuditRouter = router;

// 2. Admin Tree Audit & Placement Router (/api/v1/admin/tree)
const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// Admin audit log query
adminRouter.get(
  '/audit-logs',
  validate({ query: getTreeAuditLogsQuerySchema }),
  TreeAuditController.getAuditLogs
);

// Admin change placement with strict 6 requirements (Reason, Old Parent, Old Pos, New Parent, New Pos, Admin ID)
adminRouter.post(
  '/change-placement',
  validate({ body: adminChangePlacementSchema }),
  TreeAuditController.changePlacement
);

// Admin remove member
adminRouter.post(
  '/remove-member',
  validate({ body: adminRemoveMemberSchema }),
  TreeAuditController.removeMember
);

// Admin immutability protection: even admin cannot delete or mutate audit trail
adminRouter.put('/audit-logs/:id', TreeAuditController.blockAuditMutation);
adminRouter.patch('/audit-logs/:id', TreeAuditController.blockAuditMutation);
adminRouter.delete('/audit-logs/:id', TreeAuditController.blockAuditMutation);
adminRouter.delete('/audit-logs', TreeAuditController.blockAuditMutation);

export const adminTreeAuditRouter = adminRouter;
