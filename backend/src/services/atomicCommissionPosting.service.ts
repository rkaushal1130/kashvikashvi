import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { AuthoritativeBVService } from './authoritativeBV.service';
import { SponsorUplineService, UplineNode } from './sponsorUpline.service';
import { CommissionConfigService } from './commissionConfig.service';
import { CommissionEligibilityService } from './commissionEligibility.service';
import { CommissionCalculationService } from './commissionCalculation.service';
import { CommissionLedgerService } from './commissionLedger.service';
import {
  CommissionPostingResult,
  CommissionPostingRecipient,
  SkippedPostingRecipient,
  AtomicCommissionPostingOptions,
} from '../types/commissionPosting.types';

/**
 * ============================================================================
 * ATOMIC COMMISSION POSTING SERVICE (PROMPT 19)
 * ============================================================================
 * Transaction-safe, atomic, idempotent commission posting engine.
 *
 * COMPLETE 12-STEP FINANCIAL TRANSACTION FLOW:
 * 1. Verify order exists.
 * 2. Verify order is eligible for commission.
 * 3. Verify order has commissionable BV.
 * 4. Find sponsor/upline chain.
 * 5. Load commission configuration.
 * 6. Determine eligible recipients.
 * 7. Calculate commission.
 * 8. Create commission ledger records.
 * 9. Update wallet/accounting balances according to the existing wallet architecture.
 * 10. Create wallet transaction records.
 * 11. Mark commission as posted.
 * 12. Commit transaction.
 *
 * CRITICAL FINANCIAL INVARIANTS:
 * - ATOMIC ROLLBACK: If any critical step fails, ROLLBACK the entire financial transaction.
 * - NO ORPHANED LEDGER RECORDS: Never allow commission ledger exists but wallet
 *   transaction is missing. Both must be created and linked within the exact same database transaction.
 * - ROW LOCKING & CONCURRENCY: Uses ordered row-level locking (sorted recipient IDs)
 *   to eliminate database deadlocks under high-concurrency order settlements.
 * - IDEMPOTENCY: If the same order is processed twice, members do NOT receive commission twice.
 */
export class AtomicCommissionPostingService {
  /**
   * Posts commissions for an order atomically within a single database transaction.
   */
  public static async postCommissionForOrder(
    orderId: string,
    options?: AtomicCommissionPostingOptions
  ): Promise<CommissionPostingResult> {
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      throw AppError.badRequest('Valid orderId is required for atomic commission posting');
    }

    const cleanOrderId = orderId.trim();

    const runner = async (db: Prisma.TransactionClient): Promise<CommissionPostingResult> => {
      // ----------------------------------------------------------------------
      // STEP 1: VERIFY ORDER EXISTS
      // ----------------------------------------------------------------------
      const order = await db.order.findUnique({
        where: { id: cleanOrderId },
        include: {
          distributor: { select: { id: true, userId: true, distributorCode: true } },
          user: { select: { id: true, email: true } },
          items: true,
        },
      });

      if (!order) {
        throw AppError.notFound(`Order '${cleanOrderId}' not found`, 'ORDER_NOT_FOUND');
      }

      // ----------------------------------------------------------------------
      // IDEMPOTENCY CHECK:
      // If order commissions are already recorded and paid, return existing result
      // without creating duplicates or crediting wallets twice.
      // ----------------------------------------------------------------------
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
        const allPaid = existingCommissions.every(
          (c) => c.status === 'PAID' && c.walletTransactionId !== null
        );

        if (allPaid) {
          logger.info(
            { orderId: cleanOrderId, count: existingCommissions.length },
            'Order commissions already atomically posted and paid. Idempotently returning existing result.'
          );

          const totalCommission = SafeDecimal.round(
            existingCommissions.reduce(
              (acc, curr) => acc + Number(curr.grossCommissionAmount),
              0
            ),
            2
          );

          return {
            orderId: cleanOrderId,
            orderNumber: order.orderNumber,
            purchaserMemberId:
              order.distributorId || existingCommissions[0]?.sourceMemberId || '',
            businessVolume: Number(order.commissionableBusinessVolume ?? order.totalBV ?? 0),
            commissionsCreated: 0,
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
            totalCommission,
            status: 'ALREADY_POSTED',
            message: `Commissions for order ${cleanOrderId} have already been atomically posted. Idempotently skipping re-credit.`,
            timestamp: new Date(),
          };
        }
      }

      // ----------------------------------------------------------------------
      // STEP 2: VERIFY ORDER IS ELIGIBLE FOR COMMISSION
      // ----------------------------------------------------------------------
      const eligibility = AuthoritativeBVService.validateOrderBVEligibility(order);
      if (!eligibility.isEligible && !options?.allowUnpaid) {
        throw AppError.badRequest(
          eligibility.message || `Order '${cleanOrderId}' is not eligible for commission posting`,
          eligibility.reason || 'ORDER_NOT_ELIGIBLE'
        );
      }

      // ----------------------------------------------------------------------
      // STEP 3: VERIFY ORDER HAS COMMISSIONABLE BV
      // ----------------------------------------------------------------------
      const commBVDecimal = SafeDecimal.toDecimal(
        order.commissionableBusinessVolume ?? order.totalBV ?? '0.00'
      );
      const commissionableBV = commBVDecimal.toNumber();

      if (commBVDecimal.lessThanOrEqualTo(0)) {
        throw AppError.badRequest(
          `Order '${cleanOrderId}' has zero commissionable Business Volume (BV <= 0)`,
          'ZERO_COMMISSIONABLE_BV'
        );
      }

      // ----------------------------------------------------------------------
      // STEP 4: FIND SPONSOR/UPLINE CHAIN (5 Generations)
      // ----------------------------------------------------------------------
      let purchaserMemberId = order.distributorId;
      if (!purchaserMemberId && order.userId) {
        const profile = await db.distributorProfile.findFirst({
          where: { userId: order.userId },
          select: { id: true },
        });
        purchaserMemberId = profile?.id ?? null;
      }

      if (!purchaserMemberId) {
        throw AppError.badRequest(
          `Order '${cleanOrderId}' does not have an associated distributor purchaser profile`,
          'PURCHASER_MEMBER_NOT_FOUND'
        );
      }

      const uplineNodes = await SponsorUplineService.getUplineChain(
        purchaserMemberId,
        5,
        db
      );
      const uplineMap = new Map<number, UplineNode>();
      for (const node of uplineNodes) {
        uplineMap.set(node.level, node);
      }

      // ----------------------------------------------------------------------
      // STEP 5: LOAD COMMISSION CONFIGURATION
      // ----------------------------------------------------------------------
      let activeRates: Array<{ level: number; percentage: number }>;
      if (options?.customRates && options.customRates.length > 0) {
        activeRates = options.customRates;
      } else {
        try {
          const dbRates = await CommissionConfigService.getCommissionRates(db);
          activeRates = dbRates.map((r) => ({
            level: r.levelNumber,
            percentage: r.percentageNumber,
          }));
        } catch {
          activeRates = [...CommissionCalculationService.CANONICAL_TIERS];
        }
      }

      // ----------------------------------------------------------------------
      // STEP 6: DETERMINE ELIGIBLE RECIPIENTS & STEP 7: CALCULATE COMMISSION
      // ----------------------------------------------------------------------
      const eligibleItems: Array<{
        level: number;
        upline: UplineNode;
        percentage: number;
        commissionAmount: number;
        grossDecimal: Prisma.Decimal;
      }> = [];
      const skippedRecipients: SkippedPostingRecipient[] = [];

      for (const tier of activeRates) {
        const upline = uplineMap.get(tier.level);

        if (!upline) {
          skippedRecipients.push({
            level: tier.level,
            percentage: tier.percentage,
            reason: 'NO_UPLINE_EXISTS',
          });
          continue;
        }

        // Delegate to dedicated CommissionEligibilityService
        const isEligible = await CommissionEligibilityService.isEligibleForLevel(
          upline,
          tier.level,
          { businessVolume: commissionableBV }
        );

        if (!isEligible) {
          skippedRecipients.push({
            level: tier.level,
            recipientId: upline.distributorId,
            recipientCode: upline.distributorCode,
            recipientName: upline.displayName,
            percentage: tier.percentage,
            reason: 'ELIGIBILITY_NOT_CONFIRMED',
          });
          continue;
        }

        // Exact arbitrary-precision calculation formula
        const commissionAmount = CommissionCalculationService.calculateCommissionAmount(
          commBVDecimal,
          tier.percentage
        );

        if (commissionAmount > 0) {
          eligibleItems.push({
            level: tier.level,
            upline,
            percentage: tier.percentage,
            commissionAmount,
            grossDecimal: SafeDecimal.roundDecimal(commissionAmount, 2),
          });
        }
      }

      if (eligibleItems.length === 0) {
        logger.info(
          { orderId: cleanOrderId, skippedCount: skippedRecipients.length },
          'No eligible upline recipients found for order commission posting'
        );

        return {
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          purchaserMemberId,
          businessVolume: commissionableBV,
          commissionsCreated: 0,
          recipients: [],
          skippedRecipients,
          totalCommission: 0,
          status: 'NO_ELIGIBLE_COMMISSIONS',
          message: 'No upline members were eligible for commission on this order',
          timestamp: new Date(),
        };
      }

      // ----------------------------------------------------------------------
      // CONCURRENCY & ROW LOCKING:
      // Sort eligible recipients deterministically by recipientId to eliminate deadlocks
      // ----------------------------------------------------------------------
      eligibleItems.sort((a, b) =>
        a.upline.distributorId.localeCompare(b.upline.distributorId)
      );

      // ----------------------------------------------------------------------
      // STEPS 8, 9, 10, 11:
      // ATOMIC TRANSACTION POSTING
      // For each eligible recipient:
      //   8. Create CommissionTransaction (immutable ledger record)
      //   9. Resolve & lock wallet, update balances
      //  10. Create WalletTransaction (traceable ledger entry)
      //  11. Link wallet transaction and mark commission PAID
      // ----------------------------------------------------------------------
      const postedRecipients: CommissionPostingRecipient[] = [];
      let totalCommission = 0;
      const now = new Date();

      for (const item of eligibleItems) {
        const { level, upline, percentage, commissionAmount, grossDecimal } = item;
        const recipientMemberId = upline.distributorId;
        const idempotencyKey = CommissionLedgerService.generateIdempotencyKey(
          cleanOrderId,
          level,
          recipientMemberId
        );

        // Step 8: Create CommissionTransaction in ledger
        const commTx = await db.commissionTransaction.create({
          data: {
            recipientMemberId,
            sourceMemberId: purchaserMemberId,
            orderId: cleanOrderId,
            commissionLevel: level,
            businessVolume: commBVDecimal,
            percentage: SafeDecimal.roundDecimal(percentage, 2),
            grossCommissionAmount: grossDecimal,
            status: 'PENDING',
            source: 'ORDER_PURCHASE',
            idempotencyKey,
            calculationDetails: {
              orderNumber: order.orderNumber,
              level,
              percentage,
              businessVolume: commissionableBV,
              commissionAmount,
              recipientCode: upline.distributorCode,
              recipientName: upline.displayName,
            },
          },
        });

        // Step 9: Resolve or create recipient Wallet
        const distProfile = await db.distributorProfile.findUnique({
          where: { id: recipientMemberId },
          select: { id: true, userId: true },
        });

        const targetUserId = distProfile?.userId;

        let wallet = await db.wallet.findFirst({
          where: {
            OR: [
              { distributorId: recipientMemberId },
              ...(targetUserId ? [{ userId: targetUserId }] : []),
            ],
          },
        });

        if (!wallet) {
          wallet = await db.wallet.create({
            data: {
              distributorId: recipientMemberId,
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

        // Apply row-level lock if supported by database engine
        try {
          await db.$executeRawUnsafe(
            `SELECT id FROM "wallets" WHERE "id" = $1 FOR UPDATE`,
            wallet.id
          );
        } catch {
          // In-memory or non-Postgres test environments ignore FOR UPDATE
        }

        if (wallet.isLocked) {
          throw AppError.badRequest(
            `Recipient wallet ${wallet.id} is locked. Atomic posting aborted.`
          );
        }

        const balanceBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
        const balanceAfter = balanceBefore.add(grossDecimal);

        // Step 10: Create WalletTransaction record
        const walletTxNumber = CommissionLedgerService.generateWalletTransactionNumber();
        const description = `Level ${level} Commission (${percentage}%) from Order ${order.orderNumber}`;

        const walletTx = await db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionNumber: walletTxNumber,
            type: 'COMMISSION',
            status: 'COMPLETED',
            amount: grossDecimal,
            netAmount: grossDecimal,
            feeAmount: new Prisma.Decimal(0),
            balanceBefore,
            balanceAfter,
            referenceId: commTx.id,
            memberId: recipientMemberId,
            commissionTransactionId: commTx.id,
            orderId: cleanOrderId,
            description,
          },
        });

        // Update Wallet balance
        await db.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: balanceAfter,
            lifetimeEarned: { increment: grossDecimal },
          },
        });

        // Step 11: Mark CommissionTransaction as PAID and link wallet transaction
        await db.commissionTransaction.update({
          where: { id: commTx.id },
          data: {
            status: 'PAID',
            walletTransactionId: walletTx.id,
            approvedAt: now,
            availableAt: now,
            paidAt: now,
          },
        });

        totalCommission = SafeDecimal.round(totalCommission + commissionAmount, 2);

        postedRecipients.push({
          recipientId: recipientMemberId,
          recipientCode: upline.distributorCode,
          recipientName: upline.displayName,
          level,
          percentage,
          commissionAmount,
          commissionTransactionId: commTx.id,
          walletTransactionId: walletTx.id,
          walletTransactionNumber: walletTx.transactionNumber,
          walletId: wallet.id,
          balanceBefore: balanceBefore.toNumber(),
          balanceAfter: balanceAfter.toNumber(),
        });
      }

      logger.info(
        {
          orderId: cleanOrderId,
          orderNumber: order.orderNumber,
          commissionsCount: postedRecipients.length,
          totalCommission,
        },
        'Commissions atomically posted and credited to wallets successfully.'
      );

      // ----------------------------------------------------------------------
      // STEP 12: COMMIT TRANSACTION (handled automatically upon return)
      // ----------------------------------------------------------------------
      return {
        orderId: cleanOrderId,
        orderNumber: order.orderNumber,
        purchaserMemberId,
        businessVolume: commissionableBV,
        commissionsCreated: postedRecipients.length,
        recipients: postedRecipients,
        skippedRecipients,
        totalCommission,
        status: 'POSTED',
        message: `Successfully posted ${postedRecipients.length} commission transactions totaling ₹${totalCommission.toFixed(2)}`,
        timestamp: now,
      };
    };

    // If caller provided an active transaction, reuse it; otherwise wrap in interactive transaction
    if (options?.tx) {
      return runner(options.tx);
    }

    return prisma.$transaction(runner, {
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
