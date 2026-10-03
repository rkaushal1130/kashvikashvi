import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  notificationIdParamSchema,
  notificationQuerySchema,
} from '../validators/notification.validators';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /api/v1/notifications - Get current user notifications
router.get(
  '/',
  validate({ query: notificationQuerySchema }),
  NotificationController.getMyNotifications
);

// PATCH /api/v1/notifications/:id/read - Mark notification as read
router.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  NotificationController.markAsRead
);

// POST /api/v1/notifications/mark-all-read - Mark all user notifications as read
router.post(
  '/mark-all-read',
  NotificationController.markAllAsRead
);

export const notificationRouter = router;
