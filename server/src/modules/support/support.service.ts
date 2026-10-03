import { query } from '../../config/db.js';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  distributorId?: string;
  department: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  message: string;
  createdAt: string;
}

export class SupportService {
  private static demoTickets: SupportTicket[] = [
    {
      id: 'tick-001',
      ticketNumber: 'KV-TKT-2026-9041',
      userId: 'usr-demo-001',
      name: 'Rahul Kaushal',
      email: 'rahul.kaushal@kashvimlm.com',
      phone: '+91 70156 43886',
      distributorId: 'dist-001',
      department: 'BV Points & Weekly Payout Inquiry',
      subject: 'NEFT Payout confirmation inquiry for Week 37',
      description: 'Requesting bank acknowledgement receipt for the recent weekly matching commission payout.',
      status: 'Resolved',
      priority: 'High',
      createdAt: '2026-09-15T10:00:00Z',
      updatedAt: '2026-09-15T14:30:00Z',
      messages: [
        {
          id: 'msg-001',
          ticketId: 'tick-001',
          senderId: 'usr-demo-001',
          message: 'Hello, could you please verify if Week 37 payout has been processed?',
          createdAt: '2026-09-15T10:00:00Z',
        },
        {
          id: 'msg-002',
          ticketId: 'tick-001',
          senderId: 'usr-admin-001',
          message: 'UTR reference CMS8819230914 generated and settled on Monday 11:30 AM.',
          createdAt: '2026-09-15T14:30:00Z',
        },
      ],
    },
    {
      id: 'tick-002',
      ticketNumber: 'KV-TKT-2026-9102',
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91 98765 43210',
      distributorId: 'dist-002',
      department: 'General Customer & Order Support',
      subject: 'Order shipment tracking update for Hozri bulk bundle',
      description: 'Order KASH-ORD-781923 tracking status shows in transit from Delhi hub.',
      status: 'Open',
      priority: 'Medium',
      createdAt: '2026-09-20T12:00:00Z',
      updatedAt: '2026-09-20T12:00:00Z',
      messages: [
        {
          id: 'msg-003',
          ticketId: 'tick-002',
          senderId: 'priya.sharma@example.com',
          message: 'Please provide express tracking link for consignment KASH-ORD-781923.',
          createdAt: '2026-09-20T12:00:00Z',
        },
      ],
    },
  ];

  private static demoMessages: SupportMessage[] = [
    {
      id: 'msg-001',
      ticketId: 'tick-001',
      senderId: 'usr-demo-001',
      message: 'Hello, could you please verify if Week 37 payout has been processed?',
      createdAt: '2026-09-15T10:00:00Z',
    },
    {
      id: 'msg-002',
      ticketId: 'tick-001',
      senderId: 'usr-admin-001',
      message: 'UTR reference CMS8819230914 generated and settled on Monday 11:30 AM.',
      createdAt: '2026-09-15T14:30:00Z',
    },
    {
      id: 'msg-003',
      ticketId: 'tick-002',
      senderId: 'priya.sharma@example.com',
      message: 'Please provide express tracking link for consignment KASH-ORD-781923.',
      createdAt: '2026-09-20T12:00:00Z',
    },
  ];

  static async getTickets(filter?: {
    memberId?: string;
    distributorId?: string;
    userId?: string;
    status?: string;
    department?: string;
  }): Promise<SupportTicket[]> {
    try {
      const sql = `
        SELECT st.*, d.member_id 
        FROM support_tickets st
        LEFT JOIN distributors d ON st.distributor_id = d.id
        WHERE ($1::text IS NULL OR d.member_id = $1 OR st.distributor_id = $1)
          AND ($2::text IS NULL OR st.user_id = $2)
          AND ($3::text IS NULL OR st.status = $3)
          AND ($4::text IS NULL OR st.department ILIKE '%' || $4 || '%')
        ORDER BY st.created_at DESC
      `;
      const res = await query(sql, [
        filter?.memberId || filter?.distributorId || null,
        filter?.userId || null,
        filter?.status || null,
        filter?.department || null,
      ]);
      if (res && res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: row.id,
          ticketNumber: row.ticket_number,
          userId: row.user_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          distributorId: row.distributor_id,
          department: row.department,
          subject: row.subject,
          description: row.description,
          status: row.status,
          priority: row.priority,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      }
    } catch {
      // Fallback to in-memory demo tickets
    }

    return this.demoTickets.filter((t) => {
      if (filter?.status && t.status.toLowerCase() !== filter.status.toLowerCase()) return false;
      if (filter?.distributorId && t.distributorId !== filter.distributorId) return false;
      if (filter?.userId && t.userId !== filter.userId) return false;
      if (filter?.department && !t.department.toLowerCase().includes(filter.department.toLowerCase())) return false;
      return true;
    });
  }

  static async getTicketById(ticketIdOrNumber: string): Promise<SupportTicket | null> {
    try {
      const sql = `
        SELECT st.*, d.member_id 
        FROM support_tickets st
        LEFT JOIN distributors d ON st.distributor_id = d.id
        WHERE st.id = $1 OR st.ticket_number = $1
        LIMIT 1
      `;
      const res = await query(sql, [ticketIdOrNumber]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        const messages = await this.getMessages(row.id);
        return {
          id: row.id,
          ticketNumber: row.ticket_number,
          userId: row.user_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          distributorId: row.distributor_id,
          department: row.department,
          subject: row.subject,
          description: row.description,
          status: row.status,
          priority: row.priority,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          messages,
        };
      }
    } catch {
      // Fallback
    }

    const found = this.demoTickets.find(
      (t) => t.id === ticketIdOrNumber || t.ticketNumber === ticketIdOrNumber
    );
    if (found) {
      const messages = this.demoMessages.filter((m) => m.ticketId === found.id);
      return { ...found, messages };
    }
    return null;
  }

  static async createTicket(data: {
    userId?: string;
    name: string;
    email: string;
    phone?: string;
    distributorId?: string;
    memberId?: string;
    department: string;
    subject: string;
    description: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  }): Promise<SupportTicket> {
    const ticketNumber = `KV-TKT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    const newTicket: SupportTicket = {
      id: `tick-${Date.now()}`,
      ticketNumber,
      userId: data.userId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      distributorId: data.distributorId || data.memberId,
      department: data.department,
      subject: data.subject,
      description: data.description,
      status: data.status || 'Open',
      priority: data.priority || 'Medium',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    try {
      let distId = data.distributorId;
      if (!distId && data.memberId) {
        const distRes = await query(`SELECT id FROM distributors WHERE member_id = $1`, [data.memberId]);
        if (distRes && distRes.rows.length > 0) {
          distId = distRes.rows[0].id;
        }
      }

      const insertRes = await query(
        `INSERT INTO support_tickets (
           ticket_number, user_id, name, email, phone, distributor_id, department, subject, description, status, priority, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING *`,
        [
          ticketNumber,
          data.userId || null,
          data.name,
          data.email,
          data.phone || null,
          distId || null,
          data.department,
          data.subject,
          data.description,
          data.status || 'Open',
          data.priority || 'Medium',
        ]
      );
      if (insertRes && insertRes.rows.length > 0) {
        const row = insertRes.rows[0];
        return {
          id: row.id,
          ticketNumber: row.ticket_number,
          userId: row.user_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          distributorId: row.distributor_id,
          department: row.department,
          subject: row.subject,
          description: row.description,
          status: row.status,
          priority: row.priority,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          messages: [],
        };
      }
    } catch {
      // Fallback
    }

    this.demoTickets.unshift(newTicket);
    return newTicket;
  }

  static async updateTicket(
    ticketId: string,
    data: {
      status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
      priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
      department?: string;
    }
  ): Promise<SupportTicket | null> {
    const now = new Date().toISOString();
    try {
      const sql = `
        UPDATE support_tickets
        SET status = COALESCE($1, status),
            priority = COALESCE($2, priority),
            department = COALESCE($3, department),
            updated_at = NOW()
        WHERE id = $4 OR ticket_number = $4
        RETURNING *
      `;
      const res = await query(sql, [data.status || null, data.priority || null, data.department || null, ticketId]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        const messages = await this.getMessages(row.id);
        return {
          id: row.id,
          ticketNumber: row.ticket_number,
          userId: row.user_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          distributorId: row.distributor_id,
          department: row.department,
          subject: row.subject,
          description: row.description,
          status: row.status,
          priority: row.priority,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          messages,
        };
      }
    } catch {
      // Fallback
    }

    const t = this.demoTickets.find((item) => item.id === ticketId || item.ticketNumber === ticketId);
    if (t) {
      if (data.status) t.status = data.status;
      if (data.priority) t.priority = data.priority;
      if (data.department) t.department = data.department;
      t.updatedAt = now;
      return t;
    }
    return null;
  }

  static async addMessage(
    ticketId: string,
    data: { senderId: string; message: string }
  ): Promise<SupportMessage | null> {
    const now = new Date().toISOString();
    const msgId = `msg-${Date.now()}`;

    try {
      // Ensure ticket exists
      const ticketRes = await query(`SELECT id FROM support_tickets WHERE id = $1 OR ticket_number = $1`, [ticketId]);
      if (ticketRes && ticketRes.rows.length > 0) {
        const actualTicketId = ticketRes.rows[0].id;
        const res = await query(
          `INSERT INTO support_messages (ticket_id, sender_id, message, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING *`,
          [actualTicketId, data.senderId, data.message]
        );
        if (res && res.rows.length > 0) {
          const row = res.rows[0];
          // Also update ticket's updated_at
          await query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`, [actualTicketId]);
          return {
            id: row.id,
            ticketId: row.ticket_id,
            senderId: row.sender_id,
            message: row.message,
            createdAt: row.created_at,
          };
        }
      }
    } catch {
      // Fallback
    }

    const t = this.demoTickets.find((item) => item.id === ticketId || item.ticketNumber === ticketId);
    if (t) {
      const newMsg: SupportMessage = {
        id: msgId,
        ticketId: t.id,
        senderId: data.senderId,
        message: data.message,
        createdAt: now,
      };
      this.demoMessages.push(newMsg);
      if (!t.messages) t.messages = [];
      t.messages.push(newMsg);
      t.updatedAt = now;
      return newMsg;
    }
    return null;
  }

  static async getMessages(ticketId: string): Promise<SupportMessage[]> {
    try {
      const res = await query(
        `SELECT sm.* 
         FROM support_messages sm
         JOIN support_tickets st ON sm.ticket_id = st.id
         WHERE sm.ticket_id = $1 OR st.ticket_number = $1
         ORDER BY sm.created_at ASC`,
        [ticketId]
      );
      if (res && res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: row.id,
          ticketId: row.ticket_id,
          senderId: row.sender_id,
          message: row.message,
          createdAt: row.created_at,
        }));
      }
    } catch {
      // Fallback
    }

    const t = this.demoTickets.find((item) => item.id === ticketId || item.ticketNumber === ticketId);
    if (t) {
      return this.demoMessages.filter((m) => m.ticketId === t.id);
    }
    return [];
  }

  static async closeTicket(
    ticketId: string,
    reason?: string,
    closedBy?: string
  ): Promise<SupportTicket | null> {
    const now = new Date().toISOString();
    try {
      const sql = `
        UPDATE support_tickets
        SET status = 'Closed', updated_at = NOW()
        WHERE id = $1 OR ticket_number = $1
        RETURNING *
      `;
      const res = await query(sql, [ticketId]);
      if (res && res.rows.length > 0) {
        const row = res.rows[0];
        if (reason) {
          await this.addMessage(row.id, {
            senderId: closedBy || 'System',
            message: `Ticket closed. Reason: ${reason}`,
          });
        }
        return await this.getTicketById(row.id);
      }
    } catch {
      // Fallback
    }

    const t = this.demoTickets.find((item) => item.id === ticketId || item.ticketNumber === ticketId);
    if (t) {
      t.status = 'Closed';
      t.updatedAt = now;
      if (reason) {
        await this.addMessage(t.id, {
          senderId: closedBy || 'System',
          message: `Ticket closed. Reason: ${reason}`,
        });
      }
      return t;
    }
    return null;
  }
}
