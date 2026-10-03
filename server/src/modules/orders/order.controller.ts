import { Response, NextFunction } from 'express';
import { OrderService } from './order.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';

export class OrderController {
  static async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Do not trust member IDs from frontend body: strictly prioritize authenticated session
      const distributorMemberId =
        req.user?.role?.toLowerCase() === 'admin' && req.body.distributorMemberId
          ? req.body.distributorMemberId
          : req.user?.memberId;

      if (!distributorMemberId) {
        res.status(400).json({ success: false, message: 'Distributor member identity required.' });
        return;
      }

      const orderResult = await OrderService.placeOrder({
        distributorMemberId,
        items: req.body.items,
        shippingAddress: req.body.shippingAddress || 'Registered Member Address, India',
        paymentMethod: req.body.paymentMethod,
      });

      // Immutable Audit Log: ORDER_CREATED
      await AuditService.recordFromRequest(
        req,
        AuditAction.ORDER_CREATED,
        'Order',
        orderResult?.orderNumber || null,
        null,
        {
          orderNumber: orderResult?.orderNumber,
          totalAmount: orderResult?.totalAmount,
          totalBv: orderResult?.totalBv,
          distributorMemberId,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Wholesale order confirmed and volume points credited to your account!',
        data: orderResult,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMyOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const memberId = req.user?.memberId;
      if (!memberId) {
        res.status(401).json({ success: false, message: 'Unauthenticated.' });
        return;
      }
      const orders = await OrderService.getOrdersByDistributor(memberId);
      res.status(200).json({ success: true, count: orders.length, data: orders });
    } catch (err) {
      next(err);
    }
  }

  static async getOrderDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderNumber } = req.params;
      const order = await OrderService.getOrderDetails(orderNumber);
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      // Strict Ownership Verification: Ensure order belongs to requester or user has Admin clearance
      const isAdmin = req.user?.role?.toLowerCase() === 'admin';
      const orderOwner = (order as any).distributor_member_id || (order as any).memberId;
      const isOwner = req.user?.memberId === orderOwner || req.user?.id === (order as any).distributor_id;

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Ownership verification failed: You do not have permission to view orders belonging to another member.',
        });
        return;
      }

      res.status(200).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }
}
