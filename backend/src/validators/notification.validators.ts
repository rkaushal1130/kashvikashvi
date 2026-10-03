import { z } from 'zod';

export const notificationIdParamSchema = z.object({
  id: z.string().min(1, 'Notification ID is required'),
});

export const notificationQuerySchema = z.object({
  isRead: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  message: z.string().min(3, 'Message must be at least 3 characters'),
  type: z.string().default('INFO'),
  targetRole: z.enum(['ALL', 'DISTRIBUTOR', 'CUSTOMER', 'ADMIN']).default('ALL'),
  linkUrl: z.string().optional(),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
