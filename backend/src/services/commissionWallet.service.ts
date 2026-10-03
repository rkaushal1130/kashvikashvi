import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { CommissionLedgerService } from './commissionLedger.service';
import {
  WalletCreditCommissionResult,
  WithdrawalEligibilityCheckResult,
  CommissionWalletReconciliationReport,
  ReconciliationDiscrepancy,
} from '../types/commissionWallet.types';
import { CommissionTransactionStatus } from '../types/commissionLedger.types';

/**
 * ============================================================================
 * COMMISSION WALLET INTEGRATION SERVICE (PROMPT 20)
 * ============================================================================
 * Integrates commission ledger transactions with the existing wallet architecture.
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. Every commission credit MUST have a corresponding formal WalletTransaction.
 * 2. Wallet transaction must include:
 *    - memberId
 *    - amount
 *    - type = COMMISSION
 *    - commissionTransactionId
 *    - orderId
 *    - description
 *    - status
 *    - createdAt
 * 3. Never allow direct client-side wallet balance modification.
 *    Wallet balance is derived exclusively from trusted backend transactions.
 * 4. Status Lifecycle & Withdrawal Eligibility:
 *    - Support: PENDING, APPROVED, AVAILABLE, PAID, REVERSED
 *    - Do not allow a PENDING commission to be withdrawn.
 *    - Do not allow a REVERSED commission to be withdrawn.
 * 5. Prevent duplicate wallet credits (idempotent, unique linkage).
 * 6. Use database transactions (atomic consistency).
 * 7. Full reconciliation audit checks between Commission Ledger and Wallet Ledger.
 */
export class CommissionWalletService {
  /**
   * Safely credits an eligible commission transaction to a distributor wallet.
   * Atomically creates WalletTransaction with all 8 Prompt 20 mandated fields
   * and updates wallet balances within a single database transaction.
   */
  public static async creditCommissionToWallet(
    commissionTransactionId: string,
    tx?: Prisma.TransactionClient
  ): Promise<WalletCreditCommissionResult> {
    if (!commissionTransactionId || !commissionTransactionId.trim()) {
      throw AppError.badRequest('Valid commissionTransactionId is required');
    }

    const cleanId = commissionTransactionId.trim();

    const runner = async (db: Prisma.TransactionClient): Promise<WalletCreditCommissionResult> => {
      // 1. Fetch CommissionTransaction with recipient and order details
      const commTx = await db.commissionTransaction.findUnique({
        where: { id: cleanId },
        include: {
          recipient: {
            select: { id: true, userId: true, distributorCode: true, firstName: true, lastName: true },
          },
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      });

      if (!commTx) {
        throw AppError.notFound(`Commission transaction ${cleanId} not found`);
      }

      // 2. Enforce status lifecycle invariants
      if (commTx.status === 'PENDING') {
        throw AppError.badRequest(
          `Cannot credit wallet for PENDING commission. Commission must first be APPROVED and cleared to AVAILABLE status.`
        );
      }

      if (commTx.status === 'REVERSED') {
        throw AppError.badRequest(
          `Cannot credit wallet for REVERSED commission transaction ${cleanId}.`
        );
      }

      if (commTx.status === 'CANCELLED') {
        throw AppError.badRequest(
          `Cannot credit wallet for CANCELLED commission transaction ${cleanId}.`
        );
      }

      // 3. Prevent duplicate wallet credits
      if (commTx.status === 'PAID') {
        throw AppError.badRequest(
          `Commission transaction ${cleanId} is already PAID. Duplicate wallet credit prevented.`
        );
      }

      if (commTx.walletTransactionId) {
        throw AppError.badRequest(
          `Commission transaction ${cleanId} already linked to wallet transaction ${commTx.walletTransactionId}. Duplicate credit prevented.`
        );
      }

      const grossAmountDecimal = SafeDecimal.roundDecimal(commTx.grossCommissionAmount, 2);
      const grossAmount = grossAmountDecimal.toNumber();
      if (grossAmount <= 0) {
        throw AppError.badRequest(`Commission amount must be positive (got ${grossAmount})`);
      }

      const recipientMemberId = commTx.recipientMemberId;
      const targetUserId = commTx.recipient.userId;

      // 4. Resolve or create recipient Wallet
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

      if (wallet.isLocked) {
        throw AppError.badRequest(`Recipient wallet ${wallet.id} is locked. Crediting cannot proceed.`);
      }

      // 5. Derive balances atomically
      const balanceBefore = SafeDecimal.roundDecimal(wallet.availableBalance, 2);
      const balanceAfter = balanceBefore.add(grossAmountDecimal);

      // 6. Create formal WalletTransaction including all Prompt 20 mandated fields:
      // - memberId
      // - amount
      // - type = COMMISSION
      // - commissionTransactionId
      // - orderId
      // - description
      // - status
      // - createdAt
      const transactionNumber = CommissionLedgerService.generateWalletTransactionNumber();
      const description = `Level ${commTx.commissionLevel} Commission (${commTx.percentage}%) from Order ${commTx.order.orderNumber}`;
      const now = new Date();

      const walletTx = await db.walletTransaction.create({
        data: {
          walletId: wallet.id,
          transactionNumber,
          type: 'COMMISSION',
          status: 'COMPLETED',
          amount: grossAmountDecimal,
          netAmount: grossAmountDecimal,
          feeAmount: new Prisma.Decimal(0),
          balanceBefore,
          balanceAfter,
          referenceId: commTx.id,
          memberId: recipientMemberId,
          commissionTransactionId: commTx.id,
          orderId: commTx.orderId,
          description,
          createdAt: now,
        },
      });

      // 7. Update Wallet balances
      await db.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
          lifetimeEarned: { increment: grossAmountDecimal },
        },
      });

      // 8. Update CommissionTransaction to PAID with link to wallet transaction
      await db.commissionTransaction.update({
        where: { id: commTx.id },
        data: {
          status: 'PAID',
          walletTransactionId: walletTx.id,
          paidAt: now,
          availableAt: commTx.availableAt || now,
        },
      });

      logger.info(
        {
          commissionTransactionId: commTx.id,
          walletTransactionId: walletTx.id,
          walletId: wallet.id,
          memberId: recipientMemberId,
          orderId: commTx.orderId,
          amount: grossAmount,
          balanceBefore: balanceBefore.toNumber(),
          balanceAfter: balanceAfter.toNumber(),
        },
        'Commission safely credited to wallet with full audit linkage.'
      );

      return {
        commissionTransactionId: commTx.id,
        walletTransactionId: walletTx.id,
        walletTransactionNumber: walletTx.transactionNumber,
        walletId: wallet.id,
        memberId: recipientMemberId,
        orderId: commTx.orderId,
        amount: grossAmount,
        balanceBefore: balanceBefore.toNumber(),
        balanceAfter: balanceAfter.toNumber(),
        type: 'COMMISSION',
        status: 'COMPLETED',
        createdAt: now,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * Validates withdrawal eligibility for a member's wallet.
   * Enforces rules:
   * - "Do not allow a PENDING commission to be withdrawn."
   * - "Do not allow a REVERSED commission to be withdrawn."
   * - Requested amount must be <= availableBalance.
   */
  public static async validateWithdrawalEligibility(
    memberId: string,
    requestedAmount: number,
    tx?: Prisma.TransactionClient
  ): Promise<WithdrawalEligibilityCheckResult> {
    const db = tx || prisma;
    const cleanMemberId = (memberId || '').trim();

    if (!cleanMemberId) {
      throw AppError.badRequest('Member ID is required for withdrawal eligibility check');
    }

    if (requestedAmount <= 0) {
      return {
        canWithdraw: false,
        memberId: cleanMemberId,
        walletId: '',
        requestedAmount,
        availableBalance: 0,
        pendingBalance: 0,
        pendingCommissionsTotal: 0,
        pendingCommissionsCount: 0,
        reversedCommissionsTotal: 0,
        reversedCommissionsCount: 0,
        reason: 'Requested withdrawal amount must be greater than zero',
      };
    }

    // 1. Resolve distributor and wallet
    const distributor = await db.distributorProfile.findFirst({
      where: {
        OR: [
          { id: cleanMemberId },
          { distributorId: cleanMemberId },
          { distributorCode: cleanMemberId },
        ],
      },
      select: { id: true, userId: true },
    });

    if (!distributor) {
      throw AppError.notFound(`Distributor member '${cleanMemberId}' not found`);
    }

    const wallet = await db.wallet.findFirst({
      where: {
        OR: [
          { distributorId: distributor.id },
          { userId: distributor.userId },
        ],
      },
    });

    if (!wallet) {
      return {
        canWithdraw: false,
        memberId: distributor.id,
        walletId: '',
        requestedAmount,
        availableBalance: 0,
        pendingBalance: 0,
        pendingCommissionsTotal: 0,
        pendingCommissionsCount: 0,
        reversedCommissionsTotal: 0,
        reversedCommissionsCount: 0,
        reason: 'Distributor wallet not found',
      };
    }

    if (wallet.isLocked) {
      return {
        canWithdraw: false,
        memberId: distributor.id,
        walletId: wallet.id,
        requestedAmount,
        availableBalance: Number(wallet.availableBalance),
        pendingBalance: Number(wallet.pendingBalance),
        pendingCommissionsTotal: 0,
        pendingCommissionsCount: 0,
        reversedCommissionsTotal: 0,
        reversedCommissionsCount: 0,
        reason: 'Wallet is locked. Withdrawals are temporarily suspended.',
      };
    }

    // 2. Audit PENDING commissions (must NOT be withdrawn)
    const pendingCommissions = await db.commissionTransaction.findMany({
      where: {
        recipientMemberId: distributor.id,
        status: 'PENDING',
      },
      select: { grossCommissionAmount: true },
    });

    const pendingTotal = SafeDecimal.round(
      pendingCommissions.reduce((sum, c) => sum + Number(c.grossCommissionAmount), 0),
      2
    );

    // 3. Audit REVERSED commissions (must NOT be withdrawn)
    const reversedCommissions = await db.commissionTransaction.findMany({
      where: {
        recipientMemberId: distributor.id,
        status: 'REVERSED',
      },
      select: { grossCommissionAmount: true },
    });

    const reversedTotal = SafeDecimal.round(
      reversedCommissions.reduce((sum, c) => sum + Number(c.grossCommissionAmount), 0),
      2
    );

    const availableBalance = Number(wallet.availableBalance);
    const pendingBalance = Number(wallet.pendingBalance);

    // 4. Withdrawal check
    if (requestedAmount > availableBalance) {
      return {
        canWithdraw: false,
        memberId: distributor.id,
        walletId: wallet.id,
        requestedAmount,
        availableBalance,
        pendingBalance,
        pendingCommissionsTotal: pendingTotal,
        pendingCommissionsCount: pendingCommissions.length,
        reversedCommissionsTotal: reversedTotal,
        reversedCommissionsCount: reversedCommissions.length,
        reason: `Insufficient available balance (Available: ₹${availableBalance.toFixed(2)}, Requested: ₹${requestedAmount.toFixed(2)}). Note: ₹${pendingTotal.toFixed(2)} in PENDING commissions cannot be withdrawn until cleared.`,
      };
    }

    return {
      canWithdraw: true,
      memberId: distributor.id,
      walletId: wallet.id,
      requestedAmount,
      availableBalance,
      pendingBalance,
      pendingCommissionsTotal: pendingTotal,
      pendingCommissionsCount: pendingCommissions.length,
      reversedCommissionsTotal: reversedTotal,
      reversedCommissionsCount: reversedCommissions.length,
    };
  }

  /**
   * Reconciles Commission Ledger records against Wallet Ledger transactions.
   * Detects:
   * 1. UNPOSTED_COMMISSION: Commission marked PAID but missing wallet transaction
   * 2. ORPHANED_WALLET_TRANSACTION: WalletTransaction references non-existent commission
   * 3. AMOUNT_MISMATCH: Commission gross amount != WalletTransaction net credit
   * 4. DUPLICATE_WALLET_CREDIT: Multiple wallet transactions credit the same commission
   * 5. RECIPIENT_MISMATCH: Wallet does not belong to recipientMemberId
   * 6. MISSING_REVERSAL_DEBIT: REVERSED commission without compensatory wallet debit
   */
  public static async reconcileCommissionAndWalletLedgers(
    options?: { memberId?: string; orderId?: string },
    tx?: Prisma.TransactionClient
  ): Promise<CommissionWalletReconciliationReport> {
    const db = tx || prisma;
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const now = new Date();

    const commWhere: Prisma.CommissionTransactionWhereInput = {
      ...(options?.memberId ? { recipientMemberId: options.memberId } : {}),
      ...(options?.orderId ? { orderId: options.orderId } : {}),
    };

    const walletTxWhere: Prisma.WalletTransactionWhereInput = {
      type: 'COMMISSION',
      ...(options?.memberId ? { memberId: options.memberId } : {}),
      ...(options?.orderId ? { orderId: options.orderId } : {}),
    };

    // 1. Fetch all CommissionTransactions in scope
    const commTransactions = await db.commissionTransaction.findMany({
      where: commWhere,
      include: {
        walletTransaction: true,
        recipient: { select: { id: true, userId: true, distributorCode: true } },
      },
    });

    // 2. Fetch all WalletTransactions in scope
    const walletTransactions = await db.walletTransaction.findMany({
      where: walletTxWhere,
      include: {
        wallet: { select: { id: true, distributorId: true, userId: true } },
      },
    });

    let totalPaidCommAmount = 0;
    let totalWalletCommAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let reversedCount = 0;

    // Map wallet transactions by commissionTransactionId / referenceId
    const walletTxByCommId = new Map<string, any[]>();
    for (const wtx of walletTransactions) {
      const commId = wtx.commissionTransactionId || wtx.referenceId;
      if (commId) {
        const list = walletTxByCommId.get(commId) || [];
        list.push(wtx);
        walletTxByCommId.set(commId, list);
      }
      totalWalletCommAmount = SafeDecimal.round(totalWalletCommAmount + Number(wtx.amount), 2);
    }

    // 3. Audit Commission Transactions
    for (const comm of commTransactions) {
      const grossAmount = Number(comm.grossCommissionAmount);

      if (comm.status === 'PAID') {
        paidCount++;
        totalPaidCommAmount = SafeDecimal.round(totalPaidCommAmount + grossAmount, 2);

        const linkedWtxs = walletTxByCommId.get(comm.id) || [];

        // Check 1: Missing wallet transaction
        if (linkedWtxs.length === 0) {
          discrepancies.push({
            type: 'UNPOSTED_COMMISSION',
            severity: 'CRITICAL',
            commissionTransactionId: comm.id,
            orderId: comm.orderId,
            memberId: comm.recipientMemberId,
            expectedAmount: grossAmount,
            description: `Commission ${comm.id} is marked PAID but has no corresponding WalletTransaction in wallet ledger`,
            detectedAt: now,
          });
          continue;
        }

        // Check 2: Duplicate wallet credits
        if (linkedWtxs.length > 1) {
          discrepancies.push({
            type: 'DUPLICATE_WALLET_CREDIT',
            severity: 'CRITICAL',
            commissionTransactionId: comm.id,
            orderId: comm.orderId,
            memberId: comm.recipientMemberId,
            expectedAmount: grossAmount,
            actualAmount: linkedWtxs.reduce((sum, w) => sum + Number(w.amount), 0),
            description: `Commission ${comm.id} has ${linkedWtxs.length} duplicate WalletTransactions credited`,
            detectedAt: now,
          });
        }

        const primaryWtx = linkedWtxs[0];

        // Check 3: Amount mismatch
        if (Math.abs(Number(primaryWtx.amount) - grossAmount) > 0.01) {
          discrepancies.push({
            type: 'AMOUNT_MISMATCH',
            severity: 'HIGH',
            commissionTransactionId: comm.id,
            walletTransactionId: primaryWtx.id,
            orderId: comm.orderId,
            memberId: comm.recipientMemberId,
            expectedAmount: grossAmount,
            actualAmount: Number(primaryWtx.amount),
            description: `Amount mismatch: Commission ledger has ₹${grossAmount.toFixed(2)}, but WalletTransaction has ₹${Number(primaryWtx.amount).toFixed(2)}`,
            detectedAt: now,
          });
        }

        // Check 4: Recipient mismatch
        const walletDistId = primaryWtx.wallet?.distributorId;
        const walletUserId = primaryWtx.wallet?.userId;
        if (
          walletDistId !== comm.recipientMemberId &&
          walletUserId !== comm.recipient.userId
        ) {
          discrepancies.push({
            type: 'RECIPIENT_MISMATCH',
            severity: 'CRITICAL',
            commissionTransactionId: comm.id,
            walletTransactionId: primaryWtx.id,
            orderId: comm.orderId,
            memberId: comm.recipientMemberId,
            description: `Recipient mismatch: Commission belongs to member ${comm.recipientMemberId}, but WalletTransaction credited wallet ${primaryWtx.walletId}`,
            detectedAt: now,
          });
        }
      } else if (comm.status === 'PENDING') {
        pendingCount++;
      } else if (comm.status === 'REVERSED') {
        reversedCount++;

        // Check 5: Reversal debit consistency
        // If commission had been paid, there must be a compensating REVERSAL WalletTransaction
        if (comm.walletTransactionId) {
          const revWtx = await db.walletTransaction.findFirst({
            where: {
              referenceId: comm.id,
              type: 'REVERSAL',
            },
          });

          if (!revWtx) {
            discrepancies.push({
              type: 'MISSING_REVERSAL_DEBIT',
              severity: 'HIGH',
              commissionTransactionId: comm.id,
              orderId: comm.orderId,
              memberId: comm.recipientMemberId,
              expectedAmount: grossAmount,
              description: `Commission ${comm.id} was REVERSED after payout, but missing compensating REVERSAL WalletTransaction debit`,
              detectedAt: now,
            });
          }
        }
      }
    }

    // 4. Audit Wallet Transactions for Orphans
    const commIdSet = new Set(commTransactions.map((c) => c.id));
    for (const wtx of walletTransactions) {
      const refCommId = wtx.commissionTransactionId || wtx.referenceId;
      if (refCommId && !commIdSet.has(refCommId)) {
        discrepancies.push({
          type: 'ORPHANED_WALLET_TRANSACTION',
          severity: 'HIGH',
          walletTransactionId: wtx.id,
          orderId: wtx.orderId || undefined,
          memberId: wtx.memberId || undefined,
          actualAmount: Number(wtx.amount),
          description: `WalletTransaction ${wtx.id} (type: COMMISSION) references non-existent commission record ${refCommId}`,
          detectedAt: now,
        });
      }
    }

    const criticalDiscrepancyCount = discrepancies.filter(
      (d) => d.severity === 'CRITICAL'
    ).length;

    const isReconciled = discrepancies.length === 0;

    logger.info(
      {
        totalCommissions: commTransactions.length,
        totalWalletTxs: walletTransactions.length,
        discrepancyCount: discrepancies.length,
        criticalCount: criticalDiscrepancyCount,
        isReconciled,
      },
      'Commission and Wallet Ledger reconciliation audit completed.'
    );

    return {
      auditedMemberId: options?.memberId,
      auditedOrderId: options?.orderId,
      totalCommissionTransactions: commTransactions.length,
      totalPaidCommissions: paidCount,
      totalPendingCommissions: pendingCount,
      totalReversedCommissions: reversedCount,
      totalWalletCommissionTransactions: walletTransactions.length,
      totalPaidCommissionAmount: totalPaidCommAmount,
      totalWalletCommissionAmount: totalWalletCommAmount,
      isReconciled,
      discrepancyCount: discrepancies.length,
      criticalDiscrepancyCount,
      discrepancies,
      auditedAt: now,
    };
  }
}
