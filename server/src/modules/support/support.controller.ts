import { Response, NextFunction } from 'express';
import { SupportService } from './support.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';

export class SupportController {
  private static verifyTicketOwnership(ticket: any, req: AuthRequest): boolean {
    if (!req.user) return true; // Unauthenticated guest public ticket creation
    if (req.user.role?.toLowerCase() === 'admin') return true;

    const isOwner =
      ticket.userId === req.user.id ||
      ticket.distributorId === req.user.memberId ||
      ticket.email?.toLowerCase() === req.user.email?.toLowerCase();

    return isOwner;
  }

  // GET /api/v1/support/tickets
  static async getTickets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, department, distributorId, userId } = req.query as Record<string, string>;
      const isAdmin = req.user?.role?.toLowerCase() === 'admin';

      // Non-admin can only query their own tickets
      const effectiveDistributorId = isAdmin ? distributorId : req.user?.memberId;
      const effectiveUserId = isAdmin ? userId : req.user?.id;

      const tickets = await SupportService.getTickets({
        memberId: effectiveDistributorId,
        distributorId: effectiveDistributorId,
        userId: effectiveUserId,
        status,
        department,
      });

      res.status(200).json({ success: true, count: tickets.length, data: tickets });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/support/tickets/:id
  static async getTicketById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const ticket = await SupportService.getTicketById(id);

      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (!SupportController.verifyTicketOwnership(ticket, req)) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You do not have permission to view this support ticket.',
        });
        return;
      }

      res.status(200).json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/support/tickets
  static async createTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const name = req.body.name || req.body.fullName || req.user?.username;
      const email = req.body.email || req.user?.email;
      const phone = req.body.phone;
      const userId = req.user?.id || req.body.userId;
      const distributorId = req.user?.memberId || req.body.distributorId;
      const department = req.body.department || req.body.category || 'General Support';
      const subject = req.body.subject;
      const description = req.body.description || req.body.message;
      const priority = req.body.priority || 'Medium';
      const status = 'Open';

      if (!name || !email || !subject || !description) {
        res.status(400).json({
          success: false,
          message: 'name, email, subject, and description are required.',
        });
        return;
      }

      const ticket = await SupportService.createTicket({
        name,
        email,
        phone,
        userId,
        distributorId,
        department,
        subject,
        description,
        priority,
        status,
      });

      res.status(201).json({
        success: true,
        message: 'Support ticket submitted successfully.',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/support/tickets/:id/messages
  static async addMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const { message } = req.body;
      const senderId = req.user?.id || req.body.senderId || 'Guest';

      if (!message || !message.trim()) {
        res.status(400).json({ success: false, message: 'Message content is required.' });
        return;
      }

      const ticket = await SupportService.getTicketById(id);
      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (!SupportController.verifyTicketOwnership(ticket, req)) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You cannot post messages to tickets filed by other users.',
        });
        return;
      }

      const newMsg = await SupportService.addMessage(id, {
        senderId,
        message,
      });

      res.status(201).json({
        success: true,
        message: 'Message added to ticket successfully.',
        data: newMsg,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/support/tickets/:id/messages
  static async getMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const ticket = await SupportService.getTicketById(id);

      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (!SupportController.verifyTicketOwnership(ticket, req)) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You cannot view message threads on other users tickets.',
        });
        return;
      }

      const messages = await SupportService.getMessages(id);

      res.status(200).json({
        success: true,
        count: messages.length,
        data: messages,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/support/tickets/:id/close
  static async closeTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const { reason } = req.body || {};
      const closedBy = req.user?.id || req.user?.email || 'User';

      const ticket = await SupportService.getTicketById(id);
      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (!SupportController.verifyTicketOwnership(ticket, req)) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You cannot close tickets belonging to other users.',
        });
        return;
      }

      const closed = await SupportService.closeTicket(id, reason, closedBy);

      // Immutable Audit Log
      await AuditService.recordFromRequest(
        req,
        AuditAction.ADMIN_ACTION,
        'SupportTicket',
        id,
        { status: ticket.status },
        { status: 'Closed', reason }
      );

      res.status(200).json({
        success: true,
        message: 'Ticket closed successfully.',
        data: closed,
      });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/v1/support/tickets/:id
  static async updateTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id || req.params.ticketId;
      const { status, priority, department, adminResponse } = req.body;

      if (!status && !priority && !department && !adminResponse) {
        res.status(400).json({ success: false, message: 'At least one field to update is required.' });
        return;
      }

      const ticket = await SupportService.getTicketById(id);
      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found.' });
        return;
      }

      if (!SupportController.verifyTicketOwnership(ticket, req)) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You cannot update tickets filed by other users.',
        });
        return;
      }

      const updated = await SupportService.updateTicket(id, {
        status,
        priority,
        department,
      });

      res.status(200).json({
        success: true,
        message: 'Support ticket updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}
