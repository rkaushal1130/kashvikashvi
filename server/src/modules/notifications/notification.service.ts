import { query } from '../../config/db.js';

export type NotificationType =
  | 'COMMISSION'
  | 'ORDER'
  | 'PAYMENT'
  | 'PAYOUT'
  | 'ENROLLMENT'
  | 'TRAINING'
  | 'SYSTEM'
  | 'SUPPORT'
  | 'NEWS';

export interface NotificationItem {
  id: string;
  userId?: string;
  distributorId?: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export class NotificationService {
  private static demoNotifications: NotificationItem[] = [
    {
      id: 'notif-1',
      title: 'Weekly Binary Commission Credited',
      message: '₹22,400.00 matching bonus credited to your e-Wallet for Week 38 volume calculation.',
      type: 'COMMISSION',
      isRead: false,
      actionUrl: '/wallet',
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 mins ago
    },
    {
      id: 'notif-2',
      title: 'Wholesale Order Dispatched',
      message: 'Order #KASH-ORD-781923 has been dispatched via BlueDart Express (Tracking: BD98127391).',
      type: 'ORDER',
      isRead: false,
      actionUrl: '/orders',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5 hours ago
    },
    {
      id: 'notif-3',
      title: 'Order Payment Confirmed',
      message: 'Online payment of ₹12,990.00 for Distributor Hozri Starter Pack verified successfully.',
      type: 'PAYMENT',
      isRead: false,
      actionUrl: '/wallet',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    },
    {
      id: 'notif-4',
      title: 'NEFT Payout Direct Deposit Settled',
      message: 'Weekly payout batch settled. ₹42,500.00 transferred to HDFC Bank A/C ending in 4102 (UTR CMS8819230914).',
      type: 'PAYOUT',
      isRead: false,
      actionUrl: '/payouts',
      createdAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(), // 5 hours ago
    },
    {
      id: 'notif-5',
      title: 'New Associate Enrolled in Left Leg',
      message: 'Deepak Verma enrolled under your Left Leg (BC 001). Member ID: 1861001.',
      type: 'ENROLLMENT',
      isRead: false,
      actionUrl: '/network',
      createdAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(), // 10 hours ago
    },
    {
      id: 'notif-6',
      title: 'New JumpStart Training Module Available',
      message: 'Module 3: "Compensation Plan & Binary Volume Scaling" is ready for completion.',
      type: 'TRAINING',
      isRead: true,
      actionUrl: '/training',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      id: 'notif-7',
      title: 'Scheduled Platform Maintenance',
      message: 'Server infrastructure security update scheduled for Sunday 02:00 AM - 04:00 AM IST.',
      type: 'SYSTEM',
      isRead: true,
      actionUrl: '/system',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 1.5 days ago
    },
    {
      id: 'notif-8',
      title: 'Support Ticket Status Updated',
      message: 'Ticket KV-TKT-2026-9041 received an official reply from Distributor Care.',
      type: 'SUPPORT',
      isRead: true,
      actionUrl: '/contact',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    },
    {
      id: 'notif-9',
      title: 'Prague 2026 Leadership Contest Is Live!',
      message: 'Opt in to qualify for international leadership convention travel points and rewards.',
      type: 'NEWS',
      isRead: true,
      actionUrl: '/news',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    },
  ];

  static async getNotifications(filter?: {
    memberId?: string;
    distributorId?: string;
    userId?: string;
    type?: NotificationType;
    isRead?: boolean;
    limit?: number;
  }): Promise<{ unreadCount: number; notifications: NotificationItem[] }> {
    const limit = filter?.limit || 50;

    try {
      const sql = `
        SELECT n.*
        FROM notifications n
        LEFT JOIN distributors d ON n.distributor_id = d.id
        WHERE ($1::text IS NULL OR d.member_id = $1 OR n.distributor_id = $1)
          AND ($2::text IS NULL OR n.user_id = $2)
          AND ($3::text IS NULL OR n.type = $3)
          AND ($4::boolean IS NULL OR n.is_read = $4)
        ORDER BY n.created_at DESC
        LIMIT $5
      `;
      const res = await query(sql, [
        filter?.memberId || filter?.distributorId || null,
        filter?.userId || null,
        filter?.type || null,
        filter?.isRead !== undefined ? filter.isRead : null,
        limit,
      ]);

      if (res && res.rows.length > 0) {
        const notifications: NotificationItem[] = res.rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          distributorId: r.distributor_id,
          title: r.title,
          message: r.message,
          type: r.type as NotificationType,
          isRead: r.is_read,
          actionUrl: r.action_url,
          createdAt: r.created_at,
        }));
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return { unreadCount, notifications };
      }
    } catch {
      // Resilient fallback to memory store
    }

    let filtered = [...this.demoNotifications];
    if (filter?.type) {
      filtered = filtered.filter((n) => n.type.toUpperCase() === filter.type?.toUpperCase());
    }
    if (filter?.isRead !== undefined) {
      filtered = filtered.filter((n) => n.isRead === filter.isRead);
    }
    if (filter?.distributorId) {
      filtered = filtered.filter((n) => !n.distributorId || n.distributorId === filter.distributorId);
    }

    const unreadCount = filtered.filter((n) => !n.isRead).length;
    return { unreadCount, notifications: filtered.slice(0, limit) };
  }

  static async markAsRead(id: string): Promise<NotificationItem | null> {
    try {
      const sql = `
        UPDATE notifications 
        SET is_read = TRUE 
        WHERE id = $1
        RETURNING *
      `;
      const res = await query(sql, [id]);
      if (res && res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          userId: r.user_id,
          distributorId: r.distributor_id,
          title: r.title,
          message: r.message,
          type: r.type as NotificationType,
          isRead: r.is_read,
          actionUrl: r.action_url,
          createdAt: r.created_at,
        };
      }
    } catch {
      // Fallback
    }

    const item = this.demoNotifications.find((n) => n.id === id);
    if (item) {
      item.isRead = true;
      return item;
    }
    return null;
  }

  static async markAllAsRead(filter?: {
    memberId?: string;
    distributorId?: string;
    userId?: string;
  }): Promise<{ updatedCount: number }> {
    try {
      const sql = `
        UPDATE notifications n
        SET is_read = TRUE
        WHERE (n.distributor_id IN (SELECT id FROM distributors WHERE member_id = $1 OR id = $2)
           OR n.user_id = $3
           OR ($1::text IS NULL AND $2::text IS NULL AND $3::text IS NULL))
          AND n.is_read = FALSE
        RETURNING id
      `;
      const res = await query(sql, [
        filter?.memberId || null,
        filter?.distributorId || null,
        filter?.userId || null,
      ]);
      const updatedCount = res ? res.rowCount || res.rows.length : 0;
      this.demoNotifications.forEach((n) => (n.isRead = true));
      return { updatedCount };
    } catch {
      // Fallback
    }

    let updatedCount = 0;
    this.demoNotifications.forEach((n) => {
      if (!n.isRead) {
        n.isRead = true;
        updatedCount++;
      }
    });
    return { updatedCount };
  }

  static async createNotification(data: {
    userId?: string;
    distributorId?: string;
    title: string;
    message: string;
    type: NotificationType;
    actionUrl?: string;
  }): Promise<NotificationItem> {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: data.userId,
      distributorId: data.distributorId,
      title: data.title,
      message: data.message,
      type: data.type,
      isRead: false,
      actionUrl: data.actionUrl,
      createdAt: new Date().toISOString(),
    };

    try {
      const sql = `
        INSERT INTO notifications (user_id, distributor_id, title, message, type, action_url, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
        RETURNING *
      `;
      const res = await query(sql, [
        data.userId || null,
        data.distributorId || null,
        data.title,
        data.message,
        data.type,
        data.actionUrl || null,
      ]);
      if (res && res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          userId: r.user_id,
          distributorId: r.distributor_id,
          title: r.title,
          message: r.message,
          type: r.type as NotificationType,
          isRead: r.is_read,
          actionUrl: r.action_url,
          createdAt: r.created_at,
        };
      }
    } catch {
      // Fallback
    }

    this.demoNotifications.unshift(newNotif);
    return newNotif;
  }
}
