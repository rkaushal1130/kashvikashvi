import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { SafeDecimal } from '../utils/safeDecimal';
import { CommissionConfigService } from './commissionConfig.service';
import { AuthoritativeBVService } from './authoritativeBV.service';
import { SponsorUplineService, UplineNode } from './sponsorUpline.service';
import { CommissionEligibilityService } from './commissionEligibility.service';
import {
  CANONICAL_COMMISSION_TIERS,
  TOTAL_THEORETICAL_COMMISSION_PERCENTAGE,
  CommissionBreakdownItem,
  CommissionBreakdown,
  CommissionCalculationOptions,
  SkippedCommissionLevel,
  TheoreticalCommissionResult,
} from '../types/commissionCalculation.types';

/**
 * ============================================================================
 * COMMISSION CALCULATION ENGINE SERVICE (PROMPT 16)
 * ============================================================================
 * Dedicated calculation service that calculates commissions from Business Volume (BV).
 *
 * MANDATORY MATHEMATICAL SPECIFICATION:
 * Commission rates across 5 ascending sponsor generations:
 *   Level 1 = 24%
 *   Level 2 = 8%
 *   Level 3 = 13%
 *   Level 4 = 5%
 *   Level 5 = 4%
 *   Total Theoretical = 54%
 *
 * FORMULA:
 *   commissionAmount = commissionableBusinessVolume × commissionPercentage / 100
 *
 * EXAMPLE:
 *   BV = ₹10,000
 *   Level 1: 10,000 × 24% = ₹2,400
 *   Level 2: 10,000 × 8%  = ₹800
 *   Level 3: 10,000 × 13% = ₹1,300
 *   Level 4: 10,000 × 5%  = ₹500
 *   Level 5: 10,000 × 4%  = ₹400
 *   Total: ₹5,400
 *
 * CRITICAL BUSINESS INVARIANTS:
 * 1. Base is strictly COMMISSIONABLE BUSINESS VOLUME (BV), NEVER selling price, GST, or BB.
 * 2. This is the total theoretical commission IF all 5 eligible uplines exist and qualify.
 * 3. Do NOT automatically assume every upline is eligible until the rank/eligibility rule
 *    has been confirmed. Inactive or missing uplines are skipped; never create fake recipients.
 * 4. PURE CALCULATION: Do not directly credit wallets during pure calculation.
 * 5. Calculation and financial posting MUST be separate operations.
 * 6. DETERMINISTIC: Calling calculation twice with the same inputs MUST produce the exact same result.
 */
export class CommissionCalculationService {
  public static readonly CANONICAL_TIERS = CANONICAL_COMMISSION_TIERS;
  public static readonly TOTAL_THEORETICAL_PERCENTAGE = TOTAL_THEORETICAL_COMMISSION_PERCENTAGE;

  /**
   * 1. calculateCommissionAmount(businessVolume, percentage)
   *
   * Pure mathematical formula:
   *   commissionAmount = commissionableBusinessVolume × commissionPercentage / 100
   *
   * Deterministic arbitrary-precision financial arithmetic avoiding IEEE 754 float errors.
   */
  public static calculateCommissionAmount(
    businessVolume: Prisma.Decimal.Value | number | string,
    percentage: Prisma.Decimal.Value | number | string
  ): number {
    const bv = SafeDecimal.toDecimal(businessVolume);
    const pct = SafeDecimal.toDecimal(percentage);

    if (bv.lessThanOrEqualTo(0) || pct.lessThanOrEqualTo(0)) {
      return 0;
    }

    // Exact formula: (BV * percentage) / 100
    const calculatedAmount = bv.mul(pct).div(new Prisma.Decimal(100));
    return SafeDecimal.round(calculatedAmount, 2);
  }

  /**
   * Helper: Confirms whether an upline distributor is eligible to receive unilevel commissions.
   * "Do not automatically assume every upline is eligible until the rank/eligibility rule has been confirmed."
   */
  public static async confirmUplineEligibility(
    upline: UplineNode,
    level: number,
    businessVolume: number,
    options?: CommissionCalculationOptions,
    client?: Prisma.TransactionClient
  ): Promise<{ isEligible: boolean; reason?: string }> {
    if (!upline) {
      return { isEligible: false, reason: 'NO_UPLINE_EXISTS' };
    }

    // 1. Custom rank / business rule eligibility confirmation callback (if provided)
    if (options?.confirmEligibility) {
      try {
        const confirmed = await options.confirmEligibility(upline, level, businessVolume);
        if (!confirmed) {
          return { isEligible: false, reason: 'ELIGIBILITY_NOT_CONFIRMED' };
        }
      } catch (err: any) {
        logger.warn(
          { uplineId: upline.distributorId, level, err: err?.message },
          'Error running custom commission eligibility rule'
        );
        return { isEligible: false, reason: 'ELIGIBILITY_RULE_ERROR' };
      }
    }

    // 2. Delegate to dedicated CommissionEligibilityService (Prompt 17)
    const check = await CommissionEligibilityService.isEligibleForLevel(
      upline,
      level,
      {
        businessVolume,
        allowInactiveForTesting: options?.requireActive === false,
      },
      client
    );

    if (!check.isEligible) {
      return {
        isEligible: false,
        reason: (check.reasons[0] && check.reasons[0].includes('not active')
          ? 'UPLINE_INACTIVE'
          : 'ELIGIBILITY_NOT_CONFIRMED'),
      };
    }

    return { isEligible: true };
  }

  /**
   * Helper: Constructs a deterministic CommissionBreakdown array with attached metadata.
   */
  private static createBreakdownResult(
    items: CommissionBreakdownItem[],
    metadata: {
      businessVolume: number;
      totalCommissionAmount: number;
      totalDistributedPercentage: number;
      totalTheoreticalAmount: number;
      totalTheoreticalPercentage: number;
      skippedLevels: SkippedCommissionLevel[];
      orderId?: string;
      orderNumber?: string;
      memberId?: string;
    }
  ): CommissionBreakdown {
    const result = [...items] as CommissionBreakdown;

    result.businessVolume = metadata.businessVolume;
    result.totalCommissionAmount = metadata.totalCommissionAmount;
    result.totalDistributedPercentage = metadata.totalDistributedPercentage;
    result.totalTheoreticalAmount = metadata.totalTheoreticalAmount;
    result.totalTheoreticalPercentage = metadata.totalTheoreticalPercentage;
    result.commissions = items;
    result.skippedLevels = metadata.skippedLevels;

    if (metadata.orderId) result.orderId = metadata.orderId;
    if (metadata.orderNumber) result.orderNumber = metadata.orderNumber;
    if (metadata.memberId) result.memberId = metadata.memberId;

    return result;
  }

  /**
   * 2. calculateUplineCommission(memberId, businessVolume, options?, client?)
   *
   * Calculates unilevel commissions across the 5-generation sponsor upline of memberId.
   *
   * Rate Schedule:
   *   Level 1: 24%
   *   Level 2: 8%
   *   Level 3: 13%
   *   Level 4: 5%
   *   Level 5: 4%
   *
   * Returns a detailed breakdown:
   * [
   *   {
   *     level: 1,
   *     recipientId,
   *     businessVolume,
   *     percentage,
   *     commissionAmount
   *   },
   *   ...
   * ]
   *
   * PURE OPERATION: Does not credit wallets or mutate financial ledgers.
   * DETERMINISTIC: Calling multiple times with identical inputs yields identical outputs.
   */
  public static async calculateUplineCommission(
    memberId: string,
    businessVolume: Prisma.Decimal.Value | number | string,
    options?: CommissionCalculationOptions,
    client?: Prisma.TransactionClient
  ): Promise<CommissionBreakdown> {
    const db = client || prisma;
    const cleanBV = SafeDecimal.round(businessVolume, 2);

    // Theoretical maximum calculations (54% of BV)
    const theoreticalTotalAmount = this.calculateCommissionAmount(
      cleanBV,
      this.TOTAL_THEORETICAL_PERCENTAGE
    );

    if (cleanBV <= 0) {
      return this.createBreakdownResult([], {
        businessVolume: 0,
        totalCommissionAmount: 0,
        totalDistributedPercentage: 0,
        totalTheoreticalAmount: 0,
        totalTheoreticalPercentage: this.TOTAL_THEORETICAL_PERCENTAGE,
        skippedLevels: CANONICAL_COMMISSION_TIERS.map((tier) => ({
          level: tier.level,
          percentage: tier.percentage,
          reason: 'ZERO_BV',
        })),
        memberId,
      });
    }

    // 1. Resolve purchasing member
    const member = await SponsorUplineService.resolveMemberProfile(memberId, db);

    // 2. Fetch 5-generation sponsor upline
    const uplines = await SponsorUplineService.getUplineChain(member.id, 5, db);
    const uplineMap = new Map<number, UplineNode>();
    for (const u of uplines) {
      uplineMap.set(u.level, u);
    }

    // 3. Determine active commission tiers
    let activeTiers: Array<{ level: number; percentage: number }>;
    if (options?.customRates && options.customRates.length > 0) {
      activeTiers = options.customRates;
    } else {
      try {
        const dbTiers = await CommissionConfigService.getCommissionRates(db);
        activeTiers = dbTiers.map((t) => ({
          level: t.levelNumber,
          percentage: t.percentageNumber,
        }));
      } catch {
        activeTiers = [...CANONICAL_COMMISSION_TIERS];
      }
    }

    const breakdownItems: CommissionBreakdownItem[] = [];
    const skippedLevels: SkippedCommissionLevel[] = [];
    let totalCommissionAmount = 0;
    let totalDistributedPercentage = 0;

    // 4. Calculate commission per level
    for (const tier of activeTiers) {
      const uplineNode = uplineMap.get(tier.level);

      // Check existence
      if (!uplineNode) {
        skippedLevels.push({
          level: tier.level,
          percentage: tier.percentage,
          reason: 'NO_UPLINE_EXISTS',
        });
        continue;
      }

      // Confirm eligibility
      const eligibility = await this.confirmUplineEligibility(
        uplineNode,
        tier.level,
        cleanBV,
        options
      );

      if (!eligibility.isEligible) {
        skippedLevels.push({
          level: tier.level,
          percentage: tier.percentage,
          reason: (eligibility.reason || 'ELIGIBILITY_NOT_CONFIRMED') as any,
          uplineNode,
        });
        continue;
      }

      // Calculate exact amount
      const commissionAmount = this.calculateCommissionAmount(cleanBV, tier.percentage);

      breakdownItems.push({
        level: tier.level,
        recipientId: uplineNode.distributorId,
        businessVolume: cleanBV,
        percentage: tier.percentage,
        commissionAmount,
        recipientCode: uplineNode.distributorCode,
        recipientName: uplineNode.displayName,
        status: 'ELIGIBLE',
        isEligible: true,
      });

      totalCommissionAmount = SafeDecimal.round(totalCommissionAmount + commissionAmount, 2);
      totalDistributedPercentage = SafeDecimal.round(totalDistributedPercentage + tier.percentage, 2);
    }

    return this.createBreakdownResult(breakdownItems, {
      businessVolume: cleanBV,
      totalCommissionAmount,
      totalDistributedPercentage,
      totalTheoreticalAmount: theoreticalTotalAmount,
      totalTheoreticalPercentage: this.TOTAL_THEORETICAL_PERCENTAGE,
      skippedLevels,
      memberId: member.id,
    });
  }

  /**
   * 3. calculateCommissionForMemberPurchase(memberId, orderId, options?, client?)
   *
   * Calculates unilevel commissions for a member's specific order purchase.
   *
   * Derives authoritative commissionable Business Volume from database records.
   * Validates order status and qualification rules.
   *
   * Pure operation: No wallet credits or persistent ledger writes.
   */
  public static async calculateCommissionForMemberPurchase(
    memberId: string,
    orderId: string,
    options?: CommissionCalculationOptions,
    client?: Prisma.TransactionClient
  ): Promise<CommissionBreakdown> {
    const db = client || prisma;

    // 1. Resolve order
    const order = await db.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
      include: {
        distributor: true,
        customer: true,
      },
    });

    if (!order) {
      throw AppError.notFound(`Order with ID '${orderId}' not found`, 'ORDER_NOT_FOUND');
    }

    // 2. Validate order qualification & authoritative BV
    const eligibility = AuthoritativeBVService.validateOrderBVEligibility(order);

    if (!eligibility.isEligible) {
      if (options?.allowPreview && eligibility.reason === 'ORDER_NOT_PAID') {
        // Proceed with preview calculation for unpaid orders
      } else {
        if (eligibility.reason === 'ORDER_NOT_PAID') {
          throw AppError.badRequest(
            eligibility.message ||
              `Cannot calculate commission for order in '${order.status}' status. Order must be PAID or CONFIRMED.`,
            'ORDER_NOT_PAID'
          );
        }

        // Cancelled, refunded, or zero BV orders produce zero commissions
        return this.createBreakdownResult([], {
          businessVolume: eligibility.commissionableBVNumber,
          totalCommissionAmount: 0,
          totalDistributedPercentage: 0,
          totalTheoreticalAmount: 0,
          totalTheoreticalPercentage: this.TOTAL_THEORETICAL_PERCENTAGE,
          skippedLevels: CANONICAL_COMMISSION_TIERS.map((tier) => ({
            level: tier.level,
            percentage: tier.percentage,
            reason: (eligibility.reason === 'ORDER_CANCELLED'
              ? 'ORDER_CANCELLED'
              : 'ZERO_BV') as any,
          })),
          orderId: order.id,
          orderNumber: order.orderNumber,
          memberId,
        });
      }
    }

    const orderBV = eligibility.commissionableBVNumber;
    if (orderBV <= 0) {
      return this.createBreakdownResult([], {
        businessVolume: 0,
        totalCommissionAmount: 0,
        totalDistributedPercentage: 0,
        totalTheoreticalAmount: 0,
        totalTheoreticalPercentage: this.TOTAL_THEORETICAL_PERCENTAGE,
        skippedLevels: CANONICAL_COMMISSION_TIERS.map((tier) => ({
          level: tier.level,
          percentage: tier.percentage,
          reason: 'ZERO_BV',
        })),
        orderId: order.id,
        orderNumber: order.orderNumber,
        memberId,
      });
    }

    // 3. Calculate upline commission using authoritative order BV
    const breakdown = await this.calculateUplineCommission(memberId, orderBV, options, db);

    breakdown.orderId = order.id;
    breakdown.orderNumber = order.orderNumber;

    return breakdown;
  }

  /**
   * 4. calculateCommissionForOrder(orderId, options?, client?)
   *
   * Automatically resolves the purchasing member from the order and calculates
   * the full 5-level unilevel commission breakdown.
   *
   * Returns:
   * [
   *   {
   *     level: 1,
   *     recipientId,
   *     businessVolume,
   *     percentage,
   *     commissionAmount
   *   },
   *   ...
   * ]
   *
   * Pure calculation: Does not credit wallets or execute financial posting.
   * Deterministic: Repeated calls return identical breakdowns.
   */
  public static async calculateCommissionForOrder(
    orderId: string,
    options?: CommissionCalculationOptions,
    client?: Prisma.TransactionClient
  ): Promise<CommissionBreakdown> {
    const db = client || prisma;

    const order = await db.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderNumber: orderId }],
      },
      include: {
        distributor: true,
        customer: { include: { sponsor: true } },
      },
    });

    if (!order) {
      throw AppError.notFound(`Order with ID '${orderId}' not found`, 'ORDER_NOT_FOUND');
    }

    const purchaserId = order.distributorId || order.customer?.sponsorId;
    if (!purchaserId) {
      logger.warn(
        { orderId: order.id, orderNumber: order.orderNumber },
        'Order has no associated distributor or customer sponsor; returning empty commission breakdown'
      );
      return this.createBreakdownResult([], {
        businessVolume: Number(order.totalBV ?? 0),
        totalCommissionAmount: 0,
        totalDistributedPercentage: 0,
        totalTheoreticalAmount: 0,
        totalTheoreticalPercentage: this.TOTAL_THEORETICAL_PERCENTAGE,
        skippedLevels: CANONICAL_COMMISSION_TIERS.map((t) => ({
          level: t.level,
          percentage: t.percentage,
          reason: 'NO_UPLINE_EXISTS',
        })),
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    return this.calculateCommissionForMemberPurchase(purchaserId, order.id, options, db);
  }

  /**
   * Helper: Calculates theoretical maximum commission if all 5 uplines exist and qualify.
   * Useful for simulations, marketing previews, and compliance checks.
   */
  public static calculateTheoreticalCommission(
    businessVolume: Prisma.Decimal.Value | number | string,
    customRates?: Array<{ level: number; percentage: number }>
  ): TheoreticalCommissionResult {
    const cleanBV = SafeDecimal.round(businessVolume, 2);
    const tiers = customRates || CANONICAL_COMMISSION_TIERS;

    let totalTheoreticalAmount = 0;
    let totalTheoreticalPercentage = 0;

    const calculatedTiers = tiers.map((tier) => {
      const amount = this.calculateCommissionAmount(cleanBV, tier.percentage);
      totalTheoreticalAmount = SafeDecimal.round(totalTheoreticalAmount + amount, 2);
      totalTheoreticalPercentage = SafeDecimal.round(totalTheoreticalPercentage + tier.percentage, 2);

      return {
        level: tier.level,
        percentage: tier.percentage,
        commissionAmount: amount,
        formula: `${cleanBV.toLocaleString('en-IN')} × ${tier.percentage}% = ₹${amount.toLocaleString('en-IN')}`,
      };
    });

    return {
      businessVolume: cleanBV,
      totalTheoreticalPercentage,
      totalTheoreticalAmount,
      tiers: calculatedTiers,
    };
  }

  /**
   * SEPARATE OPERATION: postCommissionBreakdownToLedger
   *
   * Explicitly persists a calculated commission breakdown into the immutable
   * LevelCommission database ledger in 'CALCULATED' status.
   *
   * STRICT SEPARATION: Financial ledger posting and wallet crediting are isolated
   * from the pure calculation methods above.
   */
  public static async postCommissionBreakdownToLedger(
    orderId: string,
    breakdown?: CommissionBreakdown,
    client?: Prisma.TransactionClient
  ): Promise<{ postedCount: number; commissionIds: string[] }> {
    const runner = async (db: Prisma.TransactionClient) => {
      const items = breakdown || (await this.calculateCommissionForOrder(orderId, undefined, db));

      const order = await db.order.findFirst({
        where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
      });

      if (!order) {
        throw AppError.notFound(`Order '${orderId}' not found`, 'ORDER_NOT_FOUND');
      }

      // Check existing to prevent duplicate insertions (Idempotency)
      const existing = await db.levelCommission.findMany({
        where: { orderId: order.id },
      });

      if (existing.length > 0) {
        return {
          postedCount: existing.length,
          commissionIds: existing.map((c) => c.id),
        };
      }

      const createdIds: string[] = [];

      for (const item of items) {
        const businessReference = `LEVEL:${order.id}:L${item.level}:${item.recipientId}`;
        const commissionNumber = `LCM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const created = await db.levelCommission.create({
          data: {
            commissionNumber,
            businessReference,
            orderId: order.id,
            distributorId: item.recipientId,
            sourceDistributorId: breakdown?.memberId || order.distributorId || item.recipientId,
            level: item.level,
            ratePercentage: new Prisma.Decimal(item.percentage),
            orderBV: new Prisma.Decimal(item.businessVolume),
            commissionableBusinessVolume: new Prisma.Decimal(item.businessVolume),
            commissionAmount: new Prisma.Decimal(item.commissionAmount),
            status: 'CALCULATED',
            currency: 'INR',
            calculationDetails: {
              level: item.level,
              ratePercentage: item.percentage,
              orderBV: item.businessVolume,
              recipientCode: item.recipientCode,
              recipientName: item.recipientName,
            },
          },
        });

        createdIds.push(created.id);
      }

      return {
        postedCount: createdIds.length,
        commissionIds: createdIds,
      };
    };

    if (client) {
      return runner(client);
    }
    return prisma.$transaction(runner, { timeout: 15000 });
  }
}

// Export convenient aliases
export const CommissionEngineService = CommissionCalculationService;
export const CommissionCalculationEngine = CommissionCalculationService;
export const DedicatedCommissionService = CommissionCalculationService;
