import { Router } from 'express';
import { AdminFundingCommissionController } from '../controllers/adminFundingCommission.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';

export const adminFundingCommissionRouter = Router();

// Strict RBAC: All endpoints require valid JWT authentication and SUPER_ADMIN or ADMIN role.
// Any distributor, employee, customer, or unauthenticated request is blocked (HTTP 401/403).
adminFundingCommissionRouter.use(authenticate);
adminFundingCommissionRouter.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// 1. Daily Financial Summary Dashboard Cards
adminFundingCommissionRouter.get('/summary', AdminFundingCommissionController.getSummary);

// 2. Employee-Wise Daily Commission Report (23 columns, filtering, sorting, pagination)
adminFundingCommissionRouter.get('/daily-report', AdminFundingCommissionController.getDailyReport);

// 3. Export Daily Commission Report as CSV
adminFundingCommissionRouter.get('/daily-report/export', AdminFundingCommissionController.exportCsv);

// 4. One-Click Distribution Preview
adminFundingCommissionRouter.post('/distribute-preview', AdminFundingCommissionController.getDistributePreview);

// 5. Execute One-Click Commission Distribution
adminFundingCommissionRouter.post('/distribute', AdminFundingCommissionController.executeDistribution);

// 6. List All Payout Batches
adminFundingCommissionRouter.get('/batches', AdminFundingCommissionController.listBatches);

// 7. Payout Batch Details with Employee Breakdown
adminFundingCommissionRouter.get('/batches/:batchId', AdminFundingCommissionController.getBatchDetails);

// 8. Retry Failed Payouts for a Specific Batch
adminFundingCommissionRouter.post('/batches/:batchId/retry', AdminFundingCommissionController.retryFailed);

// 9. Commission Queue Management & Dead-Letter Queue (DLQ)
adminFundingCommissionRouter.get('/queue/stats', AdminFundingCommissionController.getQueueStats);
adminFundingCommissionRouter.get('/queue/failed', AdminFundingCommissionController.getQueueFailedJobs);
adminFundingCommissionRouter.post('/queue/retry-failed', AdminFundingCommissionController.retryQueueFailed);
adminFundingCommissionRouter.post('/queue/enqueue-test', AdminFundingCommissionController.enqueueTestJob);
