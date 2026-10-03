import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { authorizeRoles } from '../middleware/role';

const router = Router();

// Strict RBAC: All administrative endpoints require valid authentication and ADMIN / SUPER_ADMIN role
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN', 'ADMIN'));

// 1. Dashboard: GET /api/v1/admin/dashboard
router.get('/dashboard', AdminController.getDashboard);
router.get('/metrics', AdminController.getDashboard);

// 2. Users: GET /api/v1/admin/users
router.get('/users', AdminController.getUsers);

// 3. Distributors: GET /api/v1/admin/distributors
router.get('/distributors', AdminController.getDistributors);

// 4. Products: GET /api/v1/admin/products
router.get('/products', AdminController.getProducts);

// 5. Categories: GET /api/v1/admin/categories
router.get('/categories', AdminController.getCategories);

// 6. Orders: GET /api/v1/admin/orders
router.get('/orders', AdminController.getOrders);

// 7. Inventory: GET /api/v1/admin/inventory
router.get('/inventory', AdminController.getInventory);

// 8. BV: GET /api/v1/admin/bv
router.get('/bv', AdminController.getBV);

// 9. Commissions: GET /api/v1/admin/commissions (Prompt 23 & Prompt 27)
import { AdminCommissionController } from '../controllers/adminCommission.controller';
router.get('/commissions', AdminCommissionController.getCommissions);
router.post('/orders/:orderId/process-commission', AdminCommissionController.processOrderCommission);
router.post('/commissions/:commissionId/reverse', AdminCommissionController.reverseCommission);
router.get('/commissions/reconcile/order/:orderId', AdminCommissionController.reconcileOrder);
router.post('/commissions/reconcile/order/:orderId', AdminCommissionController.reconcileOrder);
router.get('/commissions/reconcile/member/:memberId', AdminCommissionController.reconcileMember);
router.post('/commissions/reconcile/member/:memberId', AdminCommissionController.reconcileMember);
router.post('/commissions/reconcile/period', AdminCommissionController.reconcilePeriod);

// 10. Commission Rules: GET /api/v1/admin/commission-rules
router.get('/commission-rules', AdminController.getCommissionRules);

// 11. Wallets: GET /api/v1/admin/wallets
router.get('/wallets', AdminController.getWallets);

// 12. Payouts: GET /api/v1/admin/payouts
router.get('/payouts', AdminController.getPayouts);

// 13. Enrollments: GET /api/v1/admin/enrollments
router.get('/enrollments', AdminController.getEnrollments);

// 14. Business Centers: GET /api/v1/admin/business-centers
router.get('/business-centers', AdminController.getBusinessCenters);

// 15. Training: GET /api/v1/admin/training
router.get('/training', AdminController.getTraining);

// 16. News: GET /api/v1/admin/news
router.get('/news', AdminController.getNews);

// 17. Support: GET /api/v1/admin/support
router.get('/support', AdminController.getSupport);

// 18. Notifications: GET /api/v1/admin/notifications
router.get('/notifications', AdminController.getNotifications);

// 19. Settings: GET, PUT /api/v1/admin/settings
router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);

// 20. Audit Logs: GET, DELETE /api/v1/admin/audit-logs
router.get('/audit-logs', AdminController.getAuditLogs);
router.delete('/audit-logs', AdminController.blockAuditDeletion);
router.delete('/audit-logs/:id', AdminController.blockAuditDeletion);

// 21. Global Network Tree Inspection (Prompt 17: Test 15 & 16)
router.get('/network-tree', AdminController.getNetworkTree);

// 22. Tree Audit & Placement Endpoints (Prompt 16)
import { TreeAuditController } from '../controllers/treeAudit.controller';
import { adminChangePlacementSchema, adminRemoveMemberSchema, getTreeAuditLogsQuerySchema } from '../validators/treeAudit.validators';
import { validate } from '../middleware/validate';

router.get('/tree/audit-logs', validate({ query: getTreeAuditLogsQuerySchema }), TreeAuditController.getAuditLogs);
router.post('/tree/change-placement', validate({ body: adminChangePlacementSchema }), TreeAuditController.changePlacement);
router.post('/tree/remove-member', validate({ body: adminRemoveMemberSchema }), TreeAuditController.removeMember);
router.put('/tree/audit-logs/:id', TreeAuditController.blockAuditMutation);
router.patch('/tree/audit-logs/:id', TreeAuditController.blockAuditMutation);
router.delete('/tree/audit-logs/:id', TreeAuditController.blockAuditMutation);
router.delete('/tree/audit-logs', TreeAuditController.blockAuditMutation);

// 23. Member Level & Volume Recalculation Engine (Prompt 7)
import { adminMemberRouter } from './adminMember.routes';
router.use('/members', adminMemberRouter);

export const adminRouter = router;
