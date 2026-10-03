import { NextFunction, Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { NetworkTreeService } from '../services/networkTree.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export class NetworkTreeController {
  /**
   * Retrieves authenticated distributor's binary network tree.
   * GET /api/v1/network-tree?depth=3
   */
  public static async getMyTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 3;
      const targetId = req.user?.id || 'KV-1001';

      const tree = await NetworkTreeService.getNetworkTree(targetId, depth);

      // Audit Log
      await AuditService.recordLog({
        userId: req.user?.id,
        action: 'TREE_VIEW_SELF',
        entityType: 'NetworkTree',
        entityId: targetId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        data: tree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves binary network tree for a specific member by ID or code.
   * GET /api/v1/network-tree/member/:distributorId?depth=3
   *
   * Security & Business Rules (Prompt 15):
   * 1. Authentication required.
   * 2. User can view their own network.
   * 3. User can only view other networks if permitted by business rules (must be in their downline organization).
   * 4. Admin can view all networks.
   * Expected: 401 for unauthenticated, 403 for authenticated but unauthorized.
   */
  public static async getMemberTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId } = req.params;
      const depth = req.query.depth ? parseInt(req.query.depth as string, 10) : 3;
      const requestingUser = req.user!;

      // 4. Admin can view all networks
      const isAdmin = requestingUser.role === 'ADMIN' || requestingUser.role === 'SUPER_ADMIN';

      if (!isAdmin) {
        // 2. User can view their own network
        const isSelf = await NetworkTreeService.isSelf(requestingUser.id, distributorId);

        // 3. User can only view other networks if in downline organization
        if (!isSelf) {
          const isDownline = await NetworkTreeService.isDownline(requestingUser.id, distributorId);
          if (!isDownline) {
            // Audit log unauthorized access attempt
            await AuditService.recordLog({
              userId: requestingUser.id,
              action: 'UNAUTHORIZED_TREE_VIEW_ATTEMPT',
              entityType: 'NetworkTree',
              entityId: distributorId,
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              newValue: {
                requesterId: requestingUser.id,
                targetDistributorId: distributorId,
                reason: 'Target distributor is outside requesting user downline organization',
              },
            });

            throw AppError.forbidden(
              'You are not authorized to view networks outside of your downline organisation',
              'FORBIDDEN_NETWORK_VIEW'
            );
          }
        }
      }

      const tree = await NetworkTreeService.getNetworkTree(distributorId, depth);

      // Audit Log authorized tree view
      await AuditService.recordLog({
        userId: requestingUser.id,
        action: 'TREE_VIEW_MEMBER',
        entityType: 'NetworkTree',
        entityId: distributorId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        data: tree,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves network summary statistics for a specific member.
   * GET /api/v1/network-tree/member/:distributorId/summary
   *
   * Security & Business Rules (Prompt 15):
   * Enforces downline authorization check matching getMemberTree.
   */
  public static async getMemberSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId } = req.params;
      const requestingUser = req.user!;

      const isAdmin = requestingUser.role === 'ADMIN' || requestingUser.role === 'SUPER_ADMIN';

      if (!isAdmin) {
        const isSelf = await NetworkTreeService.isSelf(requestingUser.id, distributorId);
        if (!isSelf) {
          const isDownline = await NetworkTreeService.isDownline(requestingUser.id, distributorId);
          if (!isDownline) {
            await AuditService.recordLog({
              userId: requestingUser.id,
              action: 'UNAUTHORIZED_TREE_SUMMARY_ATTEMPT',
              entityType: 'NetworkTree',
              entityId: distributorId,
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              newValue: {
                requesterId: requestingUser.id,
                targetDistributorId: distributorId,
                reason: 'Target distributor is outside requesting user downline organization',
              },
            });

            throw AppError.forbidden(
              'You are not authorized to view networks outside of your downline organisation',
              'FORBIDDEN_NETWORK_VIEW'
            );
          }
        }
      }

      const summary = await NetworkTreeService.getNetworkSummary(distributorId);

      await AuditService.recordLog({
        userId: requestingUser.id,
        action: 'TREE_SUMMARY_VIEW',
        entityType: 'NetworkTree',
        entityId: distributorId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves network summary statistics for authenticated distributor.
   * GET /api/v1/network-tree/summary
   */
  public static async getMySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetId = req.user?.id || 'KV-1001';

      const summary = await NetworkTreeService.getNetworkSummary(targetId);

      await AuditService.recordLog({
        userId: req.user?.id,
        action: 'TREE_SUMMARY_SELF',
        entityType: 'NetworkTree',
        entityId: targetId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Searches authorized distributors by name or distributor ID.
   * GET /api/v1/network-tree/search?q=Rahul
   */
  public static async searchDistributors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = ((req.query.q as string) || '').trim();
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      const results = await NetworkTreeService.searchDistributors(q, req.user?.id, isAdmin);

      await AuditService.recordLog({
        userId: req.user?.id,
        action: 'TREE_SEARCH',
        entityType: 'NetworkTree',
        newValue: { query: q, resultCount: results.length },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendSuccess(res, {
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

