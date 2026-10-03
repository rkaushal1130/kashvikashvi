import { Prisma, OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { AuthoritativeBVService } from './authoritativeBV.service';
import { AtomicCommissionPostingService } from './atomicCommissionPosting.service';
import {
  OrderCommissionConfig,
  OrderCommissionLifecycleStage,
  OrderCommissionProcessResult,
  OrderCommissionProcessingOptions,
  CommissionTriggerPolicy,
} from '../types/orderCommissionLifecycle.types';

/**
 * ============================================================================
 * ORDER COMMISSION LIFECYCLE SERVICE (PROMPT 21)
 * ============================================================================
 * Connects unilevel commission generation to the authoritative order lifecycle.
 *
 * CANONICAL LIFECYCLE FLOW:
 * ORDER CREATED
 * ↓
 * PAYMENT PENDING
 * ↓
 * PAYMENT SUCCESSFUL
 * ↓
 * ORDER COMMISSION ELIGIBLE
 * ↓
 * BV CONFIRMED
 * ↓
 * COMMISSION CALCULATED
 * ↓
 * COMMISSION POSTED
 * ↓
 * COMMISSION AVAILABLE
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. Do not generate commission merely because an order record was created.
 *    - An order in PENDING or PAYMENT_PENDING state must NEVER generate commissions.
 * 2. Payment verification:
 *    - Commission generation requires payment confirmation (PaymentStatus = COMPLETED,
 *      or OrderStatus in PAID, CONFIRMED, PROCESSING, SHIPPED, DELIVERED).
 * 3. Business rule triggers:
 *    - If triggerPolicy is 'ORDER_DELIVERED', commission posting is held until status is DELIVERED.
 *    - If triggerPolicy is 'MANUAL_APPROVAL', commission posting is held until explicit approval.
 *    - Do not assume payment success automatically means commission is final.
 * 4. Authoritative BV verification:
 *    - Order must have confirmed positive commissionable BV (BV > 0).
 * 5. Single Authoritative Function:
 *    - processOrderCommission(orderId)
 *    - Strictly idempotent: If called multiple times for the same order, only ONE
 *      commission distribution may ever be created. Subsequent calls safely return
 *      the existing distribution with isIdempotentSkip: true.
 */
export class OrderCommissionLifecycleService {
  private static config: OrderCommissionConfig = {
    triggerPolicy: 'PAYMENT_CONFIRMED',
    holdingPeriodDays: 0,
    autoCreditWallet: true,
    requireDelivery: false,
  };

  /**
   * Updates global lifecycle configuration.
   */
  public static setConfig(partialConfig: Partial<OrderCommissionConfig>): OrderCommissionConfig {
    if (partialConfig.requireDelivery !== undefined) {
      if (partialConfig.requireDelivery) {
        partialConfig.triggerPolicy = 'ORDER_DELIVERED';
      }
    }
    this.config = {
      ...this.config,
      ...partialConfig,
    };
    logger.info({ config: this.config }, 'Order commission lifecycle configuration updated');
    return { ...this.config };
  }

  /**
   * Retrieves active lifecycle configuration.
   */
  public static getConfig(): OrderCommissionConfig {
    return { ...this.config };
  }

  /**
   * Resets lifecycle configuration to defaults.
   */
  public static resetConfig(): void {
    this.config = {
      triggerPolicy: 'PAYMENT_CONFIRMED',
      holdingPeriodDays: 0,
      autoCreditWallet: true,
      requireDelivery: false,
    };
  }

  /**
   * SINGLE AUTHORITATIVE FUNCTION: processOrderCommission(orderId)
   *
   * Coordinates the complete order commission lifecycle:
   * 1. Inspects order and payment state.
   * 2. Checks idempotency: if already processed, returns existing records with zero duplicates.
   * 3. Evaluates qualification against the business trigger policy (Payment vs Delivery vs Approval).
   * 4. Confirms BV.
   * 5. Atomically posts commissions and records wallet transactions.
   * 6. Returns detailed lifecycle execution report.
   */
  public static async processOrderCommission(
    orderId: string,
    options?: OrderCommissionProcessingOptions
  ): Promise<OrderCommissionProcessResult> {
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw AppError.badRequest('Valid orderId is required for processOrderCommission');
    }

    const cleanOrderId = orderId.trim();
    const db = options?.tx || prisma;
    const now = new Date();

    // ------------------------------------------------------------------------
    // STAGE 1: ORDER CREATED / RESOLVE ORDER AND PAYMENTS
    // ------------------------------------------------------------------------
    const order = await db.order.findUnique({
      where: { id: cleanOrderId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        distributor: {
          select: {
            id: true,
            distributorId: true,
            distributorCode: true,
            firstName: true,
            lastName: true,
          },
        },
        user: { select: { id: true, email: true } },
      },
    });

    if (!order) {
      throw AppError.notFound(`Order '${cleanOrderId}' not found`, 'ORDER_NOT_FOUND');
    }

    const activePayment = order.payments[0] || null;
    const paymentStatus: string = activePayment ? activePayment.status : 'NO_PAYMENT_RECORD';
    const orderStatus: OrderStatus = order.status;
    const purchaserMemberId = order.distributorId || order.distributor?.id || '';
    const businessVolume = Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0);

    // ------------------------------------------------------------------------
    // IDEMPOTENCY CHECK:
    // If commissions are already posted, return the existing distribution.
    // "If called multiple times for the same order: only one commission distribution may be created."
    // ------------------------------------------------------------------------
    const existingCommissions = await db.commissionTransaction.findMany({
      where: { orderId: cleanOrderId },
      include: {
        walletTransaction: true,
        recipient: {
          select: {
            id: true,
            distributorId: true,
            distributorCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { commissionLevel: 'asc' },
    });

    if (existingCommissions.length > 0) {
      const hasPostedOrPaid = existingCommissions.some(
        (c) => c.status === 'PAID' || c.status === 'APPROVED' || c.status === 'AVAILABLE'
      );

      if (hasPostedOrPaid) {
        logger.info(
          { orderId: cleanOrderId, count: existingCommissions.length },
          'processOrderCommission: Order commissions already posted. Idempotently returning existing distribution.'
        );

        const totalCommission = SafeDecimal.round(
          existingCommissions.reduce(
            (sum, c) => sum + Number(c.grossCommissionAmount),
            0
          ),
          2
        );

        return {
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          lifecycleStage: 'COMMISSION_AVAILABLE',
          status: 'ALREADY_PROCESSED',
          isIdempotentSkip: true,
          isEligible: true,
          reason: 'Commissions for this order have already been posted and distributed. Idempotently returning existing distribution.',
          orderStatus,
          paymentStatus,
          purchaserMemberId,
          businessVolume,
          commissionsCreated: 0,
          totalCommission,
          recipients: existingCommissions.map((c) => ({
            recipientId: c.recipientMemberId,
            recipientCode: c.recipient?.distributorCode,
            recipientName: c.recipient
              ? `${c.recipient.firstName} ${c.recipient.lastName}`.trim()
              : undefined,
            level: c.commissionLevel,
            percentage: Number(c.percentage),
            commissionAmount: Number(c.grossCommissionAmount),
            commissionTransactionId: c.id,
            walletTransactionId: c.walletTransactionId || '',
            walletTransactionNumber: c.walletTransaction?.transactionNumber || '',
            walletId: c.walletTransaction?.walletId || '',
            balanceBefore: Number(c.walletTransaction?.balanceBefore ?? 0),
            balanceAfter: Number(c.walletTransaction?.balanceAfter ?? 0),
          })),
          skippedRecipients: [],
          availableAt: existingCommissions[0]?.availableAt || existingCommissions[0]?.paidAt || null,
          processedAt: existingCommissions[0]?.createdAt || now,
        };
      }
    }

    // ------------------------------------------------------------------------
    // DISQUALIFICATION CHECKS: CANCELLED OR REFUNDED ORDERS
    // ------------------------------------------------------------------------
    if (orderStatus === 'CANCELLED') {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'DISQUALIFIED',
        status: 'DISQUALIFIED',
        isIdempotentSkip: false,
        isEligible: false,
        reason: 'Order has been cancelled. No commissions can be generated for cancelled orders.',
        orderStatus,
        paymentStatus,
        purchaserMemberId,
        businessVolume,
        commissionsCreated: 0,
        totalCommission: 0,
        recipients: [],
        skippedRecipients: [],
        processedAt: now,
      };
    }

    if (orderStatus === 'REFUNDED') {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'DISQUALIFIED',
        status: 'DISQUALIFIED',
        isIdempotentSkip: false,
        isEligible: false,
        reason: 'Order has been refunded. No commissions can be generated for refunded orders.',
        orderStatus,
        paymentStatus,
        purchaserMemberId,
        businessVolume,
        commissionsCreated: 0,
        totalCommission: 0,
        recipients: [],
        skippedRecipients: [],
        processedAt: now,
      };
    }

    // ------------------------------------------------------------------------
    // STAGE 2: PAYMENT PENDING CHECK
    // "Do not generate commission merely because an order record was created."
    // ------------------------------------------------------------------------
    const isPaymentCompleted =
      paymentStatus === 'COMPLETED' ||
      Boolean(order.paidAt) ||
      ['PAID', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(orderStatus);

    if (!isPaymentCompleted) {
      logger.info(
        { orderId: cleanOrderId, orderStatus, paymentStatus },
        'processOrderCommission: Payment is not yet completed. Holding commission generation.'
      );

      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'PAYMENT_PENDING',
        status: 'PENDING_STAGE',
        isIdempotentSkip: false,
        isEligible: false,
        reason: `Payment is pending (Order Status: ${orderStatus}, Payment Status: ${paymentStatus}). Commission generation requires successful payment.`,
        orderStatus,
        paymentStatus,
        purchaserMemberId,
        businessVolume,
        commissionsCreated: 0,
        totalCommission: 0,
        recipients: [],
        skippedRecipients: [],
        processedAt: now,
      };
    }

    // ------------------------------------------------------------------------
    // STAGE 3: PAYMENT SUCCESSFUL CONFIRMED
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // STAGE 4: ORDER COMMISSION ELIGIBLE (Business Trigger Policy Evaluation)
    // "If the business requires commission only after delivery/approval, respect that rule."
    // "Do not assume payment success automatically means commission is final."
    // ------------------------------------------------------------------------
    const effectiveTriggerPolicy: CommissionTriggerPolicy =
      options?.triggerOverride ||
      (this.config.requireDelivery ? 'ORDER_DELIVERED' : this.config.triggerPolicy);

    if (effectiveTriggerPolicy === 'ORDER_DELIVERED') {
      if (orderStatus !== 'DELIVERED') {
        logger.info(
          { orderId: cleanOrderId, orderStatus, triggerPolicy: effectiveTriggerPolicy },
          'processOrderCommission: Business rule requires ORDER_DELIVERED before commission distribution.'
        );

        return {
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          lifecycleStage: 'ORDER_COMMISSION_ELIGIBLE',
          status: 'PENDING_STAGE',
          isIdempotentSkip: false,
          isEligible: false,
          reason: `Commission policy is configured for 'ORDER_DELIVERED'. Order is currently in '${orderStatus}' status. Commission will be generated once the order is delivered.`,
          orderStatus,
          paymentStatus,
          purchaserMemberId,
          businessVolume,
          commissionsCreated: 0,
          totalCommission: 0,
          recipients: [],
          skippedRecipients: [],
          processedAt: now,
        };
      }
    } else if (effectiveTriggerPolicy === 'MANUAL_APPROVAL') {
      if (orderStatus !== 'CONFIRMED' && orderStatus !== 'DELIVERED') {
        logger.info(
          { orderId: cleanOrderId, orderStatus, triggerPolicy: effectiveTriggerPolicy },
          'processOrderCommission: Business rule requires MANUAL_APPROVAL before commission distribution.'
        );

        return {
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          lifecycleStage: 'ORDER_COMMISSION_ELIGIBLE',
          status: 'PENDING_STAGE',
          isIdempotentSkip: false,
          isEligible: false,
          reason: `Commission policy is configured for 'MANUAL_APPROVAL'. Order status must be explicitly CONFIRMED or DELIVERED (current status: '${orderStatus}').`,
          orderStatus,
          paymentStatus,
          purchaserMemberId,
          businessVolume,
          commissionsCreated: 0,
          totalCommission: 0,
          recipients: [],
          skippedRecipients: [],
          processedAt: now,
        };
      }
    }

    // ------------------------------------------------------------------------
    // STAGE 5: BV CONFIRMED
    // Verify order has positive commissionable Business Volume
    // ------------------------------------------------------------------------
    const authoritativeBV = await AuthoritativeBVService.getAuthoritativeOrderBV(
      cleanOrderId,
      db
    );
    const confirmedBVNumber = authoritativeBV.toNumber();

    if (confirmedBVNumber <= 0) {
      logger.info(
        { orderId: cleanOrderId, bv: confirmedBVNumber },
        'processOrderCommission: Order has zero commissionable Business Volume.'
      );

      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'BV_CONFIRMED',
        status: 'NOT_ELIGIBLE',
        isIdempotentSkip: false,
        isEligible: false,
        reason: 'Order has zero commissionable Business Volume (BV <= 0). No commissions generated.',
        orderStatus,
        paymentStatus,
        purchaserMemberId,
        businessVolume: 0,
        commissionsCreated: 0,
        totalCommission: 0,
        recipients: [],
        skippedRecipients: [],
        processedAt: now,
      };
    }

    // ------------------------------------------------------------------------
    // STAGES 6 & 7: COMMISSION CALCULATED & COMMISSION POSTED
    // Execute atomic, transaction-safe posting via AtomicCommissionPostingService
    // ------------------------------------------------------------------------
    const effectiveHoldingDays =
      options?.holdingPeriodDays !== undefined
        ? options.holdingPeriodDays
        : this.config.holdingPeriodDays;

    const postingResult = await AtomicCommissionPostingService.postCommissionForOrder(
      cleanOrderId,
      {
        allowUnpaid: true, // We already validated payment and delivery rules above
        tx: options?.tx,
      }
    );

    // ------------------------------------------------------------------------
    // STAGE 8: COMMISSION AVAILABLE (or PENDING if holding period is active)
    // ------------------------------------------------------------------------
    let availableAt: Date | null = now;
    let finalStage: OrderCommissionLifecycleStage = 'COMMISSION_AVAILABLE';

    if (effectiveHoldingDays > 0) {
      availableAt = new Date(now.getTime() + effectiveHoldingDays * 24 * 60 * 60 * 1000);
      finalStage = 'COMMISSION_POSTED'; // Posted but subject to holding period before AVAILABLE
    }

    logger.info(
      {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: finalStage,
        commissionsCreated: postingResult.commissionsCreated,
        totalCommission: postingResult.totalCommission,
        availableAt,
      },
      'processOrderCommission: Order commission lifecycle completed successfully.'
    );

    return {
      orderId: cleanOrderId,
      orderNumber: order.orderNumber,
      lifecycleStage: finalStage,
      status: 'SUCCESS',
      isIdempotentSkip: postingResult.status === 'ALREADY_POSTED',
      isEligible: true,
      orderStatus,
      paymentStatus,
      purchaserMemberId: postingResult.purchaserMemberId,
      businessVolume: postingResult.businessVolume,
      commissionsCreated: postingResult.commissionsCreated,
      totalCommission: postingResult.totalCommission,
      recipients: postingResult.recipients,
      skippedRecipients: postingResult.skippedRecipients,
      availableAt,
      processedAt: now,
    };
  }

  /**
   * Read-only inspection of the commission lifecycle status of an order.
   * Does NOT post or mutate data.
   */
  public static async getOrderCommissionLifecycleStatus(
    orderId: string,
    options?: { triggerPolicy?: CommissionTriggerPolicy; tx?: Prisma.TransactionClient }
  ): Promise<{
    orderId: string;
    orderNumber?: string;
    lifecycleStage: OrderCommissionLifecycleStage;
    isEligible: boolean;
    reason?: string;
    orderStatus: string;
    paymentStatus: string;
    businessVolume: number;
    hasExistingCommissions: boolean;
    existingCommissionsCount: number;
  }> {
    const cleanOrderId = (orderId || '').trim();
    const db = options?.tx || prisma;

    const order = await db.order.findUnique({
      where: { id: cleanOrderId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        commissionTransactions: true,
      },
    });

    if (!order) {
      throw AppError.notFound(`Order '${cleanOrderId}' not found`, 'ORDER_NOT_FOUND');
    }

    const activePayment = order.payments[0] || null;
    const paymentStatus = activePayment ? activePayment.status : 'NO_PAYMENT_RECORD';
    const orderStatus = order.status;
    const bv = Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0);
    const existingCount = order.commissionTransactions.length;

    if (existingCount > 0) {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'COMMISSION_AVAILABLE',
        isEligible: true,
        reason: 'Commissions have already been generated and posted.',
        orderStatus,
        paymentStatus,
        businessVolume: bv,
        hasExistingCommissions: true,
        existingCommissionsCount: existingCount,
      };
    }

    if (orderStatus === 'CANCELLED' || orderStatus === 'REFUNDED') {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'DISQUALIFIED',
        isEligible: false,
        reason: `Order is in '${orderStatus}' status. Disqualified from commissions.`,
        orderStatus,
        paymentStatus,
        businessVolume: bv,
        hasExistingCommissions: false,
        existingCommissionsCount: 0,
      };
    }

    const isPaymentCompleted =
      paymentStatus === 'COMPLETED' ||
      Boolean(order.paidAt) ||
      ['PAID', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(orderStatus);

    if (!isPaymentCompleted) {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'PAYMENT_PENDING',
        isEligible: false,
        reason: 'Payment has not been completed yet.',
        orderStatus,
        paymentStatus,
        businessVolume: bv,
        hasExistingCommissions: false,
        existingCommissionsCount: 0,
      };
    }

    const policy = options?.triggerPolicy || this.config.triggerPolicy;
    if (policy === 'ORDER_DELIVERED' && orderStatus !== 'DELIVERED') {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'ORDER_COMMISSION_ELIGIBLE',
        isEligible: false,
        reason: `Commission policy requires order to be DELIVERED (current status: '${orderStatus}').`,
        orderStatus,
        paymentStatus,
        businessVolume: bv,
        hasExistingCommissions: false,
        existingCommissionsCount: 0,
      };
    }

    if (bv <= 0) {
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        lifecycleStage: 'BV_CONFIRMED',
        isEligible: false,
        reason: 'Order has zero commissionable Business Volume.',
        orderStatus,
        paymentStatus,
        businessVolume: 0,
        hasExistingCommissions: false,
        existingCommissionsCount: 0,
      };
    }

    return {
      orderId: cleanOrderId,
      orderNumber: order.orderNumber,
      lifecycleStage: 'ORDER_COMMISSION_ELIGIBLE',
      isEligible: true,
      reason: 'Order is ready and eligible for commission processing.',
      orderStatus,
      paymentStatus,
      businessVolume: bv,
      hasExistingCommissions: false,
      existingCommissionsCount: 0,
    };
  }
}

/**
 * Top-level authoritative export matching Prompt 21 specification:
 * processOrderCommission(orderId)
 */
export const processOrderCommission = OrderCommissionLifecycleService.processOrderCommission.bind(
  OrderCommissionLifecycleService
);
