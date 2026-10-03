import { Response, NextFunction } from 'express';
import { AdminService } from './admin.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { CommissionEngineService } from '../commissionEngine/commissionEngine.service.js';
import { PayoutService } from '../payouts/payout.service.js';
import { SupportService } from '../support/support.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { MlmTreeService } from '../mlmTree/mlmTree.service.js';
import { BinaryTreeService } from '../mlmTree/binaryTree.service.js';
import { DistributorService } from '../distributor/distributor.service.js';
import { BusinessVolumeService } from '../bvEngine/businessVolume.service.js';
import { CommissionService } from '../commissionEngine/commission.service.js';
import { CommissionConfigService } from '../commissionEngine/commissionConfig.service.js';
import { AuthService } from '../auth/auth.service.js';
import { BinaryTreePlacementService } from '../mlmTree/binaryTreePlacement.service.js';

export class AdminController {
  static async getAdminOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await AdminService.getSystemMetrics();
      const isAdmin = req.user?.role === 'admin';

      res.status(200).json({
        success: true,
        name: 'KashviMLM Executive Admin Panel API',
        version: '1.0.0',
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        authenticatedUser: req.user
          ? {
              id: req.user.id,
              username: req.user.username,
              email: req.user.email,
              role: req.user.role,
              isAdmin,
            }
          : null,
        systemMetrics: metrics,
        endpoints: {
          metrics: {
            method: 'GET',
            path: '/api/v1/admin/metrics',
            description: 'System overview: total members, sales turnover, total commissions distributed, BV turnover, active commission cycle',
            access: 'Admin Role Required',
          },
          auditLogs: {
            method: 'GET',
            path: '/api/v1/admin/audit-logs',
            description: 'Security, financial, and catalog change audit trail with actor IDs and metadata',
            access: 'Admin Role Required',
            query: { limit: 'number (default: 50)' },
          },
          calculateCommissions: {
            method: 'POST',
            path: '/api/v1/admin/calculate-commissions',
            description: 'Trigger weekly commission calculation cycle (binary match, direct referral, rank bonuses)',
            access: 'Admin Role Required',
            body: { cycleWeek: 'number', cycleYear: 'number' },
          },
          settlePayouts: {
            method: 'POST',
            path: '/api/v1/admin/settle-payouts',
            description: 'Approve and disburse queued weekly bank payout batch',
            access: 'Admin Role Required',
            body: { batchCode: 'string (e.g., BATCH-2026-W38)' },
          },
          memberStatus: {
            method: 'PATCH',
            path: '/api/v1/admin/distributors/:memberId/status',
            description: 'Update member qualification/account status (Active, Inactive, Grace Period)',
            access: 'Admin Role Required',
            body: { status: 'Active | Inactive | Grace Period' },
          },
          supportTickets: {
            list: {
              method: 'GET',
              path: '/api/v1/admin/support/tickets',
              description: 'View and filter all distributor support tickets',
              access: 'Admin Role Required',
              query: { status: 'string', department: 'string', distributorId: 'string', userId: 'string' },
            },
            update: {
              method: 'PATCH',
              path: '/api/v1/admin/support/tickets/:id',
              description: 'Update ticket status, priority, department, or add admin response',
              access: 'Admin Role Required',
              body: { status: 'string', priority: 'string', department: 'string', adminResponse: 'string' },
            },
            reply: {
              method: 'POST',
              path: '/api/v1/admin/support/tickets/:id/reply',
              description: 'Post official administrator reply in ticket thread and update status',
              access: 'Admin Role Required',
              body: { message: 'string (required)', status: 'string (optional)' },
            },
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMetrics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await AdminService.getSystemMetrics();
      res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, entityType, entityId, actorId } = req.query;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await AdminService.getAuditLogs({
        action: action as string,
        entityType: entityType as string,
        entityId: entityId as string,
        actorId: actorId as string,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        total: result.total,
        count: result.logs.length,
        offset,
        limit,
        data: result.logs,
      });
    } catch (err) {
      next(err);
    }
  }

  static async blockAuditDeletion(_req: AuthRequest, res: Response): Promise<void> {
    res.status(403).json({
      success: false,
      message: 'Audit logs are immutable compliance records. Deletion or tampering is strictly prohibited.',
    });
  }

  static async triggerWeeklyCommissionCalculation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cycleWeek = parseInt(req.body.cycleWeek) || 38;
      const cycleYear = parseInt(req.body.cycleYear) || 2026;
      const results = await CommissionEngineService.runWeeklyCalculation(cycleWeek, cycleYear);

      // Immutable Audit Log: COMMISSION_CREATED
      await AuditService.recordFromRequest(
        req,
        AuditAction.COMMISSION_CREATED,
        'CommissionEngine',
        `CYCLE-${cycleYear}-W${cycleWeek}`,
        null,
        { cycleWeek, cycleYear, recordsCalculated: results.length }
      );

      res.status(200).json({
        success: true,
        message: `Commission calculation cycle Week ${cycleWeek} - ${cycleYear} completed successfully.`,
        data: results
      });
    } catch (err) {
      next(err);
    }
  }

  static async triggerPayoutSettlement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchCode } = req.body;
      if (!batchCode) {
        res.status(400).json({ success: false, message: 'batchCode is required.' });
        return;
      }

      const result = await PayoutService.settlePayoutBatch(batchCode);

      // Immutable Audit Log: PAYOUT_APPROVED
      await AuditService.recordFromRequest(
        req,
        AuditAction.PAYOUT_APPROVED,
        'PayoutBatch',
        batchCode,
        { status: 'Queued' },
        result
      );

      res.status(200).json({
        success: true,
        message: `Payout batch ${batchCode} settled successfully.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateMemberStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId } = req.params;
      const { status } = req.body;

      if (!status || !['Active', 'Inactive', 'Grace Period'].includes(status)) {
        res.status(400).json({ success: false, message: 'Valid status is required (Active, Inactive, Grace Period).' });
        return;
      }

      const result = await AdminService.toggleMemberStatus(memberId, status);

      // Immutable Audit Log: USER_UPDATED
      await AuditService.recordFromRequest(
        req,
        AuditAction.USER_UPDATED,
        'Distributor',
        memberId,
        null,
        { status }
      );

      res.status(200).json({ success: true, message: `Distributor ${memberId} status set to ${status}.`, data: result });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/admin/support/tickets
  static async getSupportTickets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, department, distributorId, userId } = req.query as Record<string, string>;
      const tickets = await SupportService.getTickets({
        status,
        department,
        distributorId,
        userId,
      });

      res.status(200).json({
        success: true,
        count: tickets.length,
        data: tickets,
      });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/v1/admin/support/tickets/:id
  static async updateSupportTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const { status, priority, department, adminResponse } = req.body;

      if (!status && !priority && !department && !adminResponse) {
        res.status(400).json({ success: false, message: 'At least one field to update is required.' });
        return;
      }

      const updated = await SupportService.updateTicket(id, {
        status,
        priority,
        department,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (adminResponse) {
        await SupportService.addMessage(id, {
          senderId: req.user?.id || 'admin',
          message: adminResponse,
        });
      }

      // Immutable Audit Log: ADMIN_ACTION
      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'SupportTicket',
        id,
        null,
        { status, priority, department, hasAdminResponse: !!adminResponse }
      );

      const refreshed = await SupportService.getTicketById(id);
      res.status(200).json({
        success: true,
        message: 'Support ticket updated successfully by admin.',
        data: refreshed || updated,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/admin/support/tickets/:id/reply
  static async replySupportTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const { message, status } = req.body;
      const senderId = req.body.senderId || req.user?.id || 'Admin Support';

      if (!message || !message.trim()) {
        res.status(400).json({ success: false, message: 'Reply message is required.' });
        return;
      }

      const newMsg = await SupportService.addMessage(id, {
        senderId,
        message,
      });

      if (!newMsg) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (status) {
        await SupportService.updateTicket(id, { status });
      }

      // Immutable Audit Log: ADMIN_ACTION
      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'SupportTicket',
        id,
        null,
        { replySender: senderId, newStatus: status || 'unchanged' }
      );

      const refreshedTicket = await SupportService.getTicketById(id);

      res.status(200).json({
        success: true,
        message: 'Admin reply posted successfully.',
        data: {
          reply: newMsg,
          ticket: refreshedTicket,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/tree/move
   * Admin Move Distributor (Prompt 16)
   * Require: Reason, Old Parent, Old Position, New Parent, New Position, Admin ID, Timestamp
   * Create an immutable audit record.
   */
  static async moveDistributor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.body.memberId;
      const { oldParent, oldPosition, newParent, newPosition, reason, timestamp } = req.body;
      const adminId = req.user?.id || req.user?.memberId || req.body.adminId;

      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: 'Reason is required to move a distributor.' });
        return;
      }
      if (!oldParent || !oldParent.trim()) {
        res.status(400).json({ success: false, message: 'Old Parent is required to move a distributor.' });
        return;
      }
      if (!oldPosition || !oldPosition.trim()) {
        res.status(400).json({ success: false, message: 'Old Position is required to move a distributor.' });
        return;
      }
      if (!newParent || !newParent.trim()) {
        res.status(400).json({ success: false, message: 'New Parent is required to move a distributor.' });
        return;
      }
      if (!newPosition || !newPosition.trim()) {
        res.status(400).json({ success: false, message: 'New Position is required to move a distributor.' });
        return;
      }
      if (!adminId || !adminId.trim()) {
        res.status(400).json({ success: false, message: 'Admin ID is required to move a distributor.' });
        return;
      }
      if (!memberId || !memberId.trim()) {
        res.status(400).json({ success: false, message: 'Member ID is required to move a distributor.' });
        return;
      }

      const ip =
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'KashviMLM-Admin-Console';

      const result = await MlmTreeService.moveDistributor({
        adminId: adminId.trim(),
        memberId: memberId.trim(),
        oldParent: oldParent.trim(),
        oldPosition: oldPosition.trim(),
        newParent: newParent.trim(),
        newPosition: newPosition.trim(),
        reason: reason.trim(),
        timestamp: timestamp || new Date().toISOString(),
        ip,
        userAgent,
      });

      res.status(200).json(result);
    } catch (err: any) {
      if (
        err.message &&
        (err.message.includes('required') ||
          err.message.includes('Circular') ||
          err.message.includes('cannot be placed') ||
          err.message.includes('occupied') ||
          err.message.includes('violation'))
      ) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/tree/audit-logs
   */
  static async getTreeAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = (req.params.memberId || req.query.memberId) as string;
      const event = (req.query.event || req.query.action) as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await MlmTreeService.getTreeAuditLogs({
        memberId,
        event,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        total: result.total,
        count: result.logs.length,
        offset,
        limit,
        data: result.logs,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/network-tree
   * Allows admin to inspect any network tree across the company without downline restrictions (Prompt 17: Test 15).
   */
  static async getNetworkTree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rootId = (req.query.memberId || req.query.rootId || 'KV-1001') as string;
      const depth = parseInt(req.query.depth as string, 10) || 3;
      const tree = await MlmTreeService.getNetworkTree(rootId, depth);
      res.status(200).json({
        success: true,
        message: 'Admin global network tree retrieved successfully.',
        data: tree,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/dashboard & GET /api/admin/metrics
   */
  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await AdminService.getSystemMetrics();
      res.status(200).json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/distributors
   * Searchable, filterable, paginated distributor table (PROMPT 8 Sections 5, 6, 7, 8)
   */
  static async listDistributors(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 25);
      const search = (req.query.search as string || req.query.q as string || '').toLowerCase().trim();
      const status = (req.query.status as string || '').toUpperCase().trim();
      const position = (req.query.position as string || '').toUpperCase().trim();
      const rank = (req.query.rank as string || '').toLowerCase().trim();

      // Retrieve full catalog of distributors
      const rawList = await DistributorService.getAll(500, 0);

      let filtered = rawList.map((d: any) => ({
        id: d.id,
        distributorId: d.member_id || d.distributorId,
        memberId: d.member_id || d.distributorId,
        name: d.full_name || d.name,
        fullName: d.full_name || d.name,
        email: d.email,
        phone: d.phone,
        sponsorId: d.sponsor_id || d.sponsorId || 'KV-1000',
        sponsorName: d.sponsor_name || (d.sponsor_id === 'KV-1001' ? 'Rahul Kaushal' : 'Corporate System'),
        parentId: d.parent_id || d.parentId || null,
        parentName: d.parent_name || 'Direct',
        position: (d.leg_position || d.position || 'ROOT').toUpperCase(),
        level: d.depth ?? d.level ?? 0,
        depth: d.depth ?? d.level ?? 0,
        rank: d.rank || 'Associate',
        status: (d.qualification_status || d.status || 'ACTIVE').toUpperCase(),
        personalBv: Number(d.current_psv || d.personalBv || 100),
        teamSize: Number(d.team_size || 0),
        city: d.city || 'Delhi',
        state: d.state || 'Delhi',
        joinedAt: d.joined_at || d.joinedAt || '2026-01-15T00:00:00.000Z',
      }));

      // Search by ID, Name, Email, Phone
      if (search) {
        filtered = filtered.filter(
          (d) =>
            d.distributorId.toLowerCase().includes(search) ||
            d.name.toLowerCase().includes(search) ||
            d.email.toLowerCase().includes(search) ||
            d.phone.toLowerCase().includes(search)
        );
      }

      // Filter by Status: ACTIVE, INACTIVE, SUSPENDED
      if (status && status !== 'ALL') {
        filtered = filtered.filter((d) => d.status === status);
      }

      // Filter by Position: LEFT, RIGHT
      if (position && position !== 'ALL') {
        filtered = filtered.filter((d) => d.position === position);
      }

      // Filter by Rank
      if (rank && rank !== 'ALL') {
        filtered = filtered.filter((d) => d.rank.toLowerCase().includes(rank));
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;
      const data = filtered.slice(offset, offset + limit);

      res.status(200).json({
        success: true,
        count: data.length,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/distributors/:id
   * Distributor Details (PROMPT 8 Section 9)
   */
  static async getDistributorById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const distributor = await DistributorService.getDistributorById(id);
      if (!distributor) {
        res.status(404).json({ success: false, message: `Distributor ${id} not found.` });
        return;
      }

      const cleanId = distributor.distributorId || (distributor as any).member_id || id;
      const children = await DistributorService.getChildren(cleanId);
      const volume = await BusinessVolumeService.getBusinessVolumeSummary(cleanId);
      const commissions = await CommissionService.getCommissionHistory(cleanId);

      res.status(200).json({
        success: true,
        data: {
          ...distributor,
          children,
          businessVolume: {
            personalBV: volume.personalBV,
            leftTeamBV: volume.leftTeamBV,
            rightTeamBV: volume.rightTeamBV,
            totalTeamBV: volume.totalTeamBV,
            totalNetworkBV: volume.totalNetworkBV,
          },
          networkStats: {
            totalTeam: distributor.teamSize || 0,
            leftTeam: children.left ? 1 : 0,
            rightTeam: children.right ? 1 : 0,
          },
          commissions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/distributors/:id/status
   */
  static async updateDistributorStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.memberId;
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ success: false, message: 'Status is required.' });
        return;
      }
      const normStatus = status.toUpperCase();
      const updated = await AuthService.updateStatus(id, normStatus);

      // Also synchronize in-memory member if present
      const mem = BinaryTreePlacementService.getMember(id);
      if (mem) {
        mem.status = normStatus as any;
      }

      await AuditService.recordFromRequest(
        req,
        AuditAction.USER_UPDATED,
        'Distributor',
        id,
        null,
        { actionDetail: 'STATUS_CHANGE', newStatus: normStatus }
      );

      res.status(200).json({
        success: true,
        message: `Distributor ${id} status updated to ${normStatus}.`,
        data: {
          id,
          memberId: id,
          status: normStatus,
          qualification_status: normStatus,
          updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/admin/distributors/:id & PUT /api/admin/distributors/:id
   */
  static async updateDistributor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.memberId;
      const updated = await DistributorService.updateProfile(id, req.body);

      // If status changed in body, sync it as well
      if (req.body.status) {
        const normStatus = req.body.status.toUpperCase();
        await AuthService.updateStatus(id, normStatus);
        const mem = BinaryTreePlacementService.getMember(id);
        if (mem) {
          mem.status = normStatus as any;
        }
      }

      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'Distributor',
        id,
        null,
        { actionDetail: 'ADMIN_MODIFICATION', updates: req.body }
      );

      res.status(200).json({
        success: true,
        message: `Distributor ${id} updated successfully.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/network/:distributorId
   */
  static async getDistributorNetwork(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId || 'KV-1001';
      const rawDepth = parseInt(req.query.depth as string, 10);
      const depth = isNaN(rawDepth) ? 5 : Math.min(Math.max(1, rawDepth), 10);
      const tree = await BinaryTreeService.getTree(distributorId, depth);
      res.status(200).json({
        success: true,
        message: 'Admin network tree retrieved successfully.',
        data: tree,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/admin/business-volume
   * System-wide BV transactions and summaries (PROMPT 8 Section 11)
   */
  static async getBusinessVolume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = (req.query.distributorId as string) || '';
      const type = (req.query.type as string) || '';
      const status = (req.query.status as string) || '';

      const rootSummary = await BusinessVolumeService.getBusinessVolumeSummary('KV-1001');
      const transactions = await BusinessVolumeService.getAllTransactions({
        distributorId,
        type,
        status,
      });

      res.status(200).json({
        success: true,
        data: {
          totalNetworkBV: rootSummary.totalNetworkBV,
          totalTeamBV: rootSummary.totalTeamBV,
          rootSummary,
          transactions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/business-volume/adjust
   * Admin BV Adjustment Capability with Reason & Audit Log (PROMPT 8 Section 11)
   */
  static async adjustBusinessVolume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId, type, reason, orderId, leg } = req.body;
      const rawBv = req.body.businessVolume !== undefined && req.body.businessVolume !== null
        ? req.body.businessVolume
        : req.body.amount;

      if (!distributorId || !distributorId.trim()) {
        res.status(400).json({ success: false, message: 'Distributor ID is required.' });
        return;
      }
      if (rawBv === undefined || rawBv === null || isNaN(Number(rawBv))) {
        res.status(400).json({ success: false, message: 'Valid business volume amount is required.' });
        return;
      }
      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: 'Reason for adjustment is mandatory.' });
        return;
      }

      const cleanDistId = distributorId.trim().toUpperCase();
      const bvVal = parseFloat(rawBv);
      const adjType = type || (bvVal < 0 ? 'MANUAL_DEBIT' : 'MANUAL_CREDIT');
      const cleanOrderId = orderId || `ADJ-${Date.now()}`;

      const tx = await BusinessVolumeService.recordBusinessVolume({
        distributorId: cleanDistId,
        orderId: cleanOrderId,
        amount: parseFloat(req.body.amount || rawBv || 0),
        businessVolume: Math.abs(bvVal),
        type: adjType,
        status: 'APPROVED',
        description: `Admin Adjustment: ${reason.trim()}`,
      });

      // Immutable Audit Log: ADMIN_ACTION / BV_ADJUSTMENT
      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'BusinessVolume',
        cleanDistId,
        null,
        {
          action: 'BV_ADJUSTMENT',
          distributorId: cleanDistId,
          businessVolume: bvVal,
          reason: reason.trim(),
          orderId: cleanOrderId,
          actor: req.user?.id || req.user?.email || 'Admin',
        }
      );

      res.status(200).json({
        success: true,
        message: `Business volume adjustment of ${bvVal} BV recorded for ${cleanDistId}.`,
        data: tx,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('required')) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }

  /**
   * GET /api/admin/commissions
   * System-wide Commission ledger (PROMPT 8 Section 12)
   */
  static async getCommissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = (req.query.distributorId as string) || '';
      const status = (req.query.status as string) || '';
      const type = (req.query.type as string) || '';

      const list = await CommissionService.getAllCommissions({
        distributorId,
        status,
        type,
      });

      let totalGross = 0;
      let totalPaid = 0;
      let totalApproved = 0;
      let totalPending = 0;

      for (const item of list) {
        totalGross += item.grossCommission || 0;
        if (item.status === 'PAID') totalPaid += item.netPayout || 0;
        else if (item.status === 'APPROVED') totalApproved += item.netPayout || 0;
        else if (item.status === 'CALCULATED') totalPending += item.netPayout || 0;
      }

      res.status(200).json({
        success: true,
        count: list.length,
        data: list,
        summary: {
          totalCommission: totalGross,
          paid: totalPaid,
          approved: totalApproved,
          pending: totalPending,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/commissions/approve
   * Approve calculated commissions (PROMPT 8 Section 12)
   */
  static async approveCommissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ledgerId, ids, status } = req.body;
      let targetIds: string[] = ids || (ledgerId ? [ledgerId] : []);
      if (status === 'ALL_PENDING' || status === 'ALL' || (!ledgerId && !ids)) {
        targetIds = ['ALL_PENDING'];
      }

      const approvedCount = await CommissionService.approveCommissions(targetIds);

      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'CommissionLedger',
        targetIds.join(','),
        { status: 'CALCULATED' },
        { status: 'APPROVED', count: approvedCount }
      );

      res.status(200).json({
        success: true,
        message: `Successfully approved ${approvedCount} commission records.`,
        data: { approvedCount, targetIds },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/commissions/reverse
   * Reverse commission with reason & audit record (PROMPT 8 Section 12)
   */
  static async reverseCommission(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ledgerId = req.body.ledgerId || req.body.commissionId || req.body.id;
      const reason = req.body.reason;

      if (!ledgerId || !String(ledgerId).trim()) {
        res.status(400).json({ success: false, message: 'ledgerId or commissionId is required.' });
        return;
      }
      if (!reason || !String(reason).trim()) {
        res.status(400).json({ success: false, message: 'Reason for reversal is required.' });
        return;
      }

      const result = await CommissionService.reverseCommission(
        String(ledgerId).trim(),
        String(reason).trim(),
        req.user?.role
      );

      await AuditService.recordFromRequest(
        req,
        AuditAction.COMMISSION_REVERSED,
        'CommissionLedger',
        String(ledgerId).trim(),
        null,
        { reason: String(reason).trim(), result }
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        res.status(404).json({ success: false, message: err.message });
        return;
      }
      if (err.message && err.message.includes('already been reversed')) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }

  /**
   * GET /api/admin/settings
   * Retrieve active commission rules & system settings (PROMPT 8 Section 14)
   */
  static async getSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = CommissionConfigService.getConfig();
      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/admin/settings & PATCH /api/admin/settings
   * Update commission rules with immutable audit log (PROMPT 8 Section 14)
   */
  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const oldConfig = CommissionConfigService.getConfig();
      const updated = CommissionConfigService.updateConfig(req.body, req.user?.role);

      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'CommissionConfig',
        'SYSTEM_RULES',
        oldConfig,
        updated
      );

      res.status(200).json({
        success: true,
        message: 'Commission settings updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      if (err.statusCode === 403) {
        res.status(403).json({ success: false, message: err.message });
        return;
      }
      if (err.message && (err.message.includes('must be') || err.message.includes('negative'))) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next(err);
    }
  }
}
