import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { optionalAuth } from '../../middleware/auth.js';

export const notificationRoutes = Router();

// Allow optional JWT authentication so preview/demo mode and authenticated mode both work seamlessly
notificationRoutes.use(optionalAuth);

// 1. GET /api/v1/notifications - List notifications and unread counter
notificationRoutes.get('/', NotificationController.getNotifications);

// 2. PATCH /api/v1/notifications/:id/read - Mark individual notification as read
notificationRoutes.patch('/:id/read', NotificationController.markAsRead);

// 3. POST /api/v1/notifications/read-all - Mark all notifications as read
notificationRoutes.post('/read-all', NotificationController.markAllAsRead);

export default notificationRoutes;
