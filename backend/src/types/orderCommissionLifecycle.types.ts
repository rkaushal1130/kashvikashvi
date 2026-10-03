import { Prisma } from '@prisma/client';
import { CommissionPostingRecipient, SkippedPostingRecipient } from './commissionPosting.types';

/**
 * Stages in the recommended commission order lifecycle (Prompt 21):
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
 */
export type OrderCommissionLifecycleStage =
  | 'ORDER_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_SUCCESSFUL'
  | 'ORDER_COMMISSION_ELIGIBLE'
  | 'BV_CONFIRMED'
  | 'COMMISSION_CALCULATED'
  | 'COMMISSION_POSTED'
  | 'COMMISSION_AVAILABLE'
  | 'DISQUALIFIED';

/**
 * Trigger policy defining at which order state commissions become eligible:
 * - PAYMENT_CONFIRMED: Eligible when payment is captured (status = PAID, CONFIRMED, DELIVERED)
 * - ORDER_DELIVERED: Eligible strictly after successful delivery (status = DELIVERED)
 * - MANUAL_APPROVAL: Eligible only after administrative approval/clearing
 */
export type CommissionTriggerPolicy =
  | 'PAYMENT_CONFIRMED'
  | 'ORDER_DELIVERED'
  | 'MANUAL_APPROVAL';

export interface OrderCommissionConfig {
  /**
   * The trigger point for when orders become eligible for commission distribution.
   * Default: 'PAYMENT_CONFIRMED'
   */
  triggerPolicy: CommissionTriggerPolicy;

  /**
   * Return window / holding period in days before commission becomes AVAILABLE.
   * Default: 0 (immediately available)
   */
  holdingPeriodDays: number;

  /**
   * Whether to automatically credit distributor wallets when commissions are posted.
   * Default: true
   */
  autoCreditWallet: boolean;

  /**
   * Flag indicating whether delivery confirmation is strictly required.
   * If true, triggerPolicy operates as 'ORDER_DELIVERED'.
   * Default: false
   */
  requireDelivery: boolean;
}

export interface OrderCommissionProcessingOptions {
  /**
   * Explicit override for trigger policy if evaluating under special business condition.
   */
  triggerOverride?: CommissionTriggerPolicy;

  /**
   * Custom holding period days override.
   */
  holdingPeriodDays?: number;

  /**
   * External transaction client if participating in a wider outer transaction.
   */
  tx?: Prisma.TransactionClient;
}

export type OrderCommissionProcessStatus =
  | 'SUCCESS'
  | 'ALREADY_PROCESSED'
  | 'PENDING_STAGE'
  | 'NOT_ELIGIBLE'
  | 'DISQUALIFIED'
  | 'FAILED';

export interface OrderCommissionProcessResult {
  orderId: string;
  orderNumber?: string;
  lifecycleStage: OrderCommissionLifecycleStage;
  status: OrderCommissionProcessStatus;
  isIdempotentSkip: boolean;
  isEligible: boolean;
  reason?: string;
  orderStatus: string;
  paymentStatus: string;
  purchaserMemberId?: string;
  businessVolume: number;
  commissionsCreated: number;
  totalCommission: number;
  recipients: CommissionPostingRecipient[];
  skippedRecipients: SkippedPostingRecipient[];
  availableAt?: Date | null;
  processedAt: Date;
}
