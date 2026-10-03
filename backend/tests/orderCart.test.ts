/**
 * Test Suite: Shopping Cart & Order Management Automated Tests
 * Uses Vitest & Supertest
 *
 * Covers:
 * - Cart (add, get, remove)
 * - Order creation
 * - Stock validation & inventory locking
 * - BV calculations & anti-tampering protection
 * - Order cancellation & stock/BV reversal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { CartService } from '../src/services/cart.service';
import { OrderService } from '../src/services/order.service';
import {
  addToCartSchema,
  updateCartItemSchema,
} from '../src/validators/cart.validators';
import {
  createOrderSchema,
  orderItemInputSchema,
  orderStatusEnum,
} from '../src/validators/order.validators';
import { AppError } from '../src/utils/appError';
import { createTestToken } from './helpers/testHelpers';

describe('ORDER & CART MODULE AUTOMATED TESTS (Supertest + Vitest)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const userId = '11111111-1111-4111-8111-111111111111';
  const token = createTestToken({
    id: userId,
    email: 'buyer@kashvimlm.com',
    role: 'DISTRIBUTOR',
  });
  const productId = '22222222-2222-4222-8222-222222222222';
  const cartItemId = '33333333-3333-4333-8333-333333333333';
  const orderId = '44444444-4444-4444-8444-444444444444';

  describe('1. Shopping Cart Management (/api/v1/cart)', () => {
    it('should add an item to the shopping cart via POST /cart/items', async () => {
      const mockCart = {
        id: 'cart-1',
        userId,
        items: [
          {
            id: cartItemId,
            productId,
            quantity: 2,
            product: {
              name: 'ActiveFit Compression Hosiery Pro',
              wholesalePrice: 29.99,
              bv: 25.0,
            },
          },
        ],
        subtotal: 59.98,
        totalBV: 50.0,
      };

      vi.spyOn(CartService, 'addItem').mockResolvedValue(mockCart as any);

      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId,
          quantity: 2,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.subtotal).toBe(59.98);
      expect(res.body.data.totalBV).toBe(50.0);
    });

    it('should retrieve current user shopping cart via GET /cart', async () => {
      const mockCart = {
        id: 'cart-1',
        userId,
        items: [],
        subtotal: 0,
        totalBV: 0,
      };

      vi.spyOn(CartService, 'getOrCreateCart').mockResolvedValue(mockCart as any);

      const res = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(userId);
    });

    it('should remove an item from the cart via DELETE /cart/items/:id', async () => {
      vi.spyOn(CartService, 'removeItem').mockResolvedValue({
        id: 'cart-1',
        userId,
        items: [],
        subtotal: 0,
        totalBV: 0,
      } as any);

      const res = await request(app)
        .delete(`/api/v1/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Item removed from cart');
    });

    it('should reject unauthenticated cart requests with 401', async () => {
      const res = await request(app)
        .get('/api/v1/cart')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Order Creation & Authoritative Pricing (/api/v1/orders)', () => {
    it('should successfully create an order from validated items', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-987654-1001',
        userId,
        status: 'PAID',
        totalAmount: 59.98,
        totalBV: 50.0,
        items: [
          {
            id: 'item-1',
            productId,
            quantity: 2,
            unitPrice: 29.99,
            unitBV: 25.0,
            totalPrice: 59.98,
            totalBV: 50.0,
          },
        ],
      };

      vi.spyOn(OrderService, 'createOrder').mockResolvedValue(mockOrder as any);

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId, quantity: 2 }],
          paymentMethod: 'CREDIT_CARD',
          markPaid: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toContain('ORD-');
      expect(res.body.data.totalAmount).toBe(59.98);
      expect(res.body.data.totalBV).toBe(50.0);
    });
  });

  describe('3. Stock Validation & Inventory Locking', () => {
    it('should reject order creation with 400 when requested quantity exceeds available stock', async () => {
      vi.spyOn(OrderService, 'createOrder').mockRejectedValue(
        AppError.badRequest(
          "Insufficient stock for 'ActiveFit Compression Hosiery Pro'. Available: 3, requested: 10.",
          'INSUFFICIENT_STOCK'
        )
      );

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{ productId, quantity: 10 }],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Insufficient stock');
    });
  });

  describe('4. Anti-Tampering: Authoritative BV & Price Validation', () => {
    it('should strictly ignore client-supplied unitPrice and unitBV in orderItemInputSchema', () => {
      const clientTamperingAttempt = {
        productId,
        quantity: 2,
        unitPrice: 0.01, // Client attempting to buy for 1 cent
        unitBV: 99999,   // Client attempting to inflate BV
      };

      const parsed = orderItemInputSchema.parse(clientTamperingAttempt);
      expect(parsed.productId).toBe(productId);
      expect(parsed.quantity).toBe(2);
      expect((parsed as any).unitPrice).toBeUndefined();
      expect((parsed as any).unitBV).toBeUndefined();
    });
  });

  describe('5. Order Cancellation & Stock/BV Reversal (/api/v1/orders/:id/cancel)', () => {
    it('should cancel eligible order and initiate inventory and BV reversal', async () => {
      const mockCancelledOrder = {
        id: orderId,
        orderNumber: 'ORD-987654-1001',
        status: 'CANCELLED',
        cancelledAt: new Date(),
        restoredStock: true,
        reversedBV: 50.0,
      };

      vi.spyOn(OrderService, 'cancelOrder').mockResolvedValue(mockCancelledOrder as any);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.restoredStock).toBe(true);
    });

    it('should reject cancellation of orders that are already SHIPPED or DELIVERED', async () => {
      vi.spyOn(OrderService, 'cancelOrder').mockRejectedValue(
        AppError.badRequest(
          "Orders with status 'SHIPPED' cannot be cancelled. Please initiate a return request.",
          'ORDER_CANNOT_BE_CANCELLED'
        )
      );

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot be cancelled');
    });

    it('should reject cancellation when user does not own the order', async () => {
      vi.spyOn(OrderService, 'cancelOrder').mockRejectedValue(
        AppError.forbidden('You do not have permission to cancel this order.', 'AUTH_FORBIDDEN')
      );

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('do not have permission');
    });
  });

  describe('6. Order Status Enums Verification', () => {
    it('should recognize all required enterprise order statuses', () => {
      const expected = [
        'PENDING',
        'PAYMENT_PENDING',
        'PAID',
        'CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
      ];

      for (const st of expected) {
        expect(orderStatusEnum.safeParse(st).success).toBe(true);
      }
      expect(orderStatusEnum.safeParse('UNKNOWN_STATUS').success).toBe(false);
    });
  });
});
