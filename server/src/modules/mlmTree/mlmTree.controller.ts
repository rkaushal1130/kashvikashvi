import { Request, Response, NextFunction } from 'express';
import { MlmTreeService } from './mlmTree.service.js';
import { AuthRequest, canAccessDistributorNetwork } from '../../middleware/auth.js';
import { DistributorService } from '../distributor/distributor.service.js';
import { TreeValidationService } from './treeValidation.service.js';
import { BinaryTreeService } from './binaryTree.service.js';

export class MlmTreeController {
  static async getMyNetworkTree(req: any, res: Response): Promise<void> {
    const memberId = req.user?.distributorId || req.user?.memberId || 'KV-1001';
    const rawDepth = parseInt(req.query.depth as string, 10);
    const depth = isNaN(rawDepth) ? 3 : Math.min(Math.max(1, rawDepth), 6);
    const tree = await MlmTreeService.getNetworkTree(memberId, depth);
    res.status(200).json({ success: true, data: tree });
  }

  static async getMemberNetworkTree(req: Request, res: Response): Promise<void> {
    const memberId = req.params.distributorId;
    const rawDepth = parseInt(req.query.depth as string, 10);
    const depth = isNaN(rawDepth) ? 3 : Math.min(Math.max(1, rawDepth), 6);
    const tree = await MlmTreeService.getNetworkTree(memberId, depth);
    res.status(200).json({ success: true, data: tree });
  }

  static async getMemberNetworkSummary(req: Request, res: Response): Promise<void> {
    const memberId = req.params.distributorId;
    const summary = await MlmTreeService.getNetworkSummary(memberId);
    res.status(200).json({ success: true, data: summary });
  }

  static async searchNetworkTree(req: Request, res: Response): Promise<void> {
    const q = ((req.query.q as string) || '').trim();
    const results = await MlmTreeService.searchDistributors(q);
    res.status(200).json({ success: true, data: results });
  }

  static async getTree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.params.memberId || req.user?.memberId;
      if (!memberId) {
        res.status(400).json({ success: false, message: 'Member ID required.' });
        return;
      }
      const rawDepth = parseInt(req.query.depth as string, 10);
      const depth = isNaN(rawDepth) ? 3 : Math.min(Math.max(1, rawDepth), 6);
      const tree = await MlmTreeService.getTreeByDistributor(memberId, depth);
      res.status(200).json({ success: true, data: tree });
    } catch (err) {
      next(err);
    }
  }

  static async getPlacementSuggestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sponsorMemberId = req.user?.memberId || (req.query.sponsorId as string);
      const preferredLeg = (req.query.leg as 'auto' | 'left' | 'right') || 'auto';
      if (!sponsorMemberId) {
        res.status(400).json({ success: false, message: 'Sponsor ID required.' });
        return;
      }
      const suggestion = await MlmTreeService.findNextPlacement(sponsorMemberId, preferredLeg);
      res.status(200).json({ success: true, data: suggestion });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tree/move
   * Admin Move Distributor (Prompt 16)
   * Mandatory requirements: Reason, Old Parent, Old Position, New Parent, New Position, Admin ID, Timestamp
   */
  static async moveDistributor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user && req.user.role && !['admin', 'super_admin'].includes(req.user.role.toLowerCase())) {
        res.status(403).json({ success: false, message: '403 Forbidden: Admin role required to move a distributor.' });
        return;
      }

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
      const upperNewPos = (newPosition || '').trim().toUpperCase();
      if (upperNewPos !== 'LEFT' && upperNewPos !== 'RIGHT') {
        res.status(400).json({ success: false, message: 'New Position must be either LEFT or RIGHT.' });
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
   * POST /api/v1/tree/place
   */
  static async placeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId, sponsorId, placementParentId, position, reason, parentId, distributorId } = req.body;
      const targetMemberId = memberId || distributorId;
      const targetParentId = placementParentId || parentId;
      const targetSponsorId = sponsorId || targetParentId;
      const actorId = req.user?.id || req.user?.memberId || 'system';
      const ip =
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'KashviMLM-Tree-Client';

      const result = await MlmTreeService.placeMember({
        memberId: targetMemberId,
        sponsorId: targetSponsorId,
        placementParentId: targetParentId,
        position,
        actorId,
        reason,
        ip,
        userAgent,
      });

      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Tree placement failed.' });
    }
  }

  /**
   * POST /api/v1/tree/change-position
   */
  static async changePosition(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId, oldPosition, newPosition, reason } = req.body;
      const actorId = req.user?.id || req.user?.memberId || 'system';
      const ip =
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'KashviMLM-Tree-Client';

      const result = await MlmTreeService.changePosition({
        memberId,
        oldPosition,
        newPosition,
        reason,
        actorId,
        ip,
        userAgent,
      });

      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Position change failed.' });
    }
  }

  /**
   * POST /api/v1/tree/remove
   */
  static async removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user && req.user.role && !['admin', 'super_admin'].includes(req.user.role.toLowerCase())) {
        res.status(403).json({ success: false, message: '403 Forbidden: Admin role required to remove a distributor.' });
        return;
      }

      const { memberId, reason } = req.body;
      const actorId = req.user?.id || req.user?.memberId || 'admin';
      const ip =
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'KashviMLM-Tree-Client';

      const result = await MlmTreeService.removeMember({
        memberId,
        reason,
        actorId,
        ip,
        userAgent,
      });

      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Removal failed.' });
    }
  }

  /**
   * POST /api/v1/tree/sponsor
   */
  static async assignSponsor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user && req.user.role && !['admin', 'super_admin'].includes(req.user.role.toLowerCase())) {
        res.status(403).json({ success: false, message: '403 Forbidden: Admin role required to assign sponsor.' });
        return;
      }

      const { memberId, newSponsorId, oldSponsorId, reason } = req.body;
      const actorId = req.user?.id || req.user?.memberId || 'admin';
      const ip =
        req.ip ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'KashviMLM-Tree-Client';

      const result = await MlmTreeService.assignSponsor({
        memberId,
        newSponsorId,
        oldSponsorId,
        reason,
        actorId,
        ip,
        userAgent,
      });

      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Sponsor assignment failed.' });
    }
  }

  /**
   * GET /api/v1/tree/audit-logs
   * GET /api/v1/tree/audit-logs/:memberId
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
   * Helper: Handle error responses consistently.
   */
  private static handleTreeError(err: any, res: Response, next: NextFunction): void {
    if (err.statusCode === 404 || err.message?.includes('not found') || err.message?.includes('Not found')) {
      res.status(404).json({ success: false, message: err.message || 'Distributor not found' });
      return;
    }
    if (err.statusCode === 400 || err.message?.includes('required') || err.message?.includes('Invalid')) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }

  /**
   * GET /api/tree/:distributorId
   * Retrieve complete hierarchical binary tree starting from distributorId with depth limit.
   */
  static async getCompleteTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      // Prompt 6 Section 8 & 17: Network Access Control
      const currentUser = (req as any).user;
      if (currentUser) {
        const allowed = await canAccessDistributorNetwork(currentUser, distributorId);
        if (!allowed) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: You do not have permission to access or view this distributor network.',
          });
          return;
        }
      }

      const rawDepth = parseInt(req.query.depth as string, 10);
      const depth = isNaN(rawDepth) ? 5 : Math.min(Math.max(1, rawDepth), 10);
      const tree = await BinaryTreeService.getTree(distributorId, depth);
      const rootCopy = { ...tree };
      res.status(200).json({
        success: true,
        data: {
          ...tree,
          root: rootCopy,
        },
        message: 'Tree retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/children
   * Retrieve direct LEFT and RIGHT children of a distributor.
   */
  static async getChildren(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const children = await BinaryTreeService.getDirectChildren(distributorId);
      res.status(200).json({
        success: true,
        data: children,
        message: 'Direct children retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/downline
   * Retrieve complete downline list with pagination and depth limit.
   */
  static async getDownline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const rawDepth = req.query.depth ? parseInt(req.query.depth as string, 10) : undefined;

      const downline = await BinaryTreeService.getDownline(distributorId, { page, limit, depth: rawDepth });
      const dist = await BinaryTreeService.resolveDistributor(distributorId);
      (downline as any).root = dist ? { distributorId: dist.memberId, name: dist.fullName, ...dist } : { distributorId, name: distributorId };

      res.status(200).json({
        success: true,
        data: downline,
        message: 'Downline retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/left
   * Retrieve complete LEFT subtree downline.
   */
  static async getLeftTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : undefined;

      const leftTeam = await BinaryTreeService.getLeftDownline(distributorId, { page, limit, depth });
      res.status(200).json({
        success: true,
        data: leftTeam,
        message: 'LEFT team retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/right
   * Retrieve complete RIGHT subtree downline.
   */
  static async getRightTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : undefined;

      const rightTeam = await BinaryTreeService.getRightDownline(distributorId, { page, limit, depth });
      res.status(200).json({
        success: true,
        data: rightTeam,
        message: 'RIGHT team retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/path
   * Retrieve path from root to distributor.
   */
  static async getPath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const pathResult = await BinaryTreeService.getPath(distributorId);
      res.status(200).json({
        success: true,
        data: pathResult,
        message: 'Tree path retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/ancestors
   * Retrieve all ancestors ordered from root to immediate parent.
   */
  static async getAncestors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const ancestors = await BinaryTreeService.getAncestors(distributorId);
      res.status(200).json({
        success: true,
        data: ancestors,
        message: 'Ancestors retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/statistics
   * Retrieve network statistics (directChildren, totalDownline, leftTeam, rightTeam, etc.)
   */
  static async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const stats = await BinaryTreeService.getNetworkStatistics(distributorId);
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Network statistics retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/search
   * Search only within the distributor's downline.
   */
  static async searchDownline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const q = ((req.query.query as string) || (req.query.q as string) || '').trim();
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const searchResult = await BinaryTreeService.searchDownline(distributorId, q, { page, limit });
      res.status(200).json({
        success: true,
        data: searchResult,
        message: 'Downline search completed',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/parent
   * Retrieve tree parent of distributor.
   */
  static async getParent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const parent = await BinaryTreeService.getParent(distributorId);
      res.status(200).json({
        success: true,
        data: parent,
        message: 'Parent retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/sponsor
   * Retrieve sponsor of distributor (separate from tree parent).
   */
  static async getSponsor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const sponsor = await BinaryTreeService.getSponsor(distributorId);
      res.status(200).json({
        success: true,
        data: sponsor,
        message: 'Sponsor retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/level
   * Retrieve calculated distributor tree level.
   */
  static async getLevel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      if (!distributorId) {
        res.status(400).json({ success: false, message: 'Distributor ID required.' });
        return;
      }

      const levelInfo = await BinaryTreeService.getDistributorLevel(distributorId);
      res.status(200).json({
        success: true,
        data: levelInfo,
        message: 'Distributor level retrieved successfully',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/:distributorId/validate
   * Validate tree integrity starting from distributor.
   */
  static async validateTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distributorId = req.params.distributorId;
      const report = await BinaryTreeService.validateTreeIntegrity(distributorId);
      res.status(200).json({
        success: report.valid,
        data: report,
        message: 'Tree validation completed',
      });
    } catch (err: any) {
      MlmTreeController.handleTreeError(err, res, next);
    }
  }

  /**
   * GET /api/tree/validate/integrity
   * Run full audit and tree validation check across all nodes.
   */
  static async validateIntegrity(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await TreeValidationService.validateTreeIntegrity();
      res.status(200).json({
        success: report.isValid,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }
}

