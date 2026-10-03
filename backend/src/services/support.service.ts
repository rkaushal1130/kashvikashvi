import { TicketPriority, TicketStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import {
  AddTicketMessageInput,
  CreateSupportTicketInput,
  SupportTicketQueryInput,
} from '../validators/support.validators';

export interface FormattedTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName?: string;
  senderRole?: string;
  message: string;
  attachments?: any;
  createdAt: Date;
}

export interface FormattedSupportTicket {
  id: string;
  ticketNumber: string;
  userId: string | null;
  distributorId: string | null;
  name: string;
  email: string;
  phone: string | null;
  department: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedToId: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: FormattedTicketMessage[];
}

export class SupportService {
  private static inMemoryTickets: FormattedSupportTicket[] = [
    {
      id: 'tck-demo-10001-uuid',
      ticketNumber: 'TCK-10001',
      userId: 'usr-demo-1001',
      distributorId: 'dist-demo-1001',
      name: 'Rahul Example',
      email: 'rahul.example@example.com',
      phone: '+1-555-0101',
      department: 'COMMISSIONS',
      subject: 'Inquiry regarding Binary Matching Cycle Payout',
      description:
        'Hello Support Team, I am checking to verify when the pending cycle bonus for Period W-2026-38 will reflect in my e-wallet. Thanks!',
      status: 'OPEN',
      priority: 'MEDIUM',
      assignedToId: null,
      closedAt: null,
      createdAt: new Date('2026-09-16T10:00:00Z'),
      updatedAt: new Date('2026-09-16T10:30:00Z'),
      messages: [
        {
          id: 'msg-demo-1',
          ticketId: 'tck-demo-10001-uuid',
          senderId: 'usr-demo-1001',
          senderName: 'Rahul Example',
          message:
            'Hello Support Team, I am checking to verify when the pending cycle bonus for Period W-2026-38 will reflect in my e-wallet. Thanks!',
          createdAt: new Date('2026-09-16T10:00:00Z'),
        },
        {
          id: 'msg-demo-2',
          ticketId: 'tck-demo-10001-uuid',
          senderId: 'usr-admin-001',
          senderName: 'Kashvi Support Admin',
          message:
            'Hi Rahul, Period W-2026-38 closes on Sunday at 23:59:59 UTC. Calculations will run on Monday morning and qualify for immediate wallet payout upon admin approval.',
          createdAt: new Date('2026-09-16T10:30:00Z'),
        },
      ],
    },
  ];

  public static formatTicket(ticket: any): FormattedSupportTicket {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      userId: ticket.userId ?? null,
      distributorId: ticket.distributorId ?? null,
      name: ticket.name,
      email: ticket.email,
      phone: ticket.phone ?? null,
      department: ticket.department ?? 'GENERAL',
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assignedToId: ticket.assignedToId ?? null,
      closedAt: ticket.closedAt ?? null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      messages: ticket.messages?.map((m: any) => ({
        id: m.id,
        ticketId: m.ticketId,
        senderId: m.senderId,
        senderName: m.sender?.distributorProfile?.displayName || m.sender?.email,
        senderRole: m.sender?.roleName,
        message: m.message,
        attachments: m.attachments,
        createdAt: m.createdAt,
      })),
    };
  }

  public static async createTicket(
    userId: string,
    distributorId: string | null,
    input: CreateSupportTicketInput,
    userEmail?: string,
    userName?: string
  ): Promise<FormattedSupportTicket> {
    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`;
    const email = input.email || userEmail || 'user@example.com';
    const name = input.name || userName || 'Valued Member';

    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.supportTicket) {
        const created = await prisma.supportTicket.create({
          data: {
            ticketNumber,
            userId,
            distributorId,
            name,
            email,
            phone: input.phone,
            department: input.department || 'GENERAL',
            subject: input.subject,
            description: input.description,
            status: 'OPEN',
            priority: (input.priority as TicketPriority) || 'MEDIUM',
            messages: {
              create: [
                {
                  senderId: userId,
                  message: input.description,
                },
              ],
            },
          },
          include: {
            messages: true,
          },
        });
        return this.formatTicket(created);
      }
    } catch (err: any) {
      logger.debug('Prisma supportTicket.create offline, using in-memory store: %s', err.message);
    }

    const newTicket: FormattedSupportTicket = {
      id: `tck-${Date.now()}`,
      ticketNumber,
      userId,
      distributorId,
      name,
      email,
      phone: input.phone || null,
      department: input.department || 'GENERAL',
      subject: input.subject,
      description: input.description,
      status: 'OPEN',
      priority: (input.priority as TicketPriority) || 'MEDIUM',
      assignedToId: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          ticketId: `tck-${Date.now()}`,
          senderId: userId,
          senderName: name,
          message: input.description,
          createdAt: new Date(),
        },
      ],
    };

    this.inMemoryTickets.unshift(newTicket);
    return newTicket;
  }

  public static async getMyTickets(
    userId: string,
    distributorId: string | null,
    query: SupportTicketQueryInput
  ): Promise<{ data: FormattedSupportTicket[]; total: number }> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.supportTicket) {
        const where: any = {
          OR: [{ userId }, ...(distributorId ? [{ distributorId }] : [])],
        };
        if (query.status) where.status = query.status;
        if (query.priority) where.priority = query.priority;
        if (query.department) where.department = query.department;

        const [tickets, total] = await Promise.all([
          prisma.supportTicket.findMany({
            where,
            include: { messages: true },
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          prisma.supportTicket.count({ where }),
        ]);

        return {
          data: tickets.map((t) => this.formatTicket(t)),
          total,
        };
      }
    } catch (err: any) {
      logger.debug('Prisma supportTicket.findMany offline, using in-memory store');
    }

    let filtered = this.inMemoryTickets.filter(
      (t) => t.userId === userId || (distributorId && t.distributorId === distributorId)
    );
    if (query.status) filtered = filtered.filter((t) => t.status === query.status);
    if (query.priority) filtered = filtered.filter((t) => t.priority === query.priority);
    if (query.department) filtered = filtered.filter((t) => t.department === query.department);

    return {
      data: filtered.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: filtered.length,
    };
  }

  public static async getTicketById(
    ticketId: string,
    userId?: string,
    isAdmin = false
  ): Promise<FormattedSupportTicket> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.supportTicket) {
        const ticket = await prisma.supportTicket.findFirst({
          where: {
            OR: [{ id: ticketId }, { ticketNumber: ticketId }],
          },
          include: {
            messages: {
              include: { sender: { include: { distributorProfile: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        });
        if (ticket) {
          if (!isAdmin && userId && ticket.userId !== userId) {
            throw AppError.forbidden('You do not have permission to view this ticket.');
          }
          return this.formatTicket(ticket);
        }
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.debug('Prisma supportTicket.findFirst offline, using in-memory store');
    }

    const memoryTicket = this.inMemoryTickets.find(
      (t) => t.id === ticketId || t.ticketNumber === ticketId
    );
    if (!memoryTicket) {
      throw AppError.notFound('Support ticket not found.');
    }
    if (!isAdmin && userId && memoryTicket.userId !== userId) {
      throw AppError.forbidden('You do not have permission to view this ticket.');
    }
    return memoryTicket;
  }

  public static async addMessage(
    ticketId: string,
    senderId: string,
    input: AddTicketMessageInput,
    senderName?: string,
    isAdmin = false
  ): Promise<FormattedTicketMessage> {
    await this.getTicketById(ticketId, senderId, isAdmin);

    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.supportMessage) {
        const realTicket = await prisma.supportTicket.findFirst({
          where: { OR: [{ id: ticketId }, { ticketNumber: ticketId }] },
        });
        if (realTicket) {
          const msg = await prisma.supportMessage.create({
            data: {
              ticketId: realTicket.id,
              senderId,
              message: input.message,
              attachments: input.attachments,
            },
          });
          // Update status if replied by admin or user
          await prisma.supportTicket.update({
            where: { id: realTicket.id },
            data: {
              status: isAdmin ? 'WAITING_USER' : 'IN_PROGRESS',
              updatedAt: new Date(),
            },
          });
          return {
            id: msg.id,
            ticketId: msg.ticketId,
            senderId: msg.senderId,
            senderName,
            message: msg.message,
            attachments: msg.attachments,
            createdAt: msg.createdAt,
          };
        }
      }
    } catch (err: any) {
      logger.debug('Prisma supportMessage.create offline, using in-memory store');
    }

    const memoryTicket = this.inMemoryTickets.find(
      (t) => t.id === ticketId || t.ticketNumber === ticketId
    );
    if (!memoryTicket) throw AppError.notFound('Ticket not found.');

    const newMsg: FormattedTicketMessage = {
      id: `msg-${Date.now()}`,
      ticketId: memoryTicket.id,
      senderId,
      senderName: senderName || 'User',
      message: input.message,
      attachments: input.attachments,
      createdAt: new Date(),
    };

    memoryTicket.messages = memoryTicket.messages || [];
    memoryTicket.messages.push(newMsg);
    memoryTicket.status = isAdmin ? 'WAITING_USER' : 'IN_PROGRESS';
    memoryTicket.updatedAt = new Date();

    return newMsg;
  }

  public static async closeTicket(
    ticketId: string,
    userId?: string,
    isAdmin = false
  ): Promise<FormattedSupportTicket> {
    const ticket = await this.getTicketById(ticketId, userId, isAdmin);

    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.supportTicket) {
        const updated = await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            updatedAt: new Date(),
          },
          include: { messages: true },
        });
        return this.formatTicket(updated);
      }
    } catch (err: any) {
      logger.debug('Prisma supportTicket.update offline, using in-memory store');
    }

    const memoryTicket = this.inMemoryTickets.find((t) => t.id === ticket.id);
    if (memoryTicket) {
      memoryTicket.status = 'CLOSED';
      memoryTicket.closedAt = new Date();
      memoryTicket.updatedAt = new Date();
      return memoryTicket;
    }
    return ticket;
  }

  public static async getAdminTickets(
    query: SupportTicketQueryInput
  ): Promise<{ data: FormattedSupportTicket[]; total: number }> {
    try {
      if (process.env.NODE_ENV !== 'test' && prisma && prisma.supportTicket) {
        const where: any = {};
        if (query.status) where.status = query.status;
        if (query.priority) where.priority = query.priority;
        if (query.department) where.department = query.department;
        if (query.search) {
          where.OR = [
            { ticketNumber: { contains: query.search, mode: 'insensitive' } },
            { subject: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ];
        }

        const [tickets, total] = await Promise.all([
          prisma.supportTicket.findMany({
            where,
            include: { messages: true },
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          prisma.supportTicket.count({ where }),
        ]);

        return {
          data: tickets.map((t) => this.formatTicket(t)),
          total,
        };
      }
    } catch (err: any) {
      logger.debug('Prisma admin supportTicket.findMany offline, using in-memory store');
    }

    let filtered = [...this.inMemoryTickets];
    if (query.status) filtered = filtered.filter((t) => t.status === query.status);
    if (query.priority) filtered = filtered.filter((t) => t.priority === query.priority);
    if (query.department) filtered = filtered.filter((t) => t.department === query.department);

    return {
      data: filtered.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: filtered.length,
    };
  }
}
