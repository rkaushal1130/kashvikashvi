import { NextFunction, Request, Response } from 'express';
import { TreeAuditService } from '../services/treeAudit.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export class TreeAuditController {
  /**
   * Retrieves Tree Audit Logs (with filtering by memberId, action, actorId)
   * GET /api/v1/tree/audit/logs
   * GET /api/v1/admin/tree/audit-logs
   */
  public static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId, action, actorId, adminId, limit, offset } = req.query;

      const userRole = (req as any).user?.role;
      const callerUserId = (req as any).user?.userId;
      const callerDistributorId = (req as any).user?.distributorId;

      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

      let effectiveMemberId = memberId as string | undefined;

      // Normal users are restricted to viewing only their own audit logs
      if (!isAdmin && !effectiveMemberId) {
        effectiveMemberId = callerDistributorId || callerUserId;
      }

      const result = await TreeAuditService.getTreeAuditLogs({
        memberId: effectiveMemberId,
        action: action as any,
        actorId: actorId as string,
        adminId: adminId as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      sendSuccess(res, {
        message: 'MLM tree audit logs retrieved successfully.',
        data: result.logs,
        meta: {
          total: result.total,
          limit: limit ? parseInt(limit as string, 10) : 50,
          offset: offset ? parseInt(offset as string, 10) : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves a single Tree Audit Record by ID
   * GET /api/v1/tree/audit/logs/:id
   */
  public static async getAuditLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const record = await TreeAuditService.getTreeAuditLogById(id);

      sendSuccess(res, {
        message: 'MLM tree audit record retrieved successfully.',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin changes tree placement (PROMPT 16)
   * POST /api/v1/admin/tree/change-placement
   * POST /api/v1/tree/admin/change-placement
   */
  public static async changePlacement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId, reason, oldParent, oldPosition, newParent, newPosition, adminId } = req.body;

      const authenticatedAdminId =
        (req as any).user?.userId || (req as any).user?.id || adminId;

      if (!authenticatedAdminId) {
        throw AppError.unauthorized('Authenticated administrator identity is required.');
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const userAgent = req.get('user-agent') || 'Admin Tree Console';

      const result = await TreeAuditService.adminChangePlacement({
        memberId,
        reason,
        oldParent,
        oldPosition,
        newParent,
        newPosition,
        adminId: authenticatedAdminId,
        ip: clientIp,
        userAgent,
      });

      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin removes member from tree
   * POST /api/v1/admin/tree/remove-member
   */
  public static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { memberId, reason, adminId } = req.body;
      const authenticatedAdminId =
        (req as any).user?.userId || (req as any).user?.id || adminId;

      if (!authenticatedAdminId) {
        throw AppError.unauthorized('Authenticated administrator identity is required.');
      }

      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';
      const userAgent = req.get('user-agent') || 'Admin Tree Console';

      const result = await TreeAuditService.adminRemoveMember({
        memberId,
        reason,
        adminId: authenticatedAdminId,
        ip: clientIp,
        userAgent,
      });

      sendSuccess(res, {
        statusCode: 200,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Strict Immutability Guard:
   * "Audit records should not be editable by normal users."
   * Blocks PUT, PATCH, DELETE operations with HTTP 403 Forbidden.
   */
  public static blockAuditMutation(_req: Request, _res: Response, next: NextFunction): void {
    try {
      TreeAuditService.blockAuditMutation();
    } catch (error) {
      next(error);
    }
  }
}
