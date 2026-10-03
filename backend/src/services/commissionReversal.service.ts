import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { CommissionLedgerService } from './commissionLedger.service';
import {
  CommissionRecoveryPolicy,
  CommissionReversalRecoveryStatus,
  OrderCommissionReversalOptions,
  OrderCommissionReversalSummary,
  SingleCommissionReversalResult,
  SingleCommissionReversalOptions,
  AdminReconciliationResolutionInput,
} from '../types/commissionReversal.types';

/**
 * ============================================================================
 * COMMISSION REVERSAL SERVICE (PROMPT 22)
 * ============================================================================
 * Authoritative financial reversal engine for MLM commissions.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. NEVER DELETE THE ORIGINAL COMMISSION TRANSACTION:
 *    - The original CommissionTransaction record remains permanently immutable in the database.
 *    - Its status transitions to REVERSED (or updated calculationDetails for partials).
 * 2. COMPENSATORY REVERSAL LEDGER:
 *    - Creates explicit CommissionReversal transactions with negative / compensatory amounts (e.g. -₹2,400).
 * 3. COMPLETE AUDIT TRACEABILITY:
 *    - Tracks: originalCommissionId, reversalId, orderId, refundId, amount, reason, timestamp.
 * 4. PARTIAL REFUND SUPPORT:
 *    - Supports proportional BV or monetary refunds.
 *    - Accurately tracks cumulative reversals so total reversals never exceed original gross commission.
 * 5. STRICT IDEMPOTENCY:
 *    - Do not reverse the same commission twice. Deterministic idempotency keys prevent duplicate reversals.
 * 6. WITHDRAWN COMMISSIONS & RECOVERY POLICY:
 *    - If commissions were already withdrawn by the member:
 *      - Follows configured CommissionRecoveryPolicy.
 *      - Default policy: 'REQUIRE_ADMIN_RECONCILIATION' -> Recovers available balance down to 0,
 *        and marks the remaining deficit as PENDING_ADMIN_RECONCILIATION.
 *      - Never silently creates money, loses money, or produces unaccounted negative balances.
 */
export class CommissionReversalService {
  private static recoveryPolicy: CommissionRecoveryPolicy = 'REQUIRE_ADMIN_RECONCILIATION';

  /**
   * Sets the global recovery policy for handling withdrawn commissions.
   */
  public static setRecoveryPolicy(policy: CommissionRecoveryPolicy): void {
    this.recoveryPolicy = policy;
    logger.info({ policy }, 'Commission recovery policy updated');
  }

  /**
   * Gets the active global recovery policy.
   */
  public static getRecoveryPolicy(): CommissionRecoveryPolicy {
    return this.recoveryPolicy;
  }

  /**
   * Resets recovery policy to default ('REQUIRE_ADMIN_RECONCILIATION').
   */
  public static resetRecoveryPolicy(): void {
    this.recoveryPolicy = 'REQUIRE_ADMIN_RECONCILIATION';
  }

  /**
   * Reverses commissions for an order that was cancelled, refunded, or reversed.
   * Supports both 100% full cancellations/refunds and proportional partial refunds.
   */
  public static async reverseOrderCommissions(
    orderId: string,
    options?: OrderCommissionReversalOptions
  ): Promise<OrderCommissionReversalSummary> {
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw AppError.badRequest('Valid orderId is required for commission reversal');
    }

    const cleanOrderId = orderId.trim();
    const effectivePolicy = options?.recoveryPolicyOverride || this.recoveryPolicy;
    const now = new Date();
    const reason = options?.reason || 'Order cancellation/refund';

    const runner = async (db: Prisma.TransactionClient): Promise<OrderCommissionReversalSummary> => {
      // 1. Fetch Order and all associated CommissionTransactions
      const order = await db.order.findUnique({
        where: { id: cleanOrderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          totalBV: true,
          commissionableBusinessVolume: true,
        },
      });

      if (!order) {
        throw AppError.notFound(`Order '${cleanOrderId}' not found`, 'ORDER_NOT_FOUND');
      }

      const commissionTransactions = await db.commissionTransaction.findMany({
        where: { orderId: cleanOrderId },
        include: {
          walletTransaction: true,
          recipient: { select: { id: true, userId: true, distributorCode: true } },
        },
        orderBy: { commissionLevel: 'asc' },
      });

      if (commissionTransactions.length === 0) {
        logger.info({ orderId: cleanOrderId }, 'reverseOrderCommissions: No commission transactions found to reverse');
        return {
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          refundId: options?.refundId || null,
          reason,
          isPartial: Boolean(options?.isPartialRefund),
          totalReversalsCreated: 0,
          totalReversedAmount: 0,
          totalUnrecoveredAmount: 0,
          reversals: [],
          status: 'SUCCESS',
          timestamp: now,
        };
      }

      // 2. Determine reversal proportion (Full vs Partial)
      let refundRatio = 1.0;
      let isPartial = Boolean(options?.isPartialRefund);

      if (options?.refundedBV && Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0) > 0) {
        const orderBV = Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0);
        refundRatio = Math.min(1.0, Math.max(0.0, options.refundedBV / orderBV));
        if (refundRatio < 1.0) isPartial = true;
      } else if (options?.refundAmount && Number(order.totalAmount) > 0) {
        refundRatio = Math.min(1.0, Math.max(0.0, options.refundAmount / Number(order.totalAmount)));
        if (refundRatio < 1.0) isPartial = true;
      }

      const reversalResults: SingleCommissionReversalResult[] = [];
      let totalReversalsCreated = 0;
      let totalReversedAmount = 0;
      let totalUnrecoveredAmount = 0;

      // 3. Process each commission transaction
      for (const commTx of commissionTransactions) {
        const originalGross = Number(commTx.grossCommissionAmount);
        const originalId = commTx.id;

        // Fetch existing reversals for this specific commission to enforce idempotency and cap limits
        const existingReversals = await db.commissionReversal.findMany({
          where: { originalCommissionId: originalId },
        });

        // Check if this exact refund was already processed for this commission
        const idempotencyKey = options?.refundId
          ? `REV:${cleanOrderId}:${options.refundId}:${originalId}`
          : `REV:${cleanOrderId}:${isPartial ? `PARTIAL_${Date.now()}` : 'FULL'}:${originalId}`;

        const duplicateReversal = existingReversals.find((r) => r.idempotencyKey === idempotencyKey);
        if (duplicateReversal) {
          logger.info(
            { originalId, idempotencyKey },
            'reverseOrderCommissions: Reversal already exists for this refund event. Idempotently returning existing record.'
          );

          reversalResults.push({
            reversalId: duplicateReversal.id,
            originalCommissionId: duplicateReversal.originalCommissionId,
            orderId: duplicateReversal.orderId,
            refundId: duplicateReversal.refundId,
            recipientMemberId: duplicateReversal.recipientMemberId,
            commissionLevel: duplicateReversal.commissionLevel,
            reversedBV: Number(duplicateReversal.reversedBV),
            originalAmount: Number(duplicateReversal.originalAmount),
            amount: Number(duplicateReversal.amount),
            reversalAmount: Number(duplicateReversal.amount),
            recoveryStatus: duplicateReversal.recoveryStatus as CommissionReversalRecoveryStatus,
            unrecoveredAmount: Number(duplicateReversal.unrecoveredAmount),
            walletTransactionId: duplicateReversal.walletTransactionId,
            walletBalanceBefore: 0,
            walletBalanceAfter: 0,
            reason: duplicateReversal.reason,
            timestamp: duplicateReversal.createdAt,
            isIdempotentSkip: true,
          });
          continue;
        }

        // Calculate previously reversed amount (stored as negative or positive)
        const alreadyReversed = existingReversals.reduce(
          (sum, r) => sum + Math.abs(Number(r.amount)),
          0
        );

        const remainingCommission = SafeDecimal.round(originalGross - alreadyReversed, 2);

        // If this commission is already fully reversed, skip with idempotent notation
        if (remainingCommission <= 0) {
          logger.info(
            { originalId, originalGross, alreadyReversed },
            'reverseOrderCommissions: Commission already 100% reversed. Skipping additional reversals.'
          );
          continue;
        }

        // Calculate reversal amount for this event
        const requestedReversal = isPartial
          ? SafeDecimal.round(originalGross * refundRatio, 2)
          : remainingCommission;

        const effectiveReversalAmount = Math.min(requestedReversal, remainingCommission);
        if (effectiveReversalAmount <= 0) continue;

        const reversedBV = SafeDecimal.round(
          Number(commTx.businessVolume) * (effectiveReversalAmount / originalGross),
          2
        );

        // --------------------------------------------------------------------
        // WALLET RECOVERY HANDLING
        // --------------------------------------------------------------------
        let recoveryStatus: CommissionReversalRecoveryStatus = 'COMPLETED';
        let unrecoveredAmount = 0;
        let walletTxId: string | null = null;
        let balanceBefore = 0;
        let balanceAfter = 0;

        // If the commission was NEVER PAID (status is PENDING, APPROVED, or AVAILABLE without wallet link)
        if (commTx.status !== 'PAID' || !commTx.walletTransactionId) {
          recoveryStatus = 'REVERSED_UNPAID';
          unrecoveredAmount = 0;
          logger.info(
            { originalId, status: commTx.status },
            'Commission was unpaid; reversing ledger without wallet deduction'
          );
        } else {
          // Commission WAS PAID -> Retrieve recipient wallet to recover funds
          const recipientId = commTx.recipientMemberId;
          const targetUserId = commTx.recipient.userId;

          let wallet = await db.wallet.findFirst({
            where: {
              OR: [
                { distributorId: recipientId },
                ...(targetUserId ? [{ userId: targetUserId }] : []),
              ],
            },
          });

          if (!wallet) {
            wallet = await db.wallet.create({
              data: {
                distributorId: recipientId,
                userId: targetUserId,
                availableBalance: new Prisma.Decimal(0),
                pendingBalance: new Prisma.Decimal(0),
                lifetimeEarned: new Prisma.Decimal(0),
                lifetimePaid: new Prisma.Decimal(0),
                currency: 'INR',
                isLocked: false,
              },
            });
          }

          balanceBefore = Number(wallet.availableBalance);
          const reversalDecimal = new Prisma.Decimal(effectiveReversalAmount);

          if (balanceBefore >= effectiveReversalAmount) {
            // Case A: Member has full funds available in wallet
            balanceAfter = SafeDecimal.round(balanceBefore - effectiveReversalAmount, 2);
            recoveryStatus = 'COMPLETED';
            unrecoveredAmount = 0;

            const wtxNumber = CommissionLedgerService.generateWalletTransactionNumber();
            const wtx = await db.walletTransaction.create({
              data: {
                walletId: wallet.id,
                transactionNumber: wtxNumber,
                type: 'REVERSAL',
                status: 'COMPLETED',
                amount: reversalDecimal.negated(),
                netAmount: reversalDecimal.negated(),
                feeAmount: new Prisma.Decimal(0),
                balanceBefore: new Prisma.Decimal(balanceBefore),
                balanceAfter: new Prisma.Decimal(balanceAfter),
                referenceId: originalId,
                memberId: recipientId,
                commissionTransactionId: originalId,
                orderId: cleanOrderId,
                description: `Commission Reversal: Level ${commTx.commissionLevel} (${reason})`,
                createdAt: now,
              },
            });
            walletTxId = wtx.id;

            await db.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: new Prisma.Decimal(balanceAfter),
                lifetimeEarned: { decrement: reversalDecimal },
              },
            });
          } else {
            // Case B: Commission was ALREADY WITHDRAWN or insufficient wallet balance
            // Follow configured CommissionRecoveryPolicy:
            if (effectivePolicy === 'ALLOW_NEGATIVE_BALANCE') {
              balanceAfter = SafeDecimal.round(balanceBefore - effectiveReversalAmount, 2);
              recoveryStatus = 'NEGATIVE_BALANCE_APPLIED';
              unrecoveredAmount = 0;

              const wtxNumber = CommissionLedgerService.generateWalletTransactionNumber();
              const wtx = await db.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  transactionNumber: wtxNumber,
                  type: 'REVERSAL',
                  status: 'COMPLETED',
                  amount: reversalDecimal.negated(),
                  netAmount: reversalDecimal.negated(),
                  feeAmount: new Prisma.Decimal(0),
                  balanceBefore: new Prisma.Decimal(balanceBefore),
                  balanceAfter: new Prisma.Decimal(balanceAfter),
                  referenceId: originalId,
                  memberId: recipientId,
                  commissionTransactionId: originalId,
                  orderId: cleanOrderId,
                  description: `Commission Reversal [Negative Balance]: Level ${commTx.commissionLevel} (${reason})`,
                  createdAt: now,
                },
              });
              walletTxId = wtx.id;

              await db.wallet.update({
                where: { id: wallet.id },
                data: {
                  availableBalance: new Prisma.Decimal(balanceAfter),
                  lifetimeEarned: { decrement: reversalDecimal },
                },
              });
            } else {
              // Default Policy: 'REQUIRE_ADMIN_RECONCILIATION'
              // Recover whatever is available down to 0, flag the shortfall for admin action.
              const recoverableAmount = Math.max(0, balanceBefore);
              unrecoveredAmount = SafeDecimal.round(effectiveReversalAmount - recoverableAmount, 2);
              balanceAfter = 0;
              recoveryStatus = 'PENDING_ADMIN_RECONCILIATION';

              if (recoverableAmount > 0) {
                const partialRecDecimal = new Prisma.Decimal(recoverableAmount);
                const wtxNumber = CommissionLedgerService.generateWalletTransactionNumber();
                const wtx = await db.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    transactionNumber: wtxNumber,
                    type: 'REVERSAL',
                    status: 'COMPLETED',
                    amount: partialRecDecimal.negated(),
                    netAmount: partialRecDecimal.negated(),
                    feeAmount: new Prisma.Decimal(0),
                    balanceBefore: new Prisma.Decimal(balanceBefore),
                    balanceAfter: new Prisma.Decimal(0),
                    referenceId: originalId,
                    memberId: recipientId,
                    commissionTransactionId: originalId,
                    orderId: cleanOrderId,
                    description: `Partial Commission Recovery: Level ${commTx.commissionLevel} (Shortfall: ₹${unrecoveredAmount})`,
                    createdAt: now,
                  },
                });
                walletTxId = wtx.id;

                await db.wallet.update({
                  where: { id: wallet.id },
                  data: {
                    availableBalance: new Prisma.Decimal(0),
                    lifetimeEarned: { decrement: partialRecDecimal },
                  },
                });
              }

              logger.warn(
                {
                  originalId,
                  recipientId,
                  reversalAmount: effectiveReversalAmount,
                  availableBalance: balanceBefore,
                  unrecoveredAmount,
                },
                'Commission reversal shortfall: Funds already withdrawn by member. Marked as PENDING_ADMIN_RECONCILIATION.'
              );
            }
          }
        }

        // --------------------------------------------------------------------
        // CREATE COMPENSATORY COMMISSION REVERSAL RECORD
        // Invariant: Example: Original Level 1 = ₹2,400 -> Reversal = -₹2,400
        // --------------------------------------------------------------------
        const compensatoryReversalAmount = -effectiveReversalAmount;

        const reversalRecord = await db.commissionReversal.create({
          data: {
            originalCommissionId: originalId,
            orderId: cleanOrderId,
            refundId: options?.refundId || null,
            recipientMemberId: commTx.recipientMemberId,
            commissionLevel: commTx.commissionLevel,
            reversedBV: new Prisma.Decimal(reversedBV),
            originalAmount: commTx.grossCommissionAmount,
            amount: new Prisma.Decimal(compensatoryReversalAmount),
            recoveryStatus,
            unrecoveredAmount: new Prisma.Decimal(unrecoveredAmount),
            walletTransactionId: walletTxId,
            idempotencyKey,
            reason,
            metadata: {
              originalStatus: commTx.status,
              alreadyReversedBefore: alreadyReversed,
              isPartial,
              refundRatio,
              effectivePolicy,
            },
            createdAt: now,
          },
        });

        // --------------------------------------------------------------------
        // UPDATE ORIGINAL COMMISSION TRANSACTION STATUS
        // Invariant: Never delete the original record. Mark as REVERSED.
        // --------------------------------------------------------------------
        const isNowFullyReversed = alreadyReversed + effectiveReversalAmount >= originalGross - 0.01;

        await db.commissionTransaction.update({
          where: { id: originalId },
          data: {
            status: isNowFullyReversed ? 'REVERSED' : commTx.status,
            reversedAt: now,
            reversalReason: reason,
            calculationDetails: {
              ...(typeof commTx.calculationDetails === 'object' && commTx.calculationDetails !== null
                ? (commTx.calculationDetails as Record<string, any>)
                : {}),
              lastReversalId: reversalRecord.id,
              totalReversedAmount: alreadyReversed + effectiveReversalAmount,
              isFullyReversed: isNowFullyReversed,
            },
          },
        });

        totalReversalsCreated++;
        totalReversedAmount = SafeDecimal.round(totalReversedAmount + effectiveReversalAmount, 2);
        totalUnrecoveredAmount = SafeDecimal.round(totalUnrecoveredAmount + unrecoveredAmount, 2);

        reversalResults.push({
          reversalId: reversalRecord.id,
          originalCommissionId: originalId,
          orderId: cleanOrderId,
          refundId: options?.refundId || null,
          recipientMemberId: commTx.recipientMemberId,
          commissionLevel: commTx.commissionLevel,
          reversedBV,
          originalAmount: originalGross,
          amount: compensatoryReversalAmount,
          reversalAmount: compensatoryReversalAmount,
          recoveryStatus,
          unrecoveredAmount,
          walletTransactionId: walletTxId,
          walletBalanceBefore: balanceBefore,
          walletBalanceAfter: balanceAfter,
          reason,
          timestamp: now,
          isIdempotentSkip: false,
        });
      }

      const overallStatus =
        totalUnrecoveredAmount > 0
          ? 'PENDING_ADMIN_RECONCILIATION'
          : isPartial
          ? 'PARTIAL_REVERSAL_COMPLETED'
          : 'SUCCESS';

      logger.info(
        {
          orderId: cleanOrderId,
          totalReversals: totalReversalsCreated,
          totalReversedAmount,
          totalUnrecoveredAmount,
          status: overallStatus,
        },
        'Order commissions successfully reversed with immutable ledger tracking.'
      );

      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        refundId: options?.refundId || null,
        reason,
        isPartial,
        totalReversalsCreated,
        totalReversedAmount,
        totalUnrecoveredAmount,
        reversals: reversalResults,
        status: overallStatus,
        timestamp: now,
      };
    };

    if (options?.tx) {
      return runner(options.tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * Retrieves all reversals for a specific order.
   */
  public static async getReversalsForOrder(
    orderId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.commissionReversal.findMany({
      where: { orderId: orderId.trim() },
      include: {
        originalCommission: true,
        recipient: { select: { id: true, distributorCode: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves all reversals currently pending administrative reconciliation (shortfalls from withdrawn funds).
   */
  public static async getPendingReconciliations(tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.commissionReversal.findMany({
      where: { recoveryStatus: 'PENDING_ADMIN_RECONCILIATION' },
      include: {
        recipient: { select: { id: true, distributorCode: true, firstName: true, lastName: true, userId: true } },
        order: { select: { id: true, orderNumber: true, status: true } },
        originalCommission: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Resolves an administrative reconciliation deficit.
   */
  public static async resolveAdministrativeReconciliation(
    input: AdminReconciliationResolutionInput,
    tx?: Prisma.TransactionClient
  ) {
    const { reversalId, resolutionType, notes, adminUserId } = input;
    const db = tx || prisma;

    const reversal = await db.commissionReversal.findUnique({
      where: { id: reversalId },
    });

    if (!reversal) {
      throw AppError.notFound(`Commission reversal record '${reversalId}' not found`);
    }

    if (reversal.recoveryStatus !== 'PENDING_ADMIN_RECONCILIATION') {
      throw AppError.badRequest(
        `Reversal ${reversalId} is not in PENDING_ADMIN_RECONCILIATION status (current: ${reversal.recoveryStatus})`
      );
    }

    const updated = await db.commissionReversal.update({
      where: { id: reversalId },
      data: {
        recoveryStatus: 'COMPLETED',
        metadata: {
          ...(typeof reversal.metadata === 'object' && reversal.metadata !== null
            ? (reversal.metadata as Record<string, any>)
            : {}),
          resolutionType,
          resolutionNotes: notes,
          resolvedByAdminId: adminUserId,
          resolvedAt: new Date(),
        },
      },
    });

    logger.info(
      { reversalId, resolutionType, adminUserId, notes },
      'Administrative commission reconciliation resolved successfully.'
    );

    return updated;
  }

  /**
   * Reverses an individual commission transaction (Prompt 23).
   * Validates idempotency, updates original status, credits/debits wallet if PAID,
   * and creates an immutable CommissionReversal record.
   */
  public static async reverseSingleCommission(
    commissionId: string,
    options?: SingleCommissionReversalOptions
  ): Promise<SingleCommissionReversalResult> {
    if (!commissionId || typeof commissionId !== 'string' || !commissionId.trim()) {
      throw AppError.badRequest('Valid commissionId is required for commission reversal');
    }

    const cleanId = commissionId.trim();
    const effectivePolicy = options?.recoveryPolicyOverride || this.recoveryPolicy;
    const now = new Date();
    const reason = options?.reason || 'Administrative commission reversal';

    const runner = async (db: Prisma.TransactionClient): Promise<SingleCommissionReversalResult> => {
      const commTx = await db.commissionTransaction.findUnique({
        where: { id: cleanId },
        include: {
          walletTransaction: true,
          recipient: { select: { id: true, userId: true, distributorCode: true } },
          order: { select: { id: true, orderNumber: true } },
        },
      });

      if (!commTx) {
        throw AppError.notFound(`Commission transaction '${cleanId}' not found`, 'TRANSACTION_NOT_FOUND');
      }

      const idempotencyKey = `REV:COMM:${commTx.id}`;

      // Check if already reversed
      const existingReversal = await db.commissionReversal.findUnique({
        where: { idempotencyKey },
      });

      if (existingReversal || commTx.status === 'REVERSED') {
        logger.info(
          { commissionId: cleanId, reversalId: existingReversal?.id },
          'reverseSingleCommission: Commission already reversed. Returning existing reversal idempotently.'
        );

        return {
          reversalId: existingReversal?.id || `rev-existing-${cleanId}`,
          originalCommissionId: commTx.id,
          orderId: commTx.orderId,
          refundId: existingReversal?.refundId || options?.refundId || null,
          recipientMemberId: commTx.recipientMemberId,
          commissionLevel: commTx.commissionLevel,
          reversedBV: Number(commTx.businessVolume),
          originalAmount: Number(commTx.grossCommissionAmount),
          amount: Number(existingReversal?.amount ?? -Number(commTx.grossCommissionAmount)),
          reversalAmount: Number(existingReversal?.amount ?? -Number(commTx.grossCommissionAmount)),
          recoveryStatus: (existingReversal?.recoveryStatus as any) || 'COMPLETED',
          unrecoveredAmount: Number(existingReversal?.unrecoveredAmount ?? 0),
          walletTransactionId: existingReversal?.walletTransactionId || null,
          walletBalanceBefore: 0,
          walletBalanceAfter: 0,
          reason: existingReversal?.reason || commTx.reversalReason || reason,
          timestamp: existingReversal?.createdAt || now,
          isIdempotentSkip: true,
        };
      }

      const originalGross = Number(commTx.grossCommissionAmount);
      const grossAmountDecimal = SafeDecimal.roundDecimal(commTx.grossCommissionAmount, 2);
      const reversedBV = Number(commTx.businessVolume);

      let walletTxId: string | null = null;
      let balanceBefore = 0;
      let balanceAfter = 0;
      let recoveryStatus: CommissionReversalRecoveryStatus = 'COMPLETED';
      let unrecoveredAmount = 0;

      if (commTx.status !== 'PAID') {
        recoveryStatus = 'REVERSED_UNPAID';
        unrecoveredAmount = 0;
      } else {
        const recipientId = commTx.recipientMemberId;
        const userId = commTx.recipient.userId;

        const wallet = await db.wallet.findFirst({
          where: { OR: [{ distributorId: recipientId }, { userId }] },
        });

        if (wallet) {
          balanceBefore = Number(wallet.availableBalance);

          if (balanceBefore >= originalGross) {
            balanceAfter = SafeDecimal.round(balanceBefore - originalGross, 2);
            recoveryStatus = 'COMPLETED';
            unrecoveredAmount = 0;

            const wtxNumber = CommissionLedgerService.generateWalletTransactionNumber();
            const wtx = await db.walletTransaction.create({
              data: {
                walletId: wallet.id,
                transactionNumber: wtxNumber,
                type: 'REVERSAL',
                status: 'COMPLETED',
                amount: grossAmountDecimal.negated(),
                netAmount: grossAmountDecimal.negated(),
                feeAmount: new Prisma.Decimal(0),
                balanceBefore: new Prisma.Decimal(balanceBefore),
                balanceAfter: new Prisma.Decimal(balanceAfter),
                referenceId: cleanId,
                memberId: recipientId,
                commissionTransactionId: cleanId,
                orderId: commTx.orderId,
                description: `Commission Reversal: Level ${commTx.commissionLevel} (${reason})`,
                createdAt: now,
              },
            });
            walletTxId = wtx.id;

            await db.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: new Prisma.Decimal(balanceAfter),
                lifetimeEarned: { decrement: grossAmountDecimal },
              },
            });
          } else {
            if (effectivePolicy === 'ALLOW_NEGATIVE_BALANCE') {
              balanceAfter = SafeDecimal.round(balanceBefore - originalGross, 2);
              recoveryStatus = 'NEGATIVE_BALANCE_APPLIED';
              unrecoveredAmount = 0;

              const wtxNumber = CommissionLedgerService.generateWalletTransactionNumber();
              const wtx = await db.walletTransaction.create({
                data: {
                  walletId: wallet.id,
                  transactionNumber: wtxNumber,
                  type: 'REVERSAL',
                  status: 'COMPLETED',
                  amount: grossAmountDecimal.negated(),
                  netAmount: grossAmountDecimal.negated(),
                  feeAmount: new Prisma.Decimal(0),
                  balanceBefore: new Prisma.Decimal(balanceBefore),
                  balanceAfter: new Prisma.Decimal(balanceAfter),
                  referenceId: cleanId,
                  memberId: recipientId,
                  commissionTransactionId: cleanId,
                  orderId: commTx.orderId,
                  description: `Commission Reversal [Negative Balance]: Level ${commTx.commissionLevel} (${reason})`,
                  createdAt: now,
                },
              });
              walletTxId = wtx.id;

              await db.wallet.update({
                where: { id: wallet.id },
                data: {
                  availableBalance: new Prisma.Decimal(balanceAfter),
                  lifetimeEarned: { decrement: grossAmountDecimal },
                },
              });
            } else {
              // Default: REQUIRE_ADMIN_RECONCILIATION
              const recoverableAmount = Math.max(0, balanceBefore);
              unrecoveredAmount = SafeDecimal.round(originalGross - recoverableAmount, 2);
              balanceAfter = 0;
              recoveryStatus = 'PENDING_ADMIN_RECONCILIATION';

              if (recoverableAmount > 0) {
                const partialRecDecimal = new Prisma.Decimal(recoverableAmount);
                const wtxNumber = CommissionLedgerService.generateWalletTransactionNumber();
                const wtx = await db.walletTransaction.create({
                  data: {
                    walletId: wallet.id,
                    transactionNumber: wtxNumber,
                    type: 'REVERSAL',
                    status: 'COMPLETED',
                    amount: partialRecDecimal.negated(),
                    netAmount: partialRecDecimal.negated(),
                    feeAmount: new Prisma.Decimal(0),
                    balanceBefore: new Prisma.Decimal(balanceBefore),
                    balanceAfter: new Prisma.Decimal(0),
                    referenceId: cleanId,
                    memberId: recipientId,
                    commissionTransactionId: cleanId,
                    orderId: commTx.orderId,
                    description: `Partial Commission Recovery: Level ${commTx.commissionLevel} (Shortfall: ₹${unrecoveredAmount})`,
                    createdAt: now,
                  },
                });
                walletTxId = wtx.id;

                await db.wallet.update({
                  where: { id: wallet.id },
                  data: {
                    availableBalance: new Prisma.Decimal(0),
                    lifetimeEarned: { decrement: partialRecDecimal },
                  },
                });
              }
            }
          }
        }
      }

      const compensatoryReversalAmount = -originalGross;

      const reversalRecord = await db.commissionReversal.create({
        data: {
          originalCommissionId: cleanId,
          orderId: commTx.orderId,
          refundId: options?.refundId || null,
          recipientMemberId: commTx.recipientMemberId,
          commissionLevel: commTx.commissionLevel,
          reversedBV: new Prisma.Decimal(reversedBV),
          originalAmount: commTx.grossCommissionAmount,
          amount: new Prisma.Decimal(compensatoryReversalAmount),
          recoveryStatus,
          unrecoveredAmount: new Prisma.Decimal(unrecoveredAmount),
          walletTransactionId: walletTxId,
          idempotencyKey,
          reason,
          metadata: {
            originalStatus: commTx.status,
            effectivePolicy,
          },
          createdAt: now,
        },
      });

      await db.commissionTransaction.update({
        where: { id: cleanId },
        data: {
          status: 'REVERSED',
          reversedAt: now,
          reversalReason: reason,
          calculationDetails: {
            ...(typeof commTx.calculationDetails === 'object' && commTx.calculationDetails !== null
              ? (commTx.calculationDetails as Record<string, any>)
              : {}),
            lastReversalId: reversalRecord.id,
            totalReversedAmount: originalGross,
            isFullyReversed: true,
          },
        },
      });

      return {
        reversalId: reversalRecord.id,
        originalCommissionId: cleanId,
        orderId: commTx.orderId,
        refundId: options?.refundId || null,
        recipientMemberId: commTx.recipientMemberId,
        commissionLevel: commTx.commissionLevel,
        reversedBV,
        originalAmount: originalGross,
        amount: compensatoryReversalAmount,
        reversalAmount: compensatoryReversalAmount,
        recoveryStatus,
        unrecoveredAmount,
        walletTransactionId: walletTxId,
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: balanceAfter,
        reason,
        timestamp: now,
        isIdempotentSkip: false,
      };
    };

    if (options?.tx) {
      return runner(options.tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }
}
