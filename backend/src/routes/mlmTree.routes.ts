import { Router } from 'express';
import { MlmTreeController } from '../controllers/mlmTree.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';
import { validate } from '../middleware/validate';
import { getTreeQuerySchema, nextSlotQuerySchema, placeDistributorSchema } from '../validators/mlmTree.validators';

const router = Router();

// Place a distributor in the binary tree (Authentication required to prevent unauthorized modification)
router.post('/place', authenticate, validate({ body: placeDistributorSchema }), MlmTreeController.place);

// Retrieve visual binary tree by Node ID or Business Center ID
router.get('/binary/:rootId', validate({ query: getTreeQuerySchema }), MlmTreeController.getBinaryTree);

// Retrieve unilevel sponsor genealogy tree
router.get('/sponsor/:distributorId', validate({ query: getTreeQuerySchema }), MlmTreeController.getSponsorTree);

// Recommend next available placement slot
router.get('/next-slot/:nodeId', validate({ query: nextSlotQuerySchema }), MlmTreeController.getNextAvailableSlot);

// Seed exact requested model tree: A -> LEFT (B -> C) & RIGHT (D -> E) (Admin only)
router.post('/seed-model', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), MlmTreeController.seedModelTree);

// MLM Tree Audit Logging & Administrative Placement (Prompt 16)
import { TreeAuditController } from '../controllers/treeAudit.controller';
import { adminChangePlacementSchema, adminRemoveMemberSchema, getTreeAuditLogsQuerySchema } from '../validators/treeAudit.validators';

router.get('/audit-logs', authenticate, validate({ query: getTreeAuditLogsQuerySchema }), TreeAuditController.getAuditLogs);
router.post('/change-placement', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), validate({ body: adminChangePlacementSchema }), TreeAuditController.changePlacement);
router.post('/remove-member', authenticate, authorizeRoles('SUPER_ADMIN', 'ADMIN'), validate({ body: adminRemoveMemberSchema }), TreeAuditController.removeMember);

// Prompt 16 Requirement: "Audit records should not be editable by normal users."
router.put('/audit-logs/:id', authenticate, TreeAuditController.blockAuditMutation);
router.patch('/audit-logs/:id', authenticate, TreeAuditController.blockAuditMutation);
router.delete('/audit-logs/:id', authenticate, TreeAuditController.blockAuditMutation);
router.delete('/audit-logs', authenticate, TreeAuditController.blockAuditMutation);

export const mlmTreeRouter = router;

