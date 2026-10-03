import { z } from 'zod';

export const createTicketSchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  fullName: z.string().min(2, 'Full name is required').optional(),
  email: z.string().email('Valid email address is required'),
  phone: z.string().optional(),
  userId: z.string().optional(),
  distributorId: z.string().optional(),
  memberId: z.string().optional(),
  department: z.string().min(2, 'Department is required').optional(),
  category: z.string().min(2, 'Category is required').optional(),
  subject: z.string().min(3, 'Subject is required'),
  description: z.string().min(5, 'Description is required').optional(),
  message: z.string().min(5, 'Message is required').optional(),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).default('Open').optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('Medium').optional(),
}).refine(data => data.name || data.fullName, {
  message: 'Name is required',
  path: ['name'],
}).refine(data => data.department || data.category, {
  message: 'Department is required',
  path: ['department'],
}).refine(data => data.description || data.message, {
  message: 'Description or message is required',
  path: ['description'],
});

export const createMessageSchema = z.object({
  senderId: z.string().min(1, 'Sender ID is required').optional(),
  message: z.string().min(1, 'Message is required'),
});

export const updateTicketSchema = z.object({
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  department: z.string().optional(),
  adminResponse: z.string().optional(),
});

export const adminReplySchema = z.object({
  message: z.string().min(1, 'Reply message is required'),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  senderId: z.string().optional(),
});

