import { NextFunction, Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { AuthoritativeBVService } from '../services/authoritativeBV.service';
import { InvoiceService } from '../services/invoice.service';
import { PaymentService } from '../services/payment.service';
import { sendSuccess } from '../utils/apiResponse';

export class OrderController {
  /**
   * Downloads the server-generated GST Tax Invoice PDF for an authorized order.
   * GET /api/v1/orders/:id/invoice
   */
  public static async downloadInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { buffer, invoiceNumber } = await InvoiceService.generateInvoicePdf(
        id,
        req.user!.id,
        req.user!.role
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves structured GST Invoice data for preview or printing.
   * GET /api/v1/orders/:id/invoice-data
   */
  public static async getInvoiceData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = await InvoiceService.getInvoiceDataForOrder(id, req.user!.id, req.user!.role);
      sendSuccess(res, {
        message: 'Invoice data retrieved successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atomic Commission Balance Wallet checkout.
   * POST /api/v1/orders/wallet-checkout
   */
  public static async walletCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaymentService.walletCheckout(req.user!.id, req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Order placed successfully and paid via Commission Balance Wallet.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates an order with strict 10-step transactional flow.
   * POST /api/v1/orders
   */
  public static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderService.createOrder(req.user!.id, req.body);
      sendSuccess(res, {
        statusCode: 201,
        message: 'Order created successfully.',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists orders for authenticated user (or all if admin).
   * GET /api/v1/orders
   */
  public static async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await OrderService.getOrders(req.user!.id, req.user!.role, req.query as any);
      sendSuccess(res, {
        message: 'Orders retrieved successfully.',
        data: result.items,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves single order by ID or order number.
   * GET /api/v1/orders/:id
   */
  public static async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrderService.getOrderById(req.user!.id, req.user!.role, req.params.id);
      sendSuccess(res, {
        message: 'Order retrieved.',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancels an order, restocks products, reverses BV ledger, and updates status.
   * POST /api/v1/orders/:id/cancel
   */
  public static async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cancelled = await OrderService.cancelOrder(req.user!.id, req.user!.role, req.params.id);
      sendSuccess(res, {
        message: 'Order cancelled and restocked successfully.',
        data: cancelled,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adjusts an order's commissionable Business Volume (Admin only).
   * PUT /api/v1/orders/:id/bv
   */
  public static async adminAdjustBV(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { commissionableBusinessVolume, reason } = req.body;
      const updated = await AuthoritativeBVService.adminAdjustOrderBV({
        orderId: id,
        newCommissionableBV: commissionableBusinessVolume,
        reason,
        adminUserId: req.user!.id,
      });
      sendSuccess(res, {
        message: 'Order commissionable Business Volume adjusted successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates order status and automatically transitions lifecycle (Admin only).
   * PUT /api/v1/orders/:id/status
   */
  public static async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await OrderService.updateOrderStatus(req.user!.id, req.user!.role, id, status);
      sendSuccess(res, {
        message: `Order status updated to ${status}.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Authoritative commission execution for an order (Prompt 21).
   * POST /api/v1/orders/:id/process-commission
   */
  public static async processCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await OrderService.processOrderCommission(id);
      sendSuccess(res, {
        statusCode: result.status === 'SUCCESS' ? 200 : 200,
        message: result.status === 'ALREADY_PROCESSED'
          ? 'Commissions already processed for this order (idempotent skip).'
          : result.status === 'SUCCESS'
          ? 'Commissions processed and distributed successfully.'
          : result.reason || 'Commission lifecycle evaluated.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves commission lifecycle status for an order.
   * GET /api/v1/orders/:id/commission-lifecycle
   */
  public static async getCommissionLifecycleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { OrderCommissionLifecycleService } = await import('../services/orderCommissionLifecycle.service');
      const status = await OrderCommissionLifecycleService.getOrderCommissionLifecycleStatus(id);
      sendSuccess(res, {
        message: 'Order commission lifecycle status retrieved.',
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}

