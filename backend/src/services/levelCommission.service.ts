import { Prisma, LevelCommissionStatus, WalletTransactionType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { CommissionConfigService } from './commissionConfig.service';
import { AuthoritativeBVService } from './authoritativeBV.service';
import { SponsorUplineService } from './sponsorUpline.service';
import { CommissionCalculationService } from './commissionCalculation.service';
import {
  CANONICAL_LEVEL_RATES,
  TOTAL_THEORETICAL_DISTRIBUTION_PERCENT,
  UplineSponsorNode,
  CalculateOrderLevelCommissionResult,
  CalculatedLevelItem,
  SkippedLevelItem,
  ReverseCommissionResult,
  LevelCommissionSummaryResult,
} from '../types/levelCommission.types';

export class LevelCommissionService {
  /**
   * Commission Calculation Engine delegations (Prompt 16)
   */
  public static calculateCommissionAmount(
    businessVolume: Prisma.Decimal.Value | number | string,
    percentage: Prisma.Decimal.Value | number | string
  ): number {
    return CommissionCalculationService.calculateCommissionAmount(businessVolume, percentage);
  }

  public static async calculateUplineCommission(
    memberId: string,
    businessVolume: Prisma.Decimal.Value | number | string,
    options?: any,
    client?: Prisma.TransactionClient
  ) {
    return CommissionCalculationService.calculateUplineCommission(memberId, businessVolume, options, client);
  }

  public static async calculateCommissionForMemberPurchase(
    memberId: string,
    orderId: string,
    options?: any,
    client?: Prisma.TransactionClient
  ) {
    return CommissionCalculationService.calculateCommissionForMemberPurchase(memberId, orderId, options, client);
  }

  public static async calculateCommissionForOrder(
    orderId: string,
    options?: any,
    client?: Prisma.TransactionClient
  ) {
    return CommissionCalculationService.calculateCommissionForOrder(orderId, options, client);
  }

  /**
   * Traverses sponsor upline up to 5 generations for a given distributor.
   * Delegates to the authoritative SponsorUplineService.
   */
  public static async getSponsorUpline5Levels(
    distributorIdOrCode: string,
    client?: Prisma.TransactionClient
  ): Promise<UplineSponsorNode[]> {
    return SponsorUplineService.getUplineChain(distributorIdOrCode, 5, client);
  }

  /**
   * Idempotently calculates and records 5-level commissions for an order.
   * 
   * Strict Business Invariants:
   * - Base is strictly ORDER BUSINESS VOLUME (BV).
   * - Rates: Level 1 = 24%, Level 2 = 8%, Level 3 = 13%, Level 4 = 5%, Level 5 = 4%.
   * - Total theoretical distribution = 54% of BV.
   * - Upline levels 1..5 reflect sponsor distance, completely decoupled from career ranks.
   */
  public static async calculateCommissionsForOrder(
    orderId: string,
    tx?: Prisma.TransactionClient
  ): Promise<CalculateOrderLevelCommissionResult> {
    const runner = async (db: Prisma.TransactionClient) => {
      // 1. Fetch order details
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          distributor: true,
          customer: { include: { sponsor: true } },
        },
      });

      if (!order) {
        throw AppError.notFound(`Order with ID '${orderId}' not found`, 'ORDER_NOT_FOUND');
      }

      // 1b. Validate Authoritative BV Eligibility (Prompt 14)
      const configuredTiers = await CommissionConfigService.getCommissionRates(db);
      const eligibility = AuthoritativeBVService.validateOrderBVEligibility(order);

      if (!eligibility.isEligible) {
        if (eligibility.reason === 'ORDER_NOT_PAID') {
          throw AppError.badRequest(
            eligibility.message || `Cannot calculate commission for order in '${order.status}' status. Order must be PAID or CONFIRMED.`,
            'ORDER_NOT_PAID'
          );
        }

        logger.info(
          { orderId, orderNumber: order.orderNumber, reason: eligibility.reason },
          'Order not eligible for level commission calculation; returning empty result'
        );

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderBV: eligibility.commissionableBVNumber,
          commissionableBusinessVolume: eligibility.commissionableBVNumber,
          totalDistributedPercentage: 0,
          totalCommissionAmount: 0,
          commissions: [],
          skippedLevels: configuredTiers.map((r) => ({
            level: r.levelNumber,
            ratePercentage: r.percentageNumber,
            reason: (eligibility.reason === 'ORDER_CANCELLED' ? 'ORDER_CANCELLED' : 'ZERO_BV') as any,
          })),
        };
      }

      const commissionableBVDecimal = eligibility.commissionableBusinessVolume;
      const orderBV = eligibility.commissionableBVNumber;

      // 2. Identify purchasing distributor
      const purchaserDistributorId = order.distributorId || order.customer?.sponsorId;
      if (!purchaserDistributorId) {
        logger.warn({ orderId, orderNumber: order.orderNumber }, 'Order has no associated distributor or customer sponsor; skipping unilevel calculation');
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderBV,
          totalDistributedPercentage: 0,
          totalCommissionAmount: 0,
          commissions: [],
          skippedLevels: configuredTiers.map((r) => ({
            level: r.levelNumber,
            ratePercentage: r.percentageNumber,
            reason: 'NO_UPLINE_EXISTS' as const,
          })),
        };
      }

      // 3. Check for existing commission records (Strict Idempotency)
      const existing = await db.levelCommission.findMany({
        where: { orderId: order.id },
        include: { distributor: true },
        orderBy: { level: 'asc' },
      });

      if (existing && existing.length > 0) {
        logger.info({ orderId, existingCount: existing.length }, 'Level commissions already calculated for order; returning existing records');
        let totalAmount = 0;
        let totalPct = 0;
        const formatted = existing.map((c) => {
          const amt = Number(c.commissionAmount);
          const pct = Number(c.ratePercentage);
          totalAmount += amt;
          totalPct += pct;
          return {
            id: c.id,
            level: c.level,
            beneficiaryId: c.distributorId,
            beneficiaryCode: c.distributor.distributorCode,
            beneficiaryName: `${c.distributor.firstName} ${c.distributor.lastName}`.trim(),
            ratePercentage: pct,
            commissionAmount: amt,
            status: c.status,
            businessReference: c.businessReference,
          };
        });

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderBV,
          commissionableBusinessVolume: orderBV,
          totalDistributedPercentage: totalPct,
          totalCommissionAmount: Number(totalAmount.toFixed(2)),
          commissions: formatted,
          skippedLevels: [],
        };
      }

      // 4. Resolve 5-generation sponsor upline
      const uplines = await this.getSponsorUpline5Levels(purchaserDistributorId, db);
      const uplineMap = new Map<number, UplineSponsorNode>();
      for (const u of uplines) {
        uplineMap.set(u.level, u);
      }

      // 5. Calculate and persist each tier
      const createdCommissions: CalculatedLevelItem[] = [];
      const skippedLevels: SkippedLevelItem[] = [];
      let totalDistributedAmt = 0;
      let totalDistributedPct = 0;

      for (const tier of configuredTiers) {
        const uplineNode = uplineMap.get(tier.levelNumber);

        if (!uplineNode) {
          skippedLevels.push({
            level: tier.levelNumber,
            ratePercentage: tier.percentageNumber,
            reason: 'NO_UPLINE_EXISTS',
          });
          continue;
        }

        // Active status check
        if (uplineNode.status !== 'ACTIVE') {
          skippedLevels.push({
            level: tier.levelNumber,
            ratePercentage: tier.percentageNumber,
            reason: 'UPLINE_INACTIVE',
          });
          continue;
        }

        const orderBVDecimal = SafeDecimal.toDecimal(order.totalBV);
        const commissionDecimal = SafeDecimal.calculateCommissionAmount(orderBVDecimal, tier.percentage);
        const commissionAmount = commissionDecimal.toNumber();
        if (commissionDecimal.lessThanOrEqualTo(0)) continue;

        const businessReference = `LEVEL:${order.id}:L${tier.levelNumber}:${uplineNode.distributorId}`;
        const commissionNumber = `LCM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const entry = await db.levelCommission.create({
          data: {
            commissionNumber,
            businessReference,
            orderId: order.id,
            distributorId: uplineNode.distributorId,
            sourceDistributorId: purchaserDistributorId,
            level: tier.levelNumber,
            ratePercentage: tier.percentage,
            orderBV: orderBVDecimal,
            commissionableBusinessVolume: orderBVDecimal,
            commissionAmount: commissionDecimal,
            status: 'CALCULATED',
            currency: 'INR',
            calculationDetails: {
              orderNumber: order.orderNumber,
              orderBV,
              commissionableBusinessVolume: orderBV,
              ratePercentage: tier.percentageNumber,
              beneficiaryCode: uplineNode.distributorCode,
              beneficiaryName: uplineNode.displayName,
              isDirect: uplineNode.isDirect,
            },
          },
        });

        createdCommissions.push({
          id: entry.id,
          level: tier.levelNumber,
          beneficiaryId: uplineNode.distributorId,
          beneficiaryCode: uplineNode.distributorCode,
          beneficiaryName: uplineNode.displayName,
          ratePercentage: tier.percentageNumber,
          commissionableBusinessVolume: orderBV,
          commissionAmount,
          status: entry.status,
          businessReference,
        });

        totalDistributedAmt += commissionAmount;
        totalDistributedPct += tier.percentageNumber;
      }

      logger.info(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderBV,
          commissionableBusinessVolume: orderBV,
          commissionsCount: createdCommissions.length,
          totalDistributedAmt: Number(totalDistributedAmt.toFixed(2)),
          totalDistributedPct,
        },
        '5-Level Unilevel Commissions calculated and recorded successfully'
      );

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderBV,
        commissionableBusinessVolume: orderBV,
        totalDistributedPercentage: totalDistributedPct,
        totalCommissionAmount: Number(totalDistributedAmt.toFixed(2)),
        commissions: createdCommissions,
        skippedLevels,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 15000 });
  }

  /**
   * Previews 5-level commission breakdown without writing to the database.
   */
  public static async previewOrderCommissions(
    orderBV: number,
    purchaserDistributorId: string
  ): Promise<CalculateOrderLevelCommissionResult> {
    const cleanBV = Number(orderBV);
    if (isNaN(cleanBV) || cleanBV <= 0) {
      throw AppError.badRequest('Valid positive order BV is required for preview');
    }

    const uplines = await this.getSponsorUpline5Levels(purchaserDistributorId);
    const uplineMap = new Map<number, UplineSponsorNode>();
    for (const u of uplines) {
      uplineMap.set(u.level, u);
    }

    const previewItems: CalculatedLevelItem[] = [];
    const skippedLevels: SkippedLevelItem[] = [];
    let totalAmt = 0;
    let totalPct = 0;

    const configuredTiers = await CommissionConfigService.getCommissionRates();
    const cleanBVDecimal = SafeDecimal.toDecimal(cleanBV);

    for (const tier of configuredTiers) {
      const uplineNode = uplineMap.get(tier.levelNumber);
      if (!uplineNode) {
        skippedLevels.push({
          level: tier.levelNumber,
          ratePercentage: tier.percentageNumber,
          reason: 'NO_UPLINE_EXISTS',
        });
        continue;
      }

      if (uplineNode.status !== 'ACTIVE') {
        skippedLevels.push({
          level: tier.levelNumber,
          ratePercentage: tier.percentageNumber,
          reason: 'UPLINE_INACTIVE',
        });
        continue;
      }

      const commissionDecimal = SafeDecimal.calculateCommissionAmount(cleanBVDecimal, tier.percentage);
      const commissionAmount = commissionDecimal.toNumber();
      previewItems.push({
        level: tier.levelNumber,
        beneficiaryId: uplineNode.distributorId,
        beneficiaryCode: uplineNode.distributorCode,
        beneficiaryName: uplineNode.displayName,
        ratePercentage: tier.percentageNumber,
        commissionableBusinessVolume: cleanBV,
        commissionAmount,
        status: 'CALCULATED',
        businessReference: `PREVIEW:L${tier.levelNumber}:${uplineNode.distributorId}`,
      });

      totalAmt += commissionAmount;
      totalPct += tier.percentageNumber;
    }

    return {
      orderId: 'PREVIEW',
      orderNumber: 'PREVIEW-ORDER',
      orderBV: cleanBV,
      commissionableBusinessVolume: cleanBV,
      totalDistributedPercentage: totalPct,
      totalCommissionAmount: Number(totalAmt.toFixed(2)),
      commissions: previewItems,
      skippedLevels,
    };
  }

  /**
   * Payout Processing: transitions eligible level commissions to PAID
   * and credits distributor wallets atomically via WalletTransaction.
   */
  public static async payoutLevelCommissions(
    options: {
      orderId?: string;
      distributorId?: string;
      commissionIds?: string[];
      periodId?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<{ paidCount: number; totalPaidAmount: number; transactionIds: string[] }> {
    const runner = async (db: Prisma.TransactionClient) => {
      const { orderId, distributorId, commissionIds, periodId } = options;

      const whereClause: Prisma.LevelCommissionWhereInput = {
        status: { in: ['CALCULATED', 'APPROVED'] },
        ...(orderId ? { orderId } : {}),
        ...(distributorId ? { distributorId } : {}),
        ...(commissionIds && commissionIds.length > 0 ? { id: { in: commissionIds } } : {}),
        ...(periodId ? { periodId } : {}),
      };

      const pendingCommissions = await db.levelCommission.findMany({
        where: whereClause,
        include: {
          distributor: { select: { id: true, userId: true, distributorCode: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { distributorId: 'asc' }, // Ordered locking to prevent deadlock
      });

      if (pendingCommissions.length === 0) {
        return { paidCount: 0, totalPaidAmount: 0, transactionIds: [] };
      }

      let totalPaid = 0;
      const transactionIds: string[] = [];

      for (const comm of pendingCommissions) {
        const commAmount = Number(comm.commissionAmount);
        if (commAmount <= 0) continue;

        const distId = comm.distributorId;
        const userId = comm.distributor.userId;

        // 1. Resolve or create wallet
        let wallet = await db.wallet.findFirst({
          where: {
            OR: [{ distributorId: distId }, { userId }],
          },
        });

        if (!wallet) {
          wallet = await db.wallet.create({
            data: {
              distributorId: distId,
              userId,
              availableBalance: new Prisma.Decimal(0),
              pendingBalance: new Prisma.Decimal(0),
              lifetimeEarned: new Prisma.Decimal(0),
              lifetimePaid: new Prisma.Decimal(0),
              currency: comm.currency || 'INR',
              isLocked: false,
            },
          });
        }

        const balanceBefore = new Prisma.Decimal(wallet.availableBalance);
        const balanceAfter = balanceBefore.add(comm.commissionAmount);

        // 2. Append WalletTransaction
        const walletTxNumber = `WTX-LCM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const walletTx = await db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            transactionNumber: walletTxNumber,
            type: 'COMMISSION',
            status: 'COMPLETED',
            amount: comm.commissionAmount,
            netAmount: comm.commissionAmount,
            balanceBefore,
            balanceAfter,
            referenceId: comm.id,
            description: `Level ${comm.level} Unilevel Commission (${comm.ratePercentage}%) from Order ${comm.order.orderNumber}`,
          },
        });

        // 3. Update Wallet balances
        await db.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: balanceAfter,
            lifetimeEarned: { increment: comm.commissionAmount },
          },
        });

        // 4. Mark LevelCommission as PAID
        await db.levelCommission.update({
          where: { id: comm.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            walletTransactionId: walletTx.id,
          },
        });

        totalPaid += commAmount;
        transactionIds.push(walletTx.id);
      }

      logger.info(
        { count: pendingCommissions.length, totalPaid: Number(totalPaid.toFixed(2)) },
        'Level commissions successfully paid out to wallets'
      );

      return {
        paidCount: pendingCommissions.length,
        totalPaidAmount: Number(totalPaid.toFixed(2)),
        transactionIds,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * Reverses level commissions upon order cancellation, refund, or chargeback.
   * - If commission was CALCULATED or APPROVED, marks CANCELLED.
   * - If commission was PAID, debits the beneficiary wallet and marks REVERSED.
   */
  public static async reverseCommissionsForOrder(
    orderId: string,
    reason: string,
    tx?: Prisma.TransactionClient
  ): Promise<ReverseCommissionResult> {
    const runner = async (db: Prisma.TransactionClient) => {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true },
      });

      if (!order) {
        throw AppError.notFound(`Order with ID '${orderId}' not found`, 'ORDER_NOT_FOUND');
      }

      const commissions = await db.levelCommission.findMany({
        where: {
          orderId,
          status: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
        },
        include: { distributor: true },
      });

      if (commissions.length === 0) {
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          reversedCount: 0,
          totalReversedAmount: 0,
          walletDeductions: [],
        };
      }

      let totalReversedAmount = 0;
      const walletDeductions: Array<{ distributorId: string; amount: number; walletTransactionId?: string }> = [];

      for (const comm of commissions) {
        const commAmount = Number(comm.commissionAmount);
        totalReversedAmount += commAmount;

        if (comm.status === 'CALCULATED' || comm.status === 'APPROVED') {
          // Simply cancel without wallet movement
          await db.levelCommission.update({
            where: { id: comm.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              reversalReason: reason,
            },
          });
        } else if (comm.status === 'PAID') {
          // Clawback from wallet
          const wallet = await db.wallet.findFirst({
            where: { distributorId: comm.distributorId },
          });

          if (wallet) {
            const balanceBefore = new Prisma.Decimal(wallet.availableBalance);
            const balanceAfter = balanceBefore.sub(comm.commissionAmount);

            const txNumber = `WTX-REV-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
            const clawbackTx = await db.walletTransaction.create({
              data: {
                walletId: wallet.id,
                transactionNumber: txNumber,
                type: 'REFUND',
                status: 'COMPLETED',
                amount: new Prisma.Decimal(-commAmount),
                netAmount: new Prisma.Decimal(-commAmount),
                balanceBefore,
                balanceAfter,
                referenceId: comm.id,
                description: `Clawback: Level ${comm.level} Commission reversal for refunded Order ${order.orderNumber} (${reason})`,
              },
            });

            await db.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: balanceAfter,
                lifetimeEarned: { decrement: comm.commissionAmount },
              },
            });

            walletDeductions.push({
              distributorId: comm.distributorId,
              amount: commAmount,
              walletTransactionId: clawbackTx.id,
            });
          }

          await db.levelCommission.update({
            where: { id: comm.id },
            data: {
              status: 'REVERSED',
              cancelledAt: new Date(),
              reversalReason: reason,
            },
          });
        }
      }

      logger.info(
        {
          orderId,
          orderNumber: order.orderNumber,
          reversedCount: commissions.length,
          totalReversedAmount: Number(totalReversedAmount.toFixed(2)),
        },
        'Order level commissions reversed successfully'
      );

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reversedCount: commissions.length,
        totalReversedAmount: Number(totalReversedAmount.toFixed(2)),
        walletDeductions,
      };
    };

    if (tx) {
      return runner(tx);
    }
    return prisma.$transaction(runner, { timeout: 20000 });
  }

  /**
   * Retrieves summary and breakdown of unilevel commissions for a distributor.
   */
  public static async getDistributorLevelCommissions(
    distributorIdOrCode: string,
    query: { page?: number; limit?: number; level?: number; status?: string } = {}
  ): Promise<LevelCommissionSummaryResult> {
    const cleanId = (distributorIdOrCode || '').trim();
    const profile = await prisma.distributorProfile.findFirst({
      where: {
        OR: [{ id: cleanId }, { distributorId: cleanId }, { distributorCode: cleanId }],
      },
    });

    if (!profile) {
      throw AppError.notFound(`Distributor '${cleanId}' not found`, 'DISTRIBUTOR_NOT_FOUND');
    }

    const { page = 1, limit = 20, level, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LevelCommissionWhereInput = {
      distributorId: profile.id,
      ...(level ? { level } : {}),
      ...(status ? { status: status as LevelCommissionStatus } : {}),
    };

    const [allComms, paginatedComms] = await Promise.all([
      prisma.levelCommission.findMany({
        where: { distributorId: profile.id },
        select: { level: true, ratePercentage: true, commissionAmount: true, status: true },
      }),
      prisma.levelCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceDistributor: { select: { distributorCode: true, firstName: true, lastName: true, displayName: true } },
          order: { select: { orderNumber: true } },
        },
      }),
    ]);

    let totalEarned = 0;
    let totalPending = 0;
    const levelBreakdown: Record<number, { count: number; totalAmount: number; ratePercentage: number }> = {
      1: { count: 0, totalAmount: 0, ratePercentage: 24.0 },
      2: { count: 0, totalAmount: 0, ratePercentage: 8.0 },
      3: { count: 0, totalAmount: 0, ratePercentage: 13.0 },
      4: { count: 0, totalAmount: 0, ratePercentage: 5.0 },
      5: { count: 0, totalAmount: 0, ratePercentage: 4.0 },
    };

    for (const c of allComms) {
      const amt = Number(c.commissionAmount);
      if (c.status === 'PAID') {
        totalEarned += amt;
      } else if (c.status === 'CALCULATED' || c.status === 'APPROVED') {
        totalPending += amt;
      }

      if (levelBreakdown[c.level]) {
        levelBreakdown[c.level].count++;
        levelBreakdown[c.level].totalAmount = Number(
          (levelBreakdown[c.level].totalAmount + amt).toFixed(2)
        );
      }
    }

    const recentCommissions = paginatedComms.map((c) => {
      const src = c.sourceDistributor;
      const srcName = src.displayName?.trim() || `${src.firstName} ${src.lastName}`.trim() || src.distributorCode;
      return {
        id: c.id,
        commissionNumber: c.commissionNumber,
        level: c.level,
        ratePercentage: Number(c.ratePercentage),
        orderBV: Number(c.orderBV),
        commissionAmount: Number(c.commissionAmount),
        status: c.status,
        sourceMemberCode: src.distributorCode,
        sourceMemberName: srcName,
        orderNumber: c.order.orderNumber,
        createdAt: c.createdAt,
      };
    });

    return {
      distributorId: profile.id,
      distributorCode: profile.distributorCode,
      totalEarned: Number(totalEarned.toFixed(2)),
      totalPending: Number(totalPending.toFixed(2)),
      levelBreakdown,
      recentCommissions,
    };
  }
}
