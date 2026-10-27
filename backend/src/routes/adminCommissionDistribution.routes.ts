import { Router } from 'express';
import { AdminCommissionDistributionController } from '../controllers/adminCommissionDistribution.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';

export const adminCommissionDistributionRouter = Router();

// Strict RBAC: All endpoints require valid JWT authentication and SUPER_ADMIN or ADMIN role.
adminCommissionDistributionRouter.use(authenticate);
adminCommissionDistributionRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// 1. KPI Summary & Float Status
adminCommissionDistributionRouter.get(
  '/summary',
  AdminCommissionDistributionController.getSummary
);

// 2. Eligible Commissions Preview
adminCommissionDistributionRouter.get(
  '/preview',
  AdminCommissionDistributionController.getPreview
);
adminCommissionDistributionRouter.post(
  '/preview',
  AdminCommissionDistributionController.getPreview
);

// 3. Maker Action: Create Batch (DRAFT)
adminCommissionDistributionRouter.post(
  '/batches',
  AdminCommissionDistributionController.createBatch
);

// 4. Batch Management
adminCommissionDistributionRouter.get(
  '/batches',
  AdminCommissionDistributionController.listBatches
);
adminCommissionDistributionRouter.get(
  '/batches/:batchId',
  AdminCommissionDistributionController.getBatchDetails
);

// 5. Checker Actions: Approve or Reject Batch
adminCommissionDistributionRouter.post(
  '/batches/:batchId/approve',
  AdminCommissionDistributionController.approveBatch
);
adminCommissionDistributionRouter.post(
  '/batches/:batchId/reject',
  AdminCommissionDistributionController.rejectBatch
);

// 6. One-Click Disbursal Execution
adminCommissionDistributionRouter.post(
  '/batches/:batchId/initiate-payout',
  AdminCommissionDistributionController.initiatePayout
);

// 7. PNB Reverse MIS Statement Reconciliation
adminCommissionDistributionRouter.post(
  '/batches/:batchId/reconcile-mis',
  AdminCommissionDistributionController.reconcileMis
);

// 8. Quarantine & Remediation
adminCommissionDistributionRouter.get(
  '/batches/:batchId/quarantine',
  AdminCommissionDistributionController.getQuarantine
);
adminCommissionDistributionRouter.post(
  '/batches/:batchId/items/:itemId/remediate',
  AdminCommissionDistributionController.remediateItem
);

// 9. Downloads & File Exports
adminCommissionDistributionRouter.get(
  '/batches/:batchId/export',
  AdminCommissionDistributionController.exportBatchCsv
);
adminCommissionDistributionRouter.get(
  '/batches/:batchId/export-pnb',
  AdminCommissionDistributionController.exportPnbFile
);
