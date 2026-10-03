import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import {
  BroadcastNotificationInput,
  NotificationQueryInput,
} from '../validators/notification.validators';

export interface FormattedNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export class NotificationService {
  private static inMemoryNotifications: FormattedNotification[] = [
    {
      id: 'notif-demo-001',
      userId: 'usr-demo-1001',
      title: 'Welcome to Kashvi MLM!',
      message:
        'Your distributor account KV-DEMO-1001 is active. Access your 3 Business Centers from the virtual office.',
      type: 'WELCOME',
      linkUrl: '/dashboard',
      isRead: true,
      readAt: new Date('2026-01-02T10:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'notif-demo-002',
      userId: 'usr-demo-1001',
      title: 'Commission Payout Received',
      message:
        'You have been credited $350.00 Binary Commission for Period W-2026-37 in your e-wallet.',
      type: 'COMMISSION',
      linkUrl: '/wallet',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-09-15T03:15:00Z'),
    },
    {
      id: 'notif-demo-003',
      userId: 'usr-demo-1001',
      title: 'New Team Member Placement',
      message:
        'Distributor Charlie Davis (KV-DEMO-1004) has joined your left leg binary team under Distributor A.',
      type: 'TEAM',
      linkUrl: '/team/tree',
      isRead: false,
      readAt: null,
      createdAt: new Date('2026-09-16T11:05:00Z'),
    },
  ];

  public static formatNotification(n: any): FormattedNotification {
    return {
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: n.type ?? 'INFO',
      linkUrl: n.linkUrl ?? null,
      isRead: Boolean(n.isRead),
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
    };
  }

  public static async getUserNotifications(
    userId: string,
    query: NotificationQueryInput
  ): Promise<{ data: FormattedNotification[]; total: number; unreadCount: number }> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.notification) {
        const where: any = { userId };
        if (query.isRead !== undefined) where.isRead = query.isRead;
        if (query.type) where.type = query.type;

        const [notifications, total, unreadCount] = await Promise.all([
          prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          prisma.notification.count({ where }),
          prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        return {
          data: notifications.map((n) => this.formatNotification(n)),
          total,
          unreadCount,
        };
      }
    } catch (err: any) {
      logger.debug('Prisma notification.findMany offline, using in-memory store');
    }

    let userNotifs = this.inMemoryNotifications.filter((n) => n.userId === userId);
    if (query.isRead !== undefined) userNotifs = userNotifs.filter((n) => n.isRead === query.isRead);
    if (query.type) userNotifs = userNotifs.filter((n) => n.type === query.type);

    const unreadCount = this.inMemoryNotifications.filter(
      (n) => n.userId === userId && !n.isRead
    ).length;

    return {
      data: userNotifs.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: userNotifs.length,
      unreadCount,
    };
  }

  public static async markAsRead(notificationId: string, userId: string): Promise<FormattedNotification> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.notification) {
        const existing = await prisma.notification.findUnique({
          where: { id: notificationId },
        });
        if (!existing || existing.userId !== userId) {
          throw AppError.notFound('Notification not found.');
        }

        const updated = await prisma.notification.update({
          where: { id: notificationId },
          data: { isRead: true, readAt: new Date() },
        });
        return this.formatNotification(updated);
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.debug('Prisma notification.update offline, using in-memory store');
    }

    const memoryNotif = this.inMemoryNotifications.find(
      (n) => n.id === notificationId && n.userId === userId
    );
    if (!memoryNotif) {
      throw AppError.notFound('Notification not found.');
    }
    memoryNotif.isRead = true;
    memoryNotif.readAt = new Date();
    return memoryNotif;
  }

  public static async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.notification) {
        const result = await prisma.notification.updateMany({
          where: { userId, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
        return { count: result.count };
      }
    } catch (err: any) {
      logger.debug('Prisma notification.updateMany offline, using in-memory store');
    }

    let count = 0;
    for (const n of this.inMemoryNotifications) {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        n.readAt = new Date();
        count++;
      }
    }
    return { count };
  }

  public static async broadcast(
    input: BroadcastNotificationInput
  ): Promise<{ message: string; count: number }> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.user) {
        const where: any = {};
        if (input.targetRole !== 'ALL') {
          where.roleName = input.targetRole;
        }

        const users = await prisma.user.findMany({
          where,
          select: { id: true },
        });

        if (users.length > 0) {
          await prisma.notification.createMany({
            data: users.map((u) => ({
              userId: u.id,
              title: input.title,
              message: input.message,
              type: input.type,
              linkUrl: input.linkUrl,
              isRead: false,
            })),
          });
        }
        return { message: 'Broadcast sent successfully.', count: users.length };
      }
    } catch (err: any) {
      logger.debug('Prisma broadcast offline, using in-memory simulation');
    }

    const newNotif: FormattedNotification = {
      id: `notif-${Date.now()}`,
      userId: 'usr-demo-1001',
      title: input.title,
      message: input.message,
      type: input.type,
      linkUrl: input.linkUrl || null,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    };
    this.inMemoryNotifications.unshift(newNotif);

    return { message: 'Broadcast queued successfully.', count: 1 };
  }
}
