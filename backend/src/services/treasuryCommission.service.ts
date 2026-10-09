import { Prisma, PlatformTransactionType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { PlatformTreasuryService } from './platformTreasury.service';
import { CommissionLedgerService } from './commissionLedger.service';
import {
  BatchFundCommissionsResult,
  CanonicalCommissionStatus,
  ExecutePayoutInput,
  ExecutePayoutResult,
  FundCommissionOptions,
  FundCommissionResult,
  PayoutEligibilityCheckResult,
  RecordEarnedCommissionInput,
  RecordEarnedCommissionResult,
  TreasuryReverseCommissionResult as ReverseCommissionResult,
  TreasuryCommissionAccountingSummary,
} from '../types/treasuryCommission.types';

/**
 * ============================================================================
 * TREASURY & MLM COMMISSION SYSTEM BRIDGE SERVICE (PROMPT 37)
 * ============================================================================
 *
 * Integrates the platform treasury with the existing MLM commission system.
 *
 * ARCHITECTURAL FLOW:
 * Platform Treasury
 *         ↓
 * Commission Funding/Reserve
 *         ↓
 * Member Commission
 *         ↓
 * Member Wallet
 *         ↓
 * Withdrawal
 *
 * CORE INVARIANTS:
 * 1. Treasury is the company's funding source (PlatformWallet).
 * 2. Member commissions are liabilities/payables of the platform.
 * 3. Never simply transfer money between database balances without paired ledger entries.
 * 4. Separate EARNED COMMISSION (legal member entitlement) from AVAILABLE PAYOUT FUNDS (funded liquidity).
 * 5. Low treasury funds MUST NEVER prevent commission earning or delete earned commissions.
 * 6. Proper 6-state lifecycle:
 *    EARNED -> APPROVED -> AVAILABLE -> PAYOUT_PENDING -> PAID / REVERSED
 * 7. Separate accounting concepts:
 *    - Treasury Reserve (cash set aside in company treasury)
 *    - Commission Payable (platform liability owed to members)
 * 8. Never mix company treasury balance with individual member wallet balances.
 */
export class TreasuryCommissionService {
  public static readonly DEFAULT_WALLET_CODE = 'PRIMARY_TREASURY';

  /**
   * Maps database CommissionTransactionStatus to Prompt 37 canonical statuses.
   */
  public static toCanonicalStatus(status: string): CanonicalCommissionStatus {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING') return 'EARNED';
    if (s === 'APPROVED') return 'APPROVED';
    if (s === 'AVAILABLE') return 'AVAILABLE';
    if (s === 'PAYOUT_PENDING') return 'PAYOUT_PENDING';
    if (s === 'PAID') return 'PAID';
    if (s === 'REVERSED') return 'REVERSED';
    return 'EARNED';
  }

  /**
   * Maps canonical status back to database-compatible Prisma status.
   */
  public static toDatabaseStatus(status: CanonicalCommissionStatus): 'PENDING' | 'APPROVED' | 'AVAILABLE' | 'PAID' | 'REVERSED' {
    switch (status) {
      case 'EARNED':
        return 'PENDING';
      case 'APPROVED':
        return 'APPROVED';
      case 'AVAILABLE':
        return 'AVAILABLE';
      case 'PAYOUT_PENDING':
        return 'AVAILABLE'; // Remains available in DB, held in member wallet pendingBalance
      case 'PAID':
        return 'PAID';
      case 'REVERSED':
        return 'REVERSED';
      default:
        return 'PENDING';
    }
  }

  /**
   * STEP 1: RECORD EARNED COMMISSION
   *
   * Registers a newly earned commission from sales/orders.
   *
   * CRITICAL INVARIANTS:
   * - Records member's legal entitlement (EARNED COMMISSION).
   * - Increases platform liability (Commission Payable).
   * - Does NOT require platform treasury cash to be present.
   * - Does NOT silently reject or delete commission if treasury is empty.
   * - Updates member's lifetime earned without falsely releasing available payout funds.
   */
  public static async recordEarnedCommission(
    input: RecordEarnedCommissionInput,
    existingTx?: Prisma.TransactionClient
  ): Promise<RecordEarnedCommissionResult> {
    const grossDecimal = SafeDecimal.roundDecimal(input.grossCommissionAmount, 2);
    if (grossDecimal.lessThanOrEqualTo(0)) {
      throw AppError.badRequest('Gross commission amount must be greater than zero', 'INVALID_AMOUNT');
    }

    const runner = async (db: Prisma.TransactionClient): Promise<RecordEarnedCommissionResult> => {
      const idempotencyKey =
        input.idempotencyKey ||
        CommissionLedgerService.generateIdempotencyKey(
          input.orderId,
          input.commissionLevel,
          input.recipientMemberId
        );

      // Check if commission already recorded
      const existing = await db.commissionTransaction.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        return {
          commissionId: existing.id,
          recipientMemberId: existing.recipientMemberId,
          orderId: existing.orderId,
          commissionLevel: existing.commissionLevel,
          grossCommissionAmount: SafeDecimal.round(existing.grossCommissionAmount, 2),
          status: this.toCanonicalStatus(existing.status),
          idempotencyKey: existing.idempotencyKey,
          isLiabilityRecorded: true,
          earnedAt: existing.createdAt,
          message: 'Commission already recorded (idempotent)',
        };
      }

      // Create immutable CommissionTransaction record in EARNED status (DB: PENDING)
      const commTx = await db.commissionTransaction.create({
        data: {
          recipientMemberId: input.recipientMemberId,
          sourceMemberId: input.sourceMemberId,
          orderId: input.orderId,
          commissionLevel: input.commissionLevel,
          businessVolume: SafeDecimal.roundDecimal(input.businessVolume, 2),
          percentage: SafeDecimal.roundDecimal(input.percentage, 2),
          grossCommissionAmount: grossDecimal,
          status: 'PENDING',
          source: input.source || 'ORDER_PURCHASE',
          idempotencyKey,
          calculationDetails: {
            ...(input.calculationDetails || {}),
            orderNumber: input.orderNumber,
            canonicalStatus: 'EARNED',
            accountingConcept: 'COMMISSION_PAYABLE_LIABILITY',
            earnedAt: new Date().toISOString(),
          },
        },
      });

      // Update recipient's member wallet lifetimeEarned (accounting for earned entitlement)
      // DO NOT increment availableBalance yet — funds are not yet reserved/funded!
      const distProfile = await db.distributorProfile.findUnique({
        where: { id: input.recipientMemberId },
        select: { id: true, userId: true },
      });

      if (distProfile) {
        let wallet = await db.wallet.findFirst({
          where: {
            OR: [
              { distributorId: distProfile.id },
              ...(distProfile.userId ? [{ userId: distProfile.userId }] : []),
            ],
          },
        });

        if (!wallet) {
          wallet = await db.wallet.create({
            data: {
              distributorId: distProfile.id,
              userId: distProfile.userId,
              availableBalance: new Prisma.Decimal(0),
              pendingBalance: new Prisma.Decimal(0),
              lifetimeEarned: grossDecimal,
              lifetimePaid: new Prisma.Decimal(0),
              currency: 'INR',
              isLocked: false,
            },
          });
        } else {
          await db.wallet.update({
            where: { id: wallet.id },
            data: {
              lifetimeEarned: { increment: grossDecimal },
            },
          });
        }
      }

      logger.info(
        {
          commissionId: commTx.id,
          recipientId: input.recipientMemberId,
          amount: grossDecimal.toFixed(2),
          status: 'EARNED',
        },
        'Commission earned and recorded as platform payable liability'
      );

      return {
        commissionId: commTx.id,
        recipientMemberId: commTx.recipientMemberId,
        orderId: commTx.orderId,
        commissionLevel: commTx.commissionLevel,
        grossCommissionAmount: SafeDecimal.round(commTx.grossCommissionAmount, 2),
        status: 'EARNED',
        idempotencyKey: commTx.idempotencyKey,
        isLiabilityRecorded: true,
        earnedAt: commTx.createdAt,
        message: 'Commission earned successfully. Recorded as platform payable liability.',
      };
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 2: FUND AND RESERVE COMMISSION FROM PLATFORM TREASURY
   *
   * Flow:
   * Platform Treasury -> Commission Funding/Reserve -> Member Wallet (Available Balance)
   *
   * INVARIANTS:
   * 1. Checks whether sufficient platform funds exist in Platform Treasury.
   * 2. If SUFFICIENT:
   *    - Earmarks funds from Treasury via PlatformWalletTransaction ('COMMISSION_RESERVE').
   *    - Creates Member WalletTransaction ('COMMISSION').
   *    - Credits member wallet availableBalance.
   *    - Transitions commission status to 'AVAILABLE'.
   * 3. If INSUFFICIENT:
   *    - Does NOT throw error or delete commission.
   *    - Preserves commission in 'EARNED' (or 'APPROVED').
   *    - Returns diagnostic detailing deferred status.
   */
  public static async fundAndReserveCommission(
    commissionId: string,
    options?: FundCommissionOptions,
    existingTx?: Prisma.TransactionClient
  ): Promise<FundCommissionResult> {
    if (!commissionId || !commissionId.trim()) {
      throw AppError.badRequest('Valid commissionId is required', 'COMMISSION_ID_REQUIRED');
    }

    const cleanCommissionId = commissionId.trim();
    const walletCode = options?.walletCode || this.DEFAULT_WALLET_CODE;

    const runner = async (db: Prisma.TransactionClient): Promise<FundCommissionResult> => {
      // 1. Resolve commission record
      const commission = await db.commissionTransaction.findUnique({
        where: { id: cleanCommissionId },
        include: {
          recipient: { select: { id: true, userId: true, distributorCode: true, displayName: true } },
          order: { select: { id: true, orderNumber: true } },
          walletTransaction: true,
        },
      });

      if (!commission) {
        throw AppError.notFound(`Commission record '${cleanCommissionId}' not found`, 'COMMISSION_NOT_FOUND');
      }

      const grossDecimal = SafeDecimal.roundDecimal(commission.grossCommissionAmount, 2);
      const grossAmount = grossDecimal.toNumber();
      const currentCanonical = this.toCanonicalStatus(commission.status);

      // Idempotency: Already funded & available or paid
      if (commission.status === 'AVAILABLE' || commission.status === 'PAID') {
        return {
          commissionId: commission.id,
          recipientMemberId: commission.recipientMemberId,
          grossAmount,
          previousStatus: currentCanonical,
          newStatus: currentCanonical,
          isFunded: true,
          platformTransactionId: (commission.calculationDetails as any)?.treasuryTransactionId,
          memberWalletTransactionId: commission.walletTransactionId || undefined,
          treasuryReservedAmount: grossAmount,
          reason: 'Commission is already funded and available',
          timestamp: new Date(),
        };
      }

      if (commission.status === 'REVERSED' || commission.status === 'CANCELLED') {
        throw AppError.badRequest(
          `Cannot fund a commission with status '${commission.status}'.`,
          'INVALID_STATUS_TRANSITION'
        );
      }

      // 2. Check Platform Treasury balance
      const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(walletCode, db);
      const treasuryAvailable = SafeDecimal.roundDecimal(treasuryWallet.availableBalance, 2);

      // Check if treasury has sufficient funds
      if (treasuryAvailable.lessThan(grossDecimal)) {
        logger.warn(
          {
            commissionId: commission.id,
            requiredAmount: grossDecimal.toFixed(2),
            treasuryAvailable: treasuryAvailable.toFixed(2),
          },
          'Treasury funds temporarily insufficient. Commission preserved in EARNED status awaiting replenishment.'
        );

        return {
          commissionId: commission.id,
          recipientMemberId: commission.recipientMemberId,
          grossAmount,
          previousStatus: currentCanonical,
          newStatus: 'EARNED',
          isFunded: false,
          treasuryReservedAmount: 0,
          reason: `Insufficient treasury available liquidity (${treasuryAvailable.toFixed(2)} ${treasuryWallet.currency} available vs ${grossDecimal.toFixed(2)} ${treasuryWallet.currency} required). Commission safely preserved in EARNED status.`,
          timestamp: new Date(),
        };
      }

      // 3. Treasury funds are sufficient -> Execute atomic transfer flow
      const now = new Date();
      const newTreasuryBalance = treasuryAvailable.sub(grossDecimal);
      const platformTxNumber = PlatformTreasuryService.generateTransactionNumber();
      const memberTxNumber = CommissionLedgerService.generateWalletTransactionNumber();

      // Step A: Earmark/Reserve from Platform Treasury (PlatformWalletTransaction)
      const platformTx = await db.platformWalletTransaction.create({
        data: {
          walletId: treasuryWallet.id,
          transactionNumber: platformTxNumber,
          type: 'COMMISSION_RESERVE',
          amount: grossDecimal,
          balanceBefore: treasuryAvailable,
          balanceAfter: newTreasuryBalance,
          referenceType: 'COMMISSION',
          referenceId: commission.id,
          status: 'COMPLETED',
          description: `Treasury reserve allocation for Commission ${commission.id} (Level ${commission.commissionLevel}, Order ${commission.order?.orderNumber || commission.orderId})`,
          metadata: {
            recipientMemberId: commission.recipientMemberId,
            orderId: commission.orderId,
            commissionLevel: commission.commissionLevel,
            accountingConcept: 'TREASURY_RESERVE_ALLOCATION',
          },
          performedById: options?.performedById || null,
        },
      });

      // Update PlatformWallet balance
      await db.platformWallet.update({
        where: { id: treasuryWallet.id },
        data: {
          availableBalance: newTreasuryBalance,
        },
      });

      // Step B: Resolve recipient Member Wallet
      const recipientDistributorId = commission.recipientMemberId;
      const targetUserId = commission.recipient?.userId;

      let memberWallet = await db.wallet.findFirst({
        where: {
          OR: [
            { distributorId: recipientDistributorId },
            ...(targetUserId ? [{ userId: targetUserId }] : []),
          ],
        },
      });

      if (!memberWallet) {
        memberWallet = await db.wallet.create({
          data: {
            distributorId: recipientDistributorId,
            userId: targetUserId,
            availableBalance: new Prisma.Decimal(0),
            pendingBalance: new Prisma.Decimal(0),
            lifetimeEarned: grossDecimal,
            lifetimePaid: new Prisma.Decimal(0),
            currency: 'INR',
            isLocked: false,
          },
        });
      }

      if (memberWallet.isLocked) {
        throw AppError.badRequest(
          `Recipient member wallet ${memberWallet.id} is locked. Cannot release payout funds.`,
          'WALLET_LOCKED'
        );
      }

      const memberBalanceBefore = SafeDecimal.roundDecimal(memberWallet.availableBalance, 2);
      const memberBalanceAfter = memberBalanceBefore.add(grossDecimal);

      // Step C: Create Member WalletTransaction
      const memberWalletTx = await db.walletTransaction.create({
        data: {
          walletId: memberWallet.id,
          transactionNumber: memberTxNumber,
          type: 'COMMISSION',
          status: 'COMPLETED',
          amount: grossDecimal,
          netAmount: grossDecimal,
          feeAmount: new Prisma.Decimal(0),
          balanceBefore: memberBalanceBefore,
          balanceAfter: memberBalanceAfter,
          referenceId: commission.id,
          memberId: recipientDistributorId,
          commissionTransactionId: commission.id,
          orderId: commission.orderId,
          description: `Commission Level ${commission.commissionLevel} funded from Treasury Reserve (Order ${commission.order?.orderNumber || commission.orderId})`,
        },
      });

      // Step D: Credit member wallet availableBalance
      await db.wallet.update({
        where: { id: memberWallet.id },
        data: {
          availableBalance: memberBalanceAfter,
        },
      });

      // Step E: Update CommissionTransaction status to AVAILABLE
      const existingDetails = (commission.calculationDetails as Record<string, any>) || {};
      await db.commissionTransaction.update({
        where: { id: commission.id },
        data: {
          status: 'AVAILABLE',
          approvedAt: commission.approvedAt || now,
          availableAt: now,
          walletTransactionId: memberWalletTx.id,
          calculationDetails: {
            ...existingDetails,
            canonicalStatus: 'AVAILABLE',
            treasuryTransactionId: platformTx.id,
            treasuryTransactionNumber: platformTx.transactionNumber,
            fundedAt: now.toISOString(),
          },
        },
      });

      logger.info(
        {
          commissionId: commission.id,
          recipientId: commission.recipientMemberId,
          amount: grossDecimal.toFixed(2),
          platformTxNumber,
          memberTxNumber,
        },
        'Commission funded and reserved from Platform Treasury to Member Wallet'
      );

      return {
        commissionId: commission.id,
        recipientMemberId: commission.recipientMemberId,
        grossAmount,
        previousStatus: currentCanonical,
        newStatus: 'AVAILABLE',
        isFunded: true,
        platformTransactionId: platformTx.id,
        platformTransactionNumber: platformTx.transactionNumber,
        memberWalletTransactionId: memberWalletTx.id,
        memberWalletTransactionNumber: memberWalletTx.transactionNumber,
        treasuryReservedAmount: grossAmount,
        reason: 'Commission successfully reserved from platform treasury and made available in member wallet',
        timestamp: now,
      };
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 3: BATCH COMMISSION FUNDING & RESERVING
   *
   * Iterates through pending/earned commissions (FIFO order).
   * Reserves and releases funds as far as current treasury cash permits.
   * Preserves any unfunded commissions without dropping or deleting them.
   */
  public static async batchFundCommissions(
    options?: FundCommissionOptions & { limit?: number }
  ): Promise<BatchFundCommissionsResult> {
    const limit = Math.min(100, Math.max(1, options?.limit || 50));
    const walletCode = options?.walletCode || this.DEFAULT_WALLET_CODE;

    // Fetch unreserved commissions in FIFO order
    const pendingCommissions = await prisma.commissionTransaction.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        walletTransactionId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const results: FundCommissionResult[] = [];
    let fundedCount = 0;
    let deferredCount = 0;
    let totalFundedAmount = 0;
    let totalDeferredAmount = 0;

    for (const comm of pendingCommissions) {
      try {
        const result = await this.fundAndReserveCommission(comm.id, options);
        results.push(result);

        if (result.isFunded) {
          fundedCount++;
          totalFundedAmount = SafeDecimal.round(totalFundedAmount + result.grossAmount, 2);
        } else {
          deferredCount++;
          totalDeferredAmount = SafeDecimal.round(totalDeferredAmount + result.grossAmount, 2);
        }
      } catch (err: any) {
        logger.error({ commissionId: comm.id, error: err.message }, 'Failed during batch funding step');
        deferredCount++;
        results.push({
          commissionId: comm.id,
          recipientMemberId: comm.recipientMemberId,
          grossAmount: SafeDecimal.round(comm.grossCommissionAmount, 2),
          previousStatus: this.toCanonicalStatus(comm.status),
          newStatus: this.toCanonicalStatus(comm.status),
          isFunded: false,
          treasuryReservedAmount: 0,
          reason: err.message,
          timestamp: new Date(),
        });
      }
    }

    const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(walletCode);
    const remainingTreasuryAvailable = SafeDecimal.round(treasuryWallet.availableBalance, 2);

    return {
      totalEvaluated: pendingCommissions.length,
      fundedCount,
      deferredCount,
      totalFundedAmount,
      totalDeferredAmount,
      remainingTreasuryAvailable,
      results,
      timestamp: new Date(),
    };
  }

  /**
   * STEP 4: CHECK PAYOUT ELIGIBILITY
   *
   * Before commission payout/withdrawal:
   * Checks whether sufficient platform funds exist according to project accounting rules.
   */
  public static async checkPayoutEligibility(
    payoutRequestId: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<PayoutEligibilityCheckResult> {
    const db = existingTx || prisma;

    const payout = await db.payoutRequest.findUnique({
      where: { id: payoutRequestId },
      include: {
        bankAccount: true,
        distributor: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!payout) {
      throw AppError.notFound(`Payout request '${payoutRequestId}' not found`, 'PAYOUT_NOT_FOUND');
    }

    const requestedAmount = SafeDecimal.round(payout.amount, 2);
    const blockers: string[] = [];
    const warnings: string[] = [];

    // 1. Check distributor status
    if (!payout.distributor) {
      blockers.push('Distributor profile not found');
    }

    // 2. Check bank account verification
    if (!payout.bankAccount || payout.bankAccount.status !== 'VERIFIED') {
      blockers.push('Designated bank account is not verified');
    }

    // 3. Check member wallet
    const memberWallet = payout.distributor?.wallet || (await db.wallet.findFirst({
      where: { distributorId: payout.distributorId },
    }));

    const memberAvailable = memberWallet ? SafeDecimal.round(memberWallet.availableBalance, 2) : 0;
    const memberPending = memberWallet ? SafeDecimal.round(memberWallet.pendingBalance, 2) : 0;

    if (!memberWallet) {
      blockers.push('Distributor wallet not found');
    } else if (memberWallet.isLocked) {
      blockers.push('Distributor wallet is locked');
    }

    // 4. Check Platform Treasury balance
    const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(this.DEFAULT_WALLET_CODE, db);
    const treasuryAvailable = SafeDecimal.round(treasuryWallet.availableBalance, 2);

    // Calculate total reserved across ledger
    const reserveAgg = await db.platformWalletTransaction.aggregate({
      where: {
        walletId: treasuryWallet.id,
        type: 'COMMISSION_RESERVE',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });
    const totalReservedEver = SafeDecimal.round(reserveAgg._sum.amount ?? 0, 2);

    // Platform cash check
    if (treasuryAvailable < requestedAmount) {
      blockers.push(
        `Insufficient platform treasury liquidity. Platform treasury has ${treasuryAvailable} ${treasuryWallet.currency}, requested payout is ${requestedAmount} ${treasuryWallet.currency}.`
      );
    }

    const isEligible = blockers.length === 0;

    return {
      isEligible,
      payoutRequestId: payout.id,
      distributorId: payout.distributorId,
      requestedAmount,
      memberAvailableBalance: memberAvailable,
      memberPendingBalance: memberPending,
      treasuryAvailableBalance: treasuryAvailable,
      treasuryReservedBalance: totalReservedEver,
      canPlatformDisburse: isEligible,
      blockers,
      warnings,
      checkedAt: new Date(),
    };
  }

  /**
   * STEP 5: EXECUTE PAYOUT WITH PLATFORM TREASURY DISBURSEMENT
   *
   * Flow:
   * Member Wallet (Pending Balance) -> Platform Treasury Disbursement -> PAID
   *
   * INVARIANTS:
   * 1. Checks platform liquidity before payout.
   * 2. Creates immutable PlatformWalletTransaction ('PAYOUT').
   * 3. Releases member pendingBalance and increments lifetimePaid.
   * 4. Updates associated commissions to 'PAID'.
   * 5. Sets PayoutRequest status to 'PAID'.
   */
  public static async executePayout(
    input: ExecutePayoutInput,
    existingTx?: Prisma.TransactionClient
  ): Promise<ExecutePayoutResult> {
    const { payoutId, adminUserId, referenceNumber, adminNotes } = input;
    const walletCode = input.walletCode || this.DEFAULT_WALLET_CODE;

    const runner = async (db: Prisma.TransactionClient): Promise<ExecutePayoutResult> => {
      // 1. Resolve PayoutRequest
      const payout = await db.payoutRequest.findUnique({
        where: { id: payoutId },
        include: {
          bankAccount: true,
          distributor: true,
        },
      });

      if (!payout) {
        throw AppError.notFound(`Payout request '${payoutId}' not found`, 'PAYOUT_NOT_FOUND');
      }

      if (payout.status === 'PAID') {
        throw AppError.badRequest('Payout is already marked as PAID', 'ALREADY_PAID');
      }

      if (payout.status === 'REJECTED' || payout.status === 'FAILED') {
        throw AppError.badRequest(`Cannot execute a payout with status '${payout.status}'`, 'INVALID_STATUS');
      }

      const amountDecimal = SafeDecimal.roundDecimal(payout.amount, 2);
      const netAmountDecimal = SafeDecimal.roundDecimal(payout.netAmount || payout.amount, 2);
      const feeAmountDecimal = SafeDecimal.roundDecimal(payout.fee || 0, 2);

      // 2. Verify platform treasury liquidity
      const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(walletCode, db);
      const treasuryBalanceBefore = SafeDecimal.roundDecimal(treasuryWallet.availableBalance, 2);

      if (treasuryBalanceBefore.lessThan(netAmountDecimal)) {
        throw AppError.badRequest(
          `Insufficient treasury liquidity for payout. Available: ${treasuryBalanceBefore.toFixed(2)} ${treasuryWallet.currency}, Required: ${netAmountDecimal.toFixed(2)} ${treasuryWallet.currency}`,
          'INSUFFICIENT_TREASURY_FUNDS'
        );
      }

      const treasuryBalanceAfter = treasuryBalanceBefore.sub(netAmountDecimal);
      const now = new Date();
      const platformTxNumber = PlatformTreasuryService.generateTransactionNumber();
      const memberTxNumber = CommissionLedgerService.generateWalletTransactionNumber();

      // 3. Create immutable PlatformWalletTransaction (PAYOUT)
      const platformTx = await db.platformWalletTransaction.create({
        data: {
          walletId: treasuryWallet.id,
          transactionNumber: platformTxNumber,
          type: 'PAYOUT',
          amount: netAmountDecimal,
          balanceBefore: treasuryBalanceBefore,
          balanceAfter: treasuryBalanceAfter,
          referenceType: 'PAYOUT',
          referenceId: payout.id,
          status: 'COMPLETED',
          description: `Disbursement for Payout #${payout.payoutNumber} to member ${payout.distributorId} (Ref: ${referenceNumber || 'N/A'})`,
          metadata: {
            payoutId: payout.id,
            payoutNumber: payout.payoutNumber,
            distributorId: payout.distributorId,
            grossAmount: amountDecimal.toNumber(),
            netAmount: netAmountDecimal.toNumber(),
            feeAmount: feeAmountDecimal.toNumber(),
            bankAccountId: payout.bankAccountId,
            adminUserId,
          },
          performedById: adminUserId,
        },
      });

      // Update PlatformWallet balance
      await db.platformWallet.update({
        where: { id: treasuryWallet.id },
        data: {
          availableBalance: treasuryBalanceAfter,
        },
      });

      // 4. Resolve member wallet and release held pending balance
      let memberWallet = await db.wallet.findUnique({
        where: { distributorId: payout.distributorId },
      });

      if (!memberWallet) {
        throw AppError.badRequest('Distributor wallet not found', 'WALLET_NOT_FOUND');
      }

      const memberAvail = SafeDecimal.roundDecimal(memberWallet.availableBalance, 2);

      await db.wallet.update({
        where: { id: memberWallet.id },
        data: {
          pendingBalance: { decrement: amountDecimal },
          lifetimePaid: { increment: amountDecimal },
          totalWithdrawn: { increment: amountDecimal },
        },
      });

      // 5. Create Member WalletTransaction
      const memberWalletTx = await db.walletTransaction.create({
        data: {
          walletId: memberWallet.id,
          transactionNumber: memberTxNumber,
          type: 'PAYOUT',
          status: 'COMPLETED',
          amount: amountDecimal,
          feeAmount: feeAmountDecimal,
          netAmount: netAmountDecimal,
          balanceBefore: memberAvail,
          balanceAfter: memberAvail,
          referenceId: payout.id,
          description: `Disbursement for Payout #${payout.payoutNumber} via Treasury (Ref: ${referenceNumber || 'N/A'})`,
        },
      });

      // 6. Update PayoutRequest to PAID
      await db.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'PAID',
          processedAt: now,
          referenceNumber: referenceNumber || payout.referenceNumber,
          adminNotes: adminNotes ? `${payout.adminNotes ? payout.adminNotes + '\n' : ''}${adminNotes}` : payout.adminNotes,
          walletTransactionId: memberWalletTx.id,
        },
      });

      // 7. Update associated commissions to PAID
      await db.commissionTransaction.updateMany({
        where: {
          recipientMemberId: payout.distributorId,
          status: { in: ['AVAILABLE', 'PENDING'] },
          paidAt: null,
        },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });

      // 8. Create AuditLog
      await db.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PAYOUT_DISBURSED_VIA_TREASURY',
          entityType: 'PayoutRequest',
          entityId: payout.id,
          previousData: { status: payout.status },
          newData: {
            status: 'PAID',
            amount: amountDecimal.toNumber(),
            platformTransactionNumber: platformTxNumber,
            referenceNumber,
          },
        },
      });

      logger.info(
        {
          payoutId: payout.id,
          payoutNumber: payout.payoutNumber,
          disbursedAmount: netAmountDecimal.toFixed(2),
          platformTxNumber,
        },
        'Payout successfully disbursed from Platform Treasury'
      );

      return {
        payoutId: payout.id,
        payoutNumber: payout.payoutNumber,
        distributorId: payout.distributorId,
        disbursedAmount: amountDecimal.toNumber(),
        netAmount: netAmountDecimal.toNumber(),
        feeAmount: feeAmountDecimal.toNumber(),
        status: 'PAID',
        platformWalletTransactionId: platformTx.id,
        platformTransactionNumber: platformTx.transactionNumber,
        memberWalletTransactionId: memberWalletTx.id,
        processedAt: now,
        message: 'Payout disbursed successfully from platform treasury with full immutable ledger entries',
      };
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 6: REVERSE COMMISSION WITH TREASURY RECONCILIATION
   *
   * Flow:
   * Commission Reversal -> Release Treasury Reserve / Deduct Member Wallet -> REVERSED
   */
  public static async reverseCommissionWithTreasury(
    commissionId: string,
    reason: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<ReverseCommissionResult> {
    if (!commissionId || !commissionId.trim()) {
      throw AppError.badRequest('Valid commissionId is required', 'COMMISSION_ID_REQUIRED');
    }
    if (!reason || !reason.trim()) {
      throw AppError.badRequest('Reversal reason is required', 'REVERSAL_REASON_REQUIRED');
    }

    const cleanCommissionId = commissionId.trim();

    const runner = async (db: Prisma.TransactionClient): Promise<ReverseCommissionResult> => {
      const commission = await db.commissionTransaction.findUnique({
        where: { id: cleanCommissionId },
      });

      if (!commission) {
        throw AppError.notFound(`Commission record '${cleanCommissionId}' not found`, 'COMMISSION_NOT_FOUND');
      }

      if (commission.status === 'REVERSED') {
        return {
          commissionId: commission.id,
          orderId: commission.orderId,
          recipientMemberId: commission.recipientMemberId,
          reversedAmount: SafeDecimal.round(commission.grossCommissionAmount, 2),
          status: 'REVERSED',
          reserveReleased: false,
          reserveReleaseAmount: 0,
          memberBalanceAdjusted: false,
          reason: commission.reversalReason || reason,
          timestamp: commission.reversedAt || new Date(),
        };
      }

      const grossDecimal = SafeDecimal.roundDecimal(commission.grossCommissionAmount, 2);
      const grossAmount = grossDecimal.toNumber();
      const now = new Date();
      let reserveReleased = false;
      let memberAdjusted = false;

      // If commission was already funded/available, release the treasury reserve
      if (commission.status === 'AVAILABLE') {
        const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(this.DEFAULT_WALLET_CODE, db);
        const treasuryBefore = SafeDecimal.roundDecimal(treasuryWallet.availableBalance, 2);
        const treasuryAfter = treasuryBefore.add(grossDecimal);

        // Compensating PlatformWalletTransaction releasing reserve back to treasury available
        await db.platformWalletTransaction.create({
          data: {
            walletId: treasuryWallet.id,
            transactionNumber: PlatformTreasuryService.generateTransactionNumber(),
            type: 'RECONCILIATION',
            amount: grossDecimal,
            balanceBefore: treasuryBefore,
            balanceAfter: treasuryAfter,
            referenceType: 'COMMISSION_REVERSAL',
            referenceId: commission.id,
            status: 'COMPLETED',
            description: `Release Treasury Reserve for reversed Commission ${commission.id}. Reason: ${reason}`,
          },
        });

        await db.platformWallet.update({
          where: { id: treasuryWallet.id },
          data: { availableBalance: treasuryAfter },
        });

        reserveReleased = true;

        // Deduct from recipient member wallet
        const memberWallet = await db.wallet.findFirst({
          where: { distributorId: commission.recipientMemberId },
        });

        if (memberWallet) {
          const mBefore = SafeDecimal.roundDecimal(memberWallet.availableBalance, 2);
          const mAfter = mBefore.sub(grossDecimal);

          await db.walletTransaction.create({
            data: {
              walletId: memberWallet.id,
              transactionNumber: CommissionLedgerService.generateWalletTransactionNumber(),
              type: 'REVERSAL',
              status: 'COMPLETED',
              amount: grossDecimal,
              netAmount: grossDecimal,
              feeAmount: new Prisma.Decimal(0),
              balanceBefore: mBefore,
              balanceAfter: mAfter,
              referenceId: commission.id,
              commissionTransactionId: commission.id,
              description: `Reversal deduction for Commission ${commission.id}: ${reason}`,
            },
          });

          await db.wallet.update({
            where: { id: memberWallet.id },
            data: {
              availableBalance: mAfter,
              lifetimeEarned: { decrement: grossDecimal },
            },
          });

          memberAdjusted = true;
        }
      }

      // Update CommissionTransaction to REVERSED
      await db.commissionTransaction.update({
        where: { id: commission.id },
        data: {
          status: 'REVERSED',
          reversedAt: now,
          reversalReason: reason,
        },
      });

      return {
        commissionId: commission.id,
        orderId: commission.orderId,
        recipientMemberId: commission.recipientMemberId,
        reversedAmount: grossAmount,
        status: 'REVERSED',
        reserveReleased,
        reserveReleaseAmount: reserveReleased ? grossAmount : 0,
        memberBalanceAdjusted: memberAdjusted,
        reason,
        timestamp: now,
      };
    };

    return existingTx ? runner(existingTx) : prisma.$transaction(runner);
  }

  /**
   * STEP 7: AUTHORITATIVE ACCOUNTING SUMMARY & SOLVENCY REPORT
   *
   * Computes comprehensive balance sheet connecting Treasury Cash with Commission Liabilities.
   */
  public static async getAccountingSummary(
    options?: { walletCode?: string },
    existingTx?: Prisma.TransactionClient
  ): Promise<TreasuryCommissionAccountingSummary> {
    const db = existingTx || prisma;
    const walletCode = options?.walletCode || this.DEFAULT_WALLET_CODE;

    const treasuryWallet = await PlatformTreasuryService.getOrCreatePlatformWallet(walletCode, db);
    const treasuryAvailable = SafeDecimal.round(treasuryWallet.availableBalance, 2);
    const treasuryPending = SafeDecimal.round(treasuryWallet.pendingBalance ?? 0, 2);

    // 1. Calculate historical reserve activity
    const reserveAgg = await db.platformWalletTransaction.aggregate({
      where: {
        walletId: treasuryWallet.id,
        type: 'COMMISSION_RESERVE',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
    });
    const totalReservedEver = SafeDecimal.round(reserveAgg._sum.amount ?? 0, 2);

    // 2. Aggregate Commission Liabilities by Status
    const [earnedAgg, approvedAgg, availableAgg, paidAgg, reversedAgg] = await Promise.all([
      db.commissionTransaction.aggregate({
        where: { status: 'PENDING' },
        _sum: { grossCommissionAmount: true },
      }),
      db.commissionTransaction.aggregate({
        where: { status: 'APPROVED' },
        _sum: { grossCommissionAmount: true },
      }),
      db.commissionTransaction.aggregate({
        where: { status: 'AVAILABLE' },
        _sum: { grossCommissionAmount: true },
      }),
      db.commissionTransaction.aggregate({
        where: { status: 'PAID' },
        _sum: { grossCommissionAmount: true },
      }),
      db.commissionTransaction.aggregate({
        where: { status: 'REVERSED' },
        _sum: { grossCommissionAmount: true },
      }),
    ]);

    const unfundedEarnedLiability = SafeDecimal.round(earnedAgg._sum.grossCommissionAmount ?? 0, 2);
    const approvedLiability = SafeDecimal.round(approvedAgg._sum.grossCommissionAmount ?? 0, 2);
    const fundedAvailableLiability = SafeDecimal.round(availableAgg._sum.grossCommissionAmount ?? 0, 2);
    const totalLifetimePaid = SafeDecimal.round(paidAgg._sum.grossCommissionAmount ?? 0, 2);
    const totalLifetimeReversed = SafeDecimal.round(reversedAgg._sum.grossCommissionAmount ?? 0, 2);

    // 3. Aggregate Member Payout Requests (in-flight withdrawal liabilities)
    const payoutPendingAgg = await db.payoutRequest.aggregate({
      where: {
        status: { in: ['REQUESTED', 'UNDER_REVIEW', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });
    const payoutPendingLiability = SafeDecimal.round(payoutPendingAgg._sum.amount ?? 0, 2);

    // Total outstanding liability owed to members
    const totalOutstandingPayable = SafeDecimal.round(
      unfundedEarnedLiability + approvedLiability + fundedAvailableLiability + payoutPendingLiability,
      2
    );

    // 4. Member Wallets Aggregation
    const memberWalletAgg = await db.wallet.aggregate({
      _sum: {
        availableBalance: true,
        pendingBalance: true,
        lifetimeEarned: true,
        lifetimePaid: true,
      },
    });

    const totalMemberAvailable = SafeDecimal.round(memberWalletAgg._sum.availableBalance ?? 0, 2);
    const totalMemberPending = SafeDecimal.round(memberWalletAgg._sum.pendingBalance ?? 0, 2);
    const totalMemberEarned = SafeDecimal.round(memberWalletAgg._sum.lifetimeEarned ?? 0, 2);
    const totalMemberPaid = SafeDecimal.round(memberWalletAgg._sum.lifetimePaid ?? 0, 2);

    // 5. Coverage and Solvency Metrics
    const totalTreasuryCash = SafeDecimal.round(treasuryAvailable + treasuryPending, 2);
    const netSurplusDeficit = SafeDecimal.round(totalTreasuryCash - totalOutstandingPayable, 2);

    const reserveCoverageRatio =
      totalOutstandingPayable > 0
        ? SafeDecimal.round(totalReservedEver / totalOutstandingPayable, 2)
        : 1.0;

    const totalSolvencyRatio =
      totalOutstandingPayable > 0
        ? SafeDecimal.round(totalTreasuryCash / totalOutstandingPayable, 2)
        : 1.0;

    const isSolvent = totalTreasuryCash >= totalOutstandingPayable;

    let healthStatus: TreasuryCommissionAccountingSummary['healthStatus'] = 'HEALTHY';
    if (!isSolvent) {
      healthStatus = 'INSOLVENT';
    } else if (totalSolvencyRatio < 1.1) {
      healthStatus = 'RESERVE_DEFICIT';
    } else if (totalSolvencyRatio < 1.5) {
      healthStatus = 'MODERATE_RESERVE';
    }

    return {
      currency: treasuryWallet.currency,
      timestamp: new Date(),
      isSolvent,
      healthStatus,
      platformTreasury: {
        availableBalance: treasuryAvailable,
        reservedBalance: totalReservedEver,
        pendingBalance: treasuryPending,
        totalFloat: totalTreasuryCash,
      },
      commissionPayables: {
        unfundedEarnedLiability,
        approvedLiability,
        fundedAvailableLiability,
        payoutPendingLiability,
        totalOutstandingPayable,
        totalLifetimePaid,
        totalLifetimeReversed,
      },
      memberWallets: {
        totalAvailableBalance: totalMemberAvailable,
        totalPendingWithdrawalBalance: totalMemberPending,
        totalLifetimeEarned: totalMemberEarned,
        totalLifetimePaid: totalMemberPaid,
      },
      coverageMetrics: {
        reserveCoverageRatio,
        totalSolvencyRatio,
        netSurplusDeficit,
      },
    };
  }

  /**
   * STEP 8: STRICT STATUS TRANSITION ENGINE
   *
   * Validates and executes transitions between the 6 canonical statuses:
   * EARNED -> APPROVED -> AVAILABLE -> PAYOUT_PENDING -> PAID / REVERSED
   */
  public static async transitionStatus(
    commissionId: string,
    targetStatus: CanonicalCommissionStatus,
    reason?: string,
    existingTx?: Prisma.TransactionClient
  ): Promise<{ commissionId: string; previousStatus: CanonicalCommissionStatus; newStatus: CanonicalCommissionStatus }> {
    const db = existingTx || prisma;

    const commission = await db.commissionTransaction.findUnique({
      where: { id: commissionId },
    });

    if (!commission) {
      throw AppError.notFound(`Commission '${commissionId}' not found`, 'COMMISSION_NOT_FOUND');
    }

    const currentStatus = this.toCanonicalStatus(commission.status);

    if (currentStatus === targetStatus) {
      return { commissionId, previousStatus: currentStatus, newStatus: targetStatus };
    }

    // Terminal statuses
    if (currentStatus === 'REVERSED') {
      throw AppError.badRequest('Cannot transition from REVERSED status', 'TERMINAL_STATUS');
    }

    // Allowed transition validation
    const ALLOWED_TRANSITIONS: Record<CanonicalCommissionStatus, CanonicalCommissionStatus[]> = {
      EARNED: ['APPROVED', 'AVAILABLE', 'REVERSED'],
      APPROVED: ['AVAILABLE', 'EARNED', 'REVERSED'],
      AVAILABLE: ['PAYOUT_PENDING', 'PAID', 'REVERSED'],
      PAYOUT_PENDING: ['PAID', 'AVAILABLE', 'REVERSED'],
      PAID: ['REVERSED'],
      REVERSED: [],
    };

    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from ${currentStatus} to ${targetStatus}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // If transitioning to AVAILABLE, ensure funds are reserved
    if (targetStatus === 'AVAILABLE' && commission.status !== 'AVAILABLE') {
      const fundResult = await this.fundAndReserveCommission(commissionId, undefined, existingTx);
      if (!fundResult.isFunded) {
        throw AppError.badRequest(
          `Cannot transition to AVAILABLE: ${fundResult.reason}`,
          'INSUFFICIENT_TREASURY_RESERVE'
        );
      }
      return { commissionId, previousStatus: currentStatus, newStatus: 'AVAILABLE' };
    }

    // If transitioning to REVERSED
    if (targetStatus === 'REVERSED') {
      await this.reverseCommissionWithTreasury(commissionId, reason || 'Admin requested reversal', existingTx);
      return { commissionId, previousStatus: currentStatus, newStatus: 'REVERSED' };
    }

    const dbStatus = this.toDatabaseStatus(targetStatus);
    const now = new Date();

    await db.commissionTransaction.update({
      where: { id: commissionId },
      data: {
        status: dbStatus,
        ...(targetStatus === 'APPROVED' ? { approvedAt: now } : {}),
        ...(targetStatus === 'PAID' ? { paidAt: now } : {}),
      },
    });

    return { commissionId, previousStatus: currentStatus, newStatus: targetStatus };
  }
}
