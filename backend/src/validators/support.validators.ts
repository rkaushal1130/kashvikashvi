import { z } from 'zod';

export const ticketStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
]);

export const ticketPriorityEnum = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

export const createSupportTicketSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  department: z.string().min(2).default('GENERAL'),
  priority: ticketPriorityEnum.default('MEDIUM'),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const addTicketMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  attachments: z.any().optional(),
});

export const supportTicketIdParamSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
});

export const supportTicketQuerySchema = z.object({
  status: ticketStatusEnum.optional(),
  priority: ticketPriorityEnum.optional(),
  department: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusEnum,
  assignedToId: z.string().uuid().optional(),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;
export type SupportTicketQueryInput = z.infer<typeof supportTicketQuerySchema>;
