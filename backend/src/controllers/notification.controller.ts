import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import {
  BroadcastNotificationInput,
  NotificationQueryInput,
} from '../validators/notification.validators';

export class NotificationController {
  public static async getMyNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || 'usr-anonymous';
      const query = (req.query as unknown) as NotificationQueryInput;

      const result = await NotificationService.getUserNotifications(userId, query);

      res.status(200).json({
        success: true,
        data: result.data,
        unreadCount: result.unreadCount,
        pagination: {
          total: result.total,
          page: Number(query.page || 1),
          limit: Number(query.limit || 20),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'usr-anonymous';

      const notification = await NotificationService.markAsRead(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || 'usr-anonymous';

      const result = await NotificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async broadcast(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as BroadcastNotificationInput;

      const result = await NotificationService.broadcast(input);

      res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
