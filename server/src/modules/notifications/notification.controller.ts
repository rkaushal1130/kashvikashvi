import { Response, NextFunction } from 'express';
import { NotificationService, NotificationType } from './notification.service.js';
import { AuthRequest } from '../../middleware/auth.js';

export class NotificationController {
  // GET /api/v1/notifications
  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, isRead, limit, distributorId } = req.query as Record<string, string>;
      const memberId = req.user?.memberId || distributorId;
      const userId = req.user?.id;

      const filter = {
        memberId,
        userId,
        type: type ? (type.toUpperCase() as NotificationType) : undefined,
        isRead: isRead !== undefined ? isRead === 'true' || isRead === '1' : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      };

      const result = await NotificationService.getNotifications(filter);

      res.status(200).json({
        success: true,
        unreadCount: result.unreadCount,
        count: result.notifications.length,
        data: result.notifications,
        notifications: result.notifications,
      });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/v1/notifications/:id/read
  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await NotificationService.markAsRead(id);

      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Notification not found.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/notifications/read-all
  static async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.user?.memberId;
      const userId = req.user?.id;

      const result = await NotificationService.markAllAsRead({ memberId, userId });

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
        unreadCount: 0,
        updatedCount: result.updatedCount,
      });
    } catch (err) {
      next(err);
    }
  }
}
