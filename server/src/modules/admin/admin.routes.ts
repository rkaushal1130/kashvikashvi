import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { authenticateToken, requireAdmin, optionalAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { updateTicketSchema, adminReplySchema } from '../../schemas/support.schemas.js';

export const adminRoutes = Router();

// ============================================================================
// Root Admin Overview Endpoint: GET /api/v1/admin
// ============================================================================
// Returns executive catalog of admin endpoints, system status, and live metrics
adminRoutes.get('/', optionalAuth, AdminController.getAdminOverview);

// Protect all remaining operational admin endpoints with JWT authentication and Admin role enforcement
adminRoutes.use(authenticateToken);
adminRoutes.use(requireAdmin);

// System Metrics & Audit (Immutable Compliance Trail)
adminRoutes.get('/metrics', AdminController.getMetrics);
adminRoutes.get('/dashboard', AdminController.getDashboard);
adminRoutes.get('/audit-logs', AdminController.getAuditLogs);
adminRoutes.delete('/audit-logs', AdminController.blockAuditDeletion);
adminRoutes.delete('/audit-logs/:id', AdminController.blockAuditDeletion);

// Financial & Operations
adminRoutes.post('/calculate-commissions', AdminController.triggerWeeklyCommissionCalculation);
adminRoutes.post('/settle-payouts', AdminController.triggerPayoutSettlement);
adminRoutes.patch('/distributors/:id/status', AdminController.updateDistributorStatus);
adminRoutes.patch('/distributors/:memberId/status', AdminController.updateDistributorStatus);

// Prompt 8: Admin Distributor & Network Management Endpoints
adminRoutes.get('/distributors', AdminController.listDistributors);
adminRoutes.get('/distributors/:id', AdminController.getDistributorById);
adminRoutes.patch('/distributors/:id', AdminController.updateDistributor);
adminRoutes.put('/distributors/:id', AdminController.updateDistributor);
adminRoutes.get('/network/:distributorId', AdminController.getDistributorNetwork);
adminRoutes.get('/business-volume', AdminController.getBusinessVolume);
adminRoutes.post('/business-volume/adjust', AdminController.adjustBusinessVolume);
adminRoutes.get('/commissions', AdminController.getCommissions);
adminRoutes.post('/commissions/approve', AdminController.approveCommissions);
adminRoutes.post('/commissions/reverse', AdminController.reverseCommission);

// Prompt 8: System Settings / Commission Rules Endpoints
adminRoutes.get('/settings', AdminController.getSettings);
adminRoutes.put('/settings', AdminController.updateSettings);
adminRoutes.patch('/settings', AdminController.updateSettings);
adminRoutes.get('/settings/commission', AdminController.getSettings);
adminRoutes.put('/settings/commission', AdminController.updateSettings);
adminRoutes.patch('/settings/commission', AdminController.updateSettings);

// MLM Binary Tree Operations & Audit Trail (Prompt 16 & 17)
adminRoutes.post('/tree/move', AdminController.moveDistributor);
adminRoutes.get('/tree/audit-logs', AdminController.getTreeAuditLogs);
adminRoutes.get('/network-tree', AdminController.getNetworkTree);

// ============================================================================
// Admin Support Desk Management: /api/v1/admin/support/tickets
// ============================================================================
// 1. GET /api/v1/admin/support/tickets - View all helpdesk tickets with filtering
adminRoutes.get('/support/tickets', AdminController.getSupportTickets);

// 2. PATCH /api/v1/admin/support/tickets/:id - Update status, priority, or department
adminRoutes.patch(
  '/support/tickets/:id',
  validateRequest({ body: updateTicketSchema }),
  AdminController.updateSupportTicket
);

// 3. POST /api/v1/admin/support/tickets/:id/reply - Post official administrator reply
adminRoutes.post(
  '/support/tickets/:id/reply',
  validateRequest({ body: adminReplySchema }),
  AdminController.replySupportTicket
);

export default adminRoutes;
