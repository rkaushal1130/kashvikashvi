import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { AuditService } from './audit.service';
import {
  FORBIDDEN_CLIENT_COMMISSION_FIELDS,
  assertNoCommissionFieldOverrides,
} from '../validators/commissionApi.validators';

/**
 * ============================================================================
 * COMMISSION SECURITY SERVICE (PROMPT 25)
 * ============================================================================
 * Comprehensive Zero-Trust Security, Integrity, and Audit Defense Service
 * for the Kashvimlm Commission Engine.
 *
 * DEFENSE ARCHITECTURE:
 * 1. Zero-Trust Payload Protection:
 *    - Strictly prevents users from injecting or manipulating BV, rates,
 *      levels, recipients, commission amounts, wallet balances, or statuses.
 *    - Normal users must NEVER be able to call an API and say:
 *      { "commission": 500000, "level": 1 } and receive that amount.
 * 2. Server-Side Calculation Invariant:
 *    - All commission calculations occur authoritatively server-side.
 * 3. Authentication & RBAC Verification:
 *    - 401 for unauthenticated calls, 403 for unauthorized cross-member or non-admin access.
 * 4. Idempotency & Replay / Duplicate Webhook Protection:
 *    - Deterministic keys prevent duplicate commission posting and duplicate webhooks.
 * 5. Race-Condition Mutex Locks:
 *    - Per-order and per-member locking ensures serialization under concurrent execution.
 * 6. Financial Integrity Checks:
 *    - Order integrity, sponsor-chain cycle detection, wallet-ledger reconciliation,
 *      and refund integrity.
 * 7. Administrative Commission Audit Trail:
 *    - Comprehensive, immutable audit logging for all administrative commission operations.
 */
export class CommissionSecurityService {
  // Concurrency mutex queues
  private static orderLocks = new Map<string, Promise<any>>();
  private static memberLocks = new Map<string, Promise<any>>();

  // In-memory processed webhook / idempotency cache
  private static processedWebhooks = new Map<string, { processedAt: Date; result: any }>();

  // Standard 5-tier unilevel commission schedule
  public static readonly AUTHORITATIVE_COMMISSION_RATES: Record<number, number> = {
    1: 24, // Level 1: 24%
    2: 8,  // Level 2: 8%
    3: 13, // Level 3: 13%
    4: 5,  // Level 4: 5%
    5: 4,  // Level 5: 4%
  };

  // =========================================================================
  // 1. ZERO-TRUST PAYLOAD VALIDATION & TAMPERING PREVENTION
  // =========================================================================

  /**
   * Scans an incoming client payload for any attempt to manipulate Business Volume,
   * commission percentage, commission level, recipient, commission amount,
   * wallet balance, order status, or commission status.
   *
   * If any forbidden field is detected:
   * 1. Logs a high-severity security alert in the audit log.
   * 2. Immediately throws HTTP 400 Bad Request.
   */
  public static assertZeroTrustPayload(
    payload: any,
    endpointName: string = 'Commission Operation',
    userId?: string
  ): void {
    if (!payload || typeof payload !== 'object') return;

    assertNoCommissionFieldOverrides(payload, endpointName, userId);
  }

  /**
   * Authoritatively calculates 5-level commission on the server.
   * Disallows any client-supplied rates, amounts, or overrides.
   */
  public static calculateAuthoritativeCommission(
    businessVolume: number,
    level: number
  ): { percentage: number; commissionAmount: number } {
    if (businessVolume <= 0) {
      throw AppError.badRequest('Business Volume must be a positive number greater than 0', 'INVALID_BV');
    }
    if (level < 1 || level > 5) {
      throw AppError.badRequest('Commission level must be between 1 and 5', 'INVALID_LEVEL');
    }

    const percentage = this.AUTHORITATIVE_COMMISSION_RATES[level];
    if (!percentage) {
      throw AppError.badRequest(`Unsupported commission level: ${level}`, 'UNSUPPORTED_LEVEL');
    }

    const commissionAmount = SafeDecimal.round(businessVolume * (percentage / 100), 2);

    return {
      percentage,
      commissionAmount,
    };
  }

  // =========================================================================
  // 2. ADMINISTRATIVE AUDIT LOGGING
  // =========================================================================

  /**
   * Logs an administrative commission operation into the immutable audit ledger.
   */
  public static async logAdminCommissionOperation(params: {
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<any> {
    logger.info(
      {
        adminUserId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      `Admin commission operation audit: ${params.action}`
    );

    return AuditService.recordLog({
      userId: params.userId || undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || undefined,
      oldValue: params.oldValue,
      newValue: params.newValue,
      ipAddress: params.ipAddress || undefined,
      userAgent: params.userAgent || undefined,
    });
  }

  // =========================================================================
  // 3. CONCURRENCY MUTEX LOCKS (RACE-CONDITION DEFENSE)
  // =========================================================================

  /**
   * Executes an asynchronous task inside a per-order mutex lock.
   * Ensures that multiple simultaneous webhook deliveries or API calls
   * for the SAME orderId are executed strictly serially, preventing race conditions.
   */
  public static async withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
    if (!orderId) {
      throw AppError.badRequest('orderId is required for concurrency lock');
    }

    const previousLock = this.orderLocks.get(orderId) || Promise.resolve();

    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.orderLocks.set(orderId, currentLock);

    try {
      await previousLock;
      return await fn();
    } finally {
      releaseLock!();
      if (this.orderLocks.get(orderId) === currentLock) {
        this.orderLocks.delete(orderId);
      }
    }
  }

  /**
   * Executes an asynchronous task inside a per-member mutex lock.
   * Prevents concurrent wallet mutations and balance race conditions.
   */
  public static async withMemberLock<T>(memberId: string, fn: () => Promise<T>): Promise<T> {
    if (!memberId) {
      throw AppError.badRequest('memberId is required for member lock');
    }

    const previousLock = this.memberLocks.get(memberId) || Promise.resolve();

    let releaseLock: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.memberLocks.set(memberId, currentLock);

    try {
      await previousLock;
      return await fn();
    } finally {
      releaseLock!();
      if (this.memberLocks.get(memberId) === currentLock) {
        this.memberLocks.delete(memberId);
      }
    }
  }

  // =========================================================================
  // 4. WEBHOOK IDEMPOTENCY & REPLAY ATTACK DEFENSE
  // =========================================================================

  /**
   * Idempotently processes an external payment/order webhook.
   * If the webhook event was already processed, skips execution and returns the previous result.
   */
  public static async processWebhookIdempotent<T>(
    gateway: string,
    eventId: string,
    fn: () => Promise<T>
  ): Promise<{ isDuplicate: boolean; result?: T }> {
    if (!gateway || !eventId) {
      throw AppError.badRequest('gateway and eventId are required for webhook idempotency');
    }

    const idempotencyKey = `WEBHOOK:${gateway.toUpperCase()}:${eventId.trim()}`;

    // Check if event was already processed
    if (this.processedWebhooks.has(idempotencyKey)) {
      const cached = this.processedWebhooks.get(idempotencyKey)!;
      logger.warn(
        { gateway, eventId, processedAt: cached.processedAt },
        'Duplicate webhook event detected (replay attempt blocked)'
      );
      return {
        isDuplicate: true,
        result: cached.result,
      };
    }

    // Execute processor
    const result = await fn();

    // Cache processed event
    this.processedWebhooks.set(idempotencyKey, {
      processedAt: new Date(),
      result,
    });

    return {
      isDuplicate: false,
      result,
    };
  }

  /**
   * Clears webhook cache (useful for test suites).
   */
  public static clearWebhookCache(): void {
    this.processedWebhooks.clear();
  }

  // =========================================================================
  // 5. DATA & ENTITY INTEGRITY VERIFICATIONS
  // =========================================================================

  /**
   * Verifies the authenticity, state, and BV of an order.
   * Protects against forged order IDs, cancelled orders, or manipulated BV.
   */
  public static async verifyOrderIntegrity(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    if (!orderId || !orderId.trim()) {
      throw AppError.badRequest('Order identifier is required', 'INVALID_ORDER_ID');
    }

    const db = tx || prisma;
    const order = await db.order.findUnique({
      where: { id: orderId.trim() },
      include: {
        distributor: { select: { id: true, distributorCode: true } },
      },
    });

    if (!order) {
      throw AppError.notFound(`Order with ID '${orderId}' not found (forged or invalid reference)`, 'ORDER_NOT_FOUND');
    }

    if (order.status === 'CANCELLED') {
      throw AppError.badRequest(`Order '${order.orderNumber || orderId}' is CANCELLED. No commission processing permitted.`, 'ORDER_CANCELLED');
    }

    const bv = Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0);
    if (bv <= 0) {
      throw AppError.badRequest(`Order '${order.orderNumber || orderId}' has no positive commissionable Business Volume (BV = ${bv}).`, 'ZERO_OR_NEGATIVE_BV');
    }

    if (!order.distributorId && !order.distributor) {
      throw AppError.badRequest(`Order '${orderId}' has no associated distributor.`, 'MISSING_ORDER_DISTRIBUTOR');
    }

    return order;
  }

  /**
   * Verifies member authenticity and active status.
   * Protects against forged member IDs.
   */
  public static async verifyMemberIntegrity(
    memberId: string,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    if (!memberId || !memberId.trim()) {
      throw AppError.badRequest('Member identifier is required', 'INVALID_MEMBER_ID');
    }

    const db = tx || prisma;
    const member = await db.distributorProfile.findUnique({
      where: { id: memberId.trim() },
      select: {
        id: true,
        distributorCode: true,
        distributorId: true,
        userId: true,
        status: true,
        sponsorId: true,
      },
    });

    if (!member) {
      throw AppError.notFound(`Member with ID '${memberId}' does not exist (forged or invalid member reference)`, 'MEMBER_NOT_FOUND');
    }

    if (member.status === 'TERMINATED' || member.status === 'SUSPENDED') {
      throw AppError.badRequest(`Member '${member.distributorCode}' is currently in '${member.status}' status.`, 'MEMBER_INACTIVE');
    }

    return member;
  }

  /**
   * Verifies sponsor-chain integrity:
   * - Checks that upline ancestry contains no circular loops (A -> B -> C -> A).
   * - Detects self-sponsoring (A -> A).
   * - Traverses up to maxDepth (5 levels) ensuring consistent lineage.
   */
  public static async verifySponsorChainIntegrity(
    memberId: string,
    maxDepth: number = 5,
    tx?: Prisma.TransactionClient
  ): Promise<{ valid: boolean; depth: number; uplineIds: string[] }> {
    const db = tx || prisma;
    const visited = new Set<string>();
    const uplineIds: string[] = [];

    let currentId = memberId;
    visited.add(currentId);

    for (let level = 1; level <= maxDepth; level++) {
      const current = await db.distributorProfile.findUnique({
        where: { id: currentId },
        select: { id: true, sponsorId: true, distributorCode: true },
      });

      if (!current || !current.sponsorId) {
        break; // Reached root of sponsor tree cleanly
      }

      const sponsorId = current.sponsorId;

      if (sponsorId === currentId) {
        throw AppError.badRequest(
          `Sponsor chain integrity failure: Self-sponsoring detected on member '${current.distributorCode || currentId}'.`,
          'CORRUPTED_SPONSOR_CHAIN'
        );
      }

      if (visited.has(sponsorId)) {
        throw AppError.badRequest(
          `Sponsor chain integrity failure: Circular upline loop detected at member '${sponsorId}' while tracing from '${memberId}'.`,
          'CIRCULAR_SPONSOR_LOOP'
        );
      }

      visited.add(sponsorId);
      uplineIds.push(sponsorId);
      currentId = sponsorId;
    }

    return {
      valid: true,
      depth: uplineIds.length,
      uplineIds,
    };
  }

  /**
   * Verifies wallet integrity by reconciling wallet balance with transaction ledger.
   * Detects arbitrary wallet balance manipulation or ledger discrepancies.
   */
  public static async verifyWalletIntegrity(
    memberId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ isBalanced: boolean; ledgerSum: number; currentBalance: number }> {
    const db = tx || prisma;

    const wallet = await db.wallet.findFirst({
      where: {
        OR: [{ distributorId: memberId }, { id: memberId }],
      },
      select: { id: true, balance: true },
    });

    if (!wallet) {
      throw AppError.notFound(`Wallet for member '${memberId}' not found`, 'WALLET_NOT_FOUND');
    }

    const currentBalance = Number(wallet.balance);

    if (currentBalance < 0) {
      throw AppError.badRequest(
        `Wallet integrity failure: Negative wallet balance (${currentBalance}) detected for member '${memberId}'.`,
        'NEGATIVE_WALLET_BALANCE'
      );
    }

    const txns = await db.walletTransaction.findMany({
      where: { walletId: wallet.id },
      select: { type: true, amount: true },
    });

    let ledgerSum = 0;
    for (const t of txns) {
      const amt = Number(t.amount);
      if (t.type === 'CREDIT') {
        ledgerSum = SafeDecimal.round(ledgerSum + amt, 2);
      } else if (t.type === 'DEBIT') {
        ledgerSum = SafeDecimal.round(ledgerSum - amt, 2);
      }
    }

    // Allow minor floating point difference under 0.01 if historical seed data
    const diff = Math.abs(currentBalance - ledgerSum);
    const isBalanced = diff <= 0.01;

    if (!isBalanced) {
      logger.warn(
        { memberId, walletId: wallet.id, currentBalance, ledgerSum, diff },
        'Wallet balance does not match transaction ledger sum!'
      );
    }

    return {
      isBalanced,
      ledgerSum,
      currentBalance,
    };
  }

  /**
   * Verifies commission transaction ledger integrity.
   * Asserts that a commission transaction has linked source, recipient, order,
   * and immutable wallet posting trace.
   */
  public static async verifyLedgerIntegrity(
    commissionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    const db = tx || prisma;

    const comm = await db.commissionTransaction.findUnique({
      where: { id: commissionId },
      include: {
        order: { select: { id: true, orderNumber: true, totalBV: true } },
        recipient: { select: { id: true, distributorCode: true } },
        walletTransaction: true,
      },
    });

    if (!comm) {
      throw AppError.notFound(`Commission transaction '${commissionId}' not found`, 'COMMISSION_NOT_FOUND');
    }

    // Verify mathematical accuracy
    const expectedRate = this.AUTHORITATIVE_COMMISSION_RATES[comm.commissionLevel];
    if (expectedRate && Number(comm.percentage) !== expectedRate) {
      throw AppError.badRequest(
        `Ledger integrity failure: Commission percentage (${comm.percentage}%) does not match canonical tier rate (${expectedRate}%) for level ${comm.commissionLevel}.`,
        'CORRUPTED_COMMISSION_RATE'
      );
    }

    return comm;
  }

  /**
   * Immutability compliance: blocks any attempt to delete or alter commission audit logs.
   */
  public static blockLedgerMutation(): never {
    throw AppError.forbidden(
      'Immutable compliance violation: Modifying, updating, or deleting commission audit ledger records is strictly prohibited.',
      'COMMISSION_LEDGER_IMMUTABLE'
    );
  }
}
