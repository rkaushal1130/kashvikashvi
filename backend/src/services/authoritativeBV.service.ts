import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { AuditService } from './audit.service';

export interface CalculatedOrderItemBV {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  unitBV: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  totalBV: Prisma.Decimal;
  commissionableBV: Prisma.Decimal;
}

export interface CalculateOrderBVResult {
  items: CalculatedOrderItemBV[];
  subtotal: Prisma.Decimal;
  totalBV: Prisma.Decimal;
  commissionableBusinessVolume: Prisma.Decimal;
}

export interface OrderBVEligibilityResult {
  isEligible: boolean;
  reason?: 'ORDER_NOT_PAID' | 'ORDER_CANCELLED' | 'ORDER_REFUNDED' | 'ZERO_COMMISSIONABLE_BV';
  message?: string;
  commissionableBusinessVolume: Prisma.Decimal;
  commissionableBVNumber: number;
}

export interface AdminAdjustOrderBVInput {
  orderId: string;
  newCommissionableBV: number | string | Prisma.Decimal;
  reason: string;
  adminUserId: string;
}

/**
 * ============================================================================
 * AUTHORITATIVE BUSINESS VOLUME (BV) SERVICE (PROMPT 14)
 * ============================================================================
 * Sole authoritative engine for resolving, computing, and verifying commissionable
 * Business Volume across orders and product lines.
 *
 * Core Business Invariants:
 * 1. Base is strictly COMMISSIONABLE BUSINESS VOLUME, NEVER:
 *    - Selling Price (Wholesale / Retail / MRP)
 *    - GST or Tax Amounts
 *    - Shipping or Handling Fees
 *    - Wallet Balances
 *    - Business Building Volume (BB) (Used for Rank Qualifications)
 *    - Binary matching volumes
 * 2. Selling price and BV are strictly independent.
 * 3. Zero-trust frontend: BV is ALWAYS derived from backend product database records
 *    or explicitly authorized admin overrides.
 * 4. Orders with 0 BV generate zero commissions.
 * 5. Orders cancelled/refunded before or during qualification generate zero commissions.
 */
export class AuthoritativeBVService {
  /**
   * Deterministically calculates authoritative Business Volume for order line items
   * directly from database product records. Ignores any client-submitted pricing/BV.
   */
  public static async calculateOrderCommissionableBV(
    items: Array<{ productId: string; quantity: number }>,
    client?: Prisma.TransactionClient,
    isDistributor: boolean = true
  ): Promise<CalculateOrderBVResult> {
    const db = client || prisma;
    const validatedItems: CalculatedOrderItemBV[] = [];

    let subtotal = new Prisma.Decimal('0.00');
    let totalBV = new Prisma.Decimal('0.00');

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          wholesalePrice: true,
          distributorPrice: true,
          retailPrice: true,
          mrp: true,
          bv: true,
          stock: true,
          status: true,
          deletedAt: true,
        },
      });

      if (!product || product.deletedAt !== null) {
        throw AppError.notFound(`Product with ID '${item.productId}' not found`);
      }

      if (product.status === 'INACTIVE' || product.status === 'DISCONTINUED') {
        throw AppError.badRequest(`Product '${product.name}' is inactive or discontinued.`);
      }

      const qty = Math.max(1, Math.floor(item.quantity));

      // 1. Authoritative unit price from DB
      const unitPriceVal = isDistributor
        ? product.wholesalePrice ?? product.distributorPrice ?? product.mrp
        : product.mrp ?? product.retailPrice ?? product.wholesalePrice;
      const unitPrice = SafeDecimal.roundDecimal(unitPriceVal ?? 0);
      const itemTotalPrice = unitPrice.mul(qty);

      // 2. Authoritative unit BV from DB (source of truth)
      const unitBV = SafeDecimal.roundDecimal(product.bv ?? 0);
      const itemTotalBV = unitBV.mul(qty);

      subtotal = subtotal.add(itemTotalPrice);
      totalBV = totalBV.add(itemTotalBV);

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice,
        unitBV,
        totalPrice: itemTotalPrice,
        totalBV: itemTotalBV,
        commissionableBV: itemTotalBV,
      });
    }

    return {
      items: validatedItems,
      subtotal,
      totalBV,
      commissionableBusinessVolume: totalBV,
    };
  }

  /**
   * Retrieves the authoritative commissionable Business Volume for a specific order.
   * Prioritizes explicit `commissionableBusinessVolume`, falls back to `totalBV`.
   */
  public static async getAuthoritativeOrderBV(
    orderId: string,
    client?: Prisma.TransactionClient
  ): Promise<Prisma.Decimal> {
    const db = client || prisma;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalBV: true,
        commissionableBusinessVolume: true,
      },
    });

    if (!order) {
      throw AppError.notFound(`Order '${orderId}' not found`, 'ORDER_NOT_FOUND');
    }

    const explicitBV = order.commissionableBusinessVolume
      ? SafeDecimal.toDecimal(order.commissionableBusinessVolume)
      : null;

    if (explicitBV && explicitBV.greaterThan(0)) {
      return explicitBV;
    }

    return SafeDecimal.toDecimal(order.totalBV ?? 0);
  }

  /**
   * Evaluates whether an order qualifies for unilevel commission distribution:
   * 1. Order status must be PAID, CONFIRMED, or DELIVERED.
   * 2. Cancelled or refunded orders are explicitly disqualified.
   * 3. Commissionable BV must be strictly greater than zero.
   */
  public static validateOrderBVEligibility(order: {
    status: OrderStatus;
    totalBV?: Prisma.Decimal | number | string | null;
    commissionableBusinessVolume?: Prisma.Decimal | number | string | null;
  }): OrderBVEligibilityResult {
    const commBV = SafeDecimal.toDecimal(
      order.commissionableBusinessVolume ?? order.totalBV ?? '0.00'
    );
    const commissionableBVNumber = commBV.toNumber();

    // 1. Order cancelled / refunded check
    if (order.status === 'CANCELLED') {
      return {
        isEligible: false,
        reason: 'ORDER_CANCELLED',
        message: 'Order has been cancelled; no commissions will be generated.',
        commissionableBusinessVolume: commBV,
        commissionableBVNumber,
      };
    }

    if (order.status === 'REFUNDED') {
      return {
        isEligible: false,
        reason: 'ORDER_REFUNDED',
        message: 'Order has been refunded; commissions cannot be generated.',
        commissionableBusinessVolume: commBV,
        commissionableBVNumber,
      };
    }

    // 2. Order payment qualification check
    if (order.status !== 'PAID' && order.status !== 'CONFIRMED' && order.status !== 'DELIVERED') {
      return {
        isEligible: false,
        reason: 'ORDER_NOT_PAID',
        message: `Cannot calculate commission for order in '${order.status}' status. Order must be PAID or CONFIRMED.`,
        commissionableBusinessVolume: commBV,
        commissionableBVNumber,
      };
    }

    // 3. Zero BV check
    if (commBV.lessThanOrEqualTo(0)) {
      return {
        isEligible: false,
        reason: 'ZERO_COMMISSIONABLE_BV',
        message: 'Order has zero commissionable Business Volume; no commissions will be generated.',
        commissionableBusinessVolume: commBV,
        commissionableBVNumber: 0,
      };
    }

    return {
      isEligible: true,
      commissionableBusinessVolume: commBV,
      commissionableBVNumber,
    };
  }

  /**
   * Authorized Admin Operation: Manually adjust or override commissionable BV for an order.
   * Emits audit logs and updates the authoritative order record.
   */
  public static async adminAdjustOrderBV(
    input: AdminAdjustOrderBVInput,
    client?: Prisma.TransactionClient
  ) {
    const { orderId, newCommissionableBV, reason, adminUserId } = input;
    const db = client || prisma;

    const newBVDecimal = SafeDecimal.toDecimal(newCommissionableBV);
    if (newBVDecimal.lessThan(0)) {
      throw AppError.badRequest('Commissionable Business Volume cannot be negative', 'INVALID_BV');
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        commissionableBusinessVolume: true,
        totalBV: true,
        status: true,
      },
    });

    if (!order) {
      throw AppError.notFound(`Order with ID '${orderId}' not found`, 'ORDER_NOT_FOUND');
    }

    const previousBV = SafeDecimal.toDecimal(
      order.commissionableBusinessVolume ?? order.totalBV ?? 0
    );

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        commissionableBusinessVolume: newBVDecimal,
      },
    });

    // Immutable audit record
    await AuditService.recordLog({
      action: 'ORDER_BV_ADJUSTMENT',
      entityType: 'Order',
      entityId: orderId,
      userId: adminUserId,
      oldValue: {
        orderNumber: order.orderNumber,
        commissionableBusinessVolume: previousBV.toNumber(),
      },
      newValue: {
        orderNumber: order.orderNumber,
        commissionableBusinessVolume: newBVDecimal.toNumber(),
        reason,
      },
    });

    logger.info(
      {
        orderId,
        orderNumber: order.orderNumber,
        previousBV: previousBV.toString(),
        newBV: newBVDecimal.toString(),
        adminUserId,
      },
      'Admin adjusted commissionable Business Volume for order'
    );

    return updated;
  }
}
