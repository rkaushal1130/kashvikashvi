import { Request, Response, NextFunction } from 'express';
import { SupportService } from '../services/support.service';
import {
  AddTicketMessageInput,
  CreateSupportTicketInput,
  SupportTicketQueryInput,
} from '../validators/support.validators';

export class SupportController {
  public static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || 'usr-anonymous';
      const distributorId = req.user?.distributorProfileId || null;
      const input = req.body as CreateSupportTicketInput;

      const ticket = await SupportService.createTicket(
        userId,
        distributorId,
        input,
        req.user?.email,
        req.user?.email
      );

      res.status(201).json({
        success: true,
        message: 'Support ticket submitted successfully.',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || 'usr-anonymous';
      const distributorId = req.user?.distributorProfileId || null;
      const query = (req.query as unknown) as SupportTicketQueryInput;

      const result = await SupportService.getMyTickets(userId, distributorId, query);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: Number(query.page || 1),
          limit: Number(query.limit || 20),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getTicketById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      const ticket = await SupportService.getTicketById(id, userId, isAdmin);

      res.status(200).json({
        success: true,
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async addMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'usr-anonymous';
      const input = req.body as AddTicketMessageInput;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
      const senderName = req.user?.distributorCode || req.user?.email;

      const message = await SupportService.addMessage(id, userId, input, senderName, isAdmin);

      res.status(201).json({
        success: true,
        message: 'Message added to ticket.',
        data: message,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async closeTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

      const ticket = await SupportService.closeTicket(id, userId, isAdmin);

      res.status(200).json({
        success: true,
        message: 'Support ticket closed successfully.',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }
}
