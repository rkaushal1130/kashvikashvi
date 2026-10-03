import { Prisma, CommissionRuleType, CommissionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/appError';
import { BVService } from './bv.service';
import { WalletService } from './wallet.service';

export interface CommissionBreakdownItem {
  name: string;
  amount: number;
  description: string;
}

export interface CommissionSummaryResult {
  estimatedCommission: number;
  currency: string;
  currencySymbol: string;
  isQualified: boolean;
  qualificationStatus: string;
  breakdown: CommissionBreakdownItem[];
}

export interface QualificationStatusResult {
  isCommissionQualified: boolean;
  statusText: string;
  personalBV: number;
  requiredPersonalBV: number;
  activeLegs: number;
  requiredActiveLegs: number;
  cycle: string;
  cycleEndDate: string;
}

export interface WeeklyCalculationResult {
  periodId: string;
  periodCode: string;
  distributorsEvaluated: number;
  commissionsGenerated: number;
  totalAmountCalculated: number;
  breakdown: Record<string, number>;
}

export class CommissionService {
  /**
   * Ensures default database-driven commission rules are seeded if not present.
   */
  public static async ensureDefaultRules(client?: Prisma.TransactionClient): Promise<void> {
    const db = client || prisma;

    const defaultRules = [
      {
        name: 'Standard Base Commission Rule',
        type: 'BASE' as CommissionRuleType,
        enabled: true,
        priority: 1,
        configurationJson: {
          percentage: 20,
          minPersonalBV: 100,
          minActiveLegs: 2,
          description: 'Base commission of 20% on matched lesser leg volume across active Business Centers',
        },
      },
      {
        name: 'Preferred Customer Order Bonus',
        type: 'PC_ORDER' as CommissionRuleType,
        enabled: true,
        priority: 1,
        configurationJson: {
          bonusPercentage: 10,
          minOrderBV: 1,
          description: '10% cash bonus on initial and repeat orders made by enrolled Preferred Customers',
        },
      },
      {
        name: 'Fast Start Milestone Incentive Bonus',
        type: 'MILESTONE' as CommissionRuleType,
        enabled: true,
        priority: 1,
        configurationJson: {
          milestones: {
            FAST_START_500: {
              name: '500 BV Fast Start',
              daysLimit: 30,
              requiredBV: 500,
              bonusAmount: 100,
            },
            DIRECTOR_1000: {
              name: '1,000 BV Director Milestone',
              daysLimit: 60,
              requiredBV: 1000,
              bonusAmount: 250,
            },
            TEAM_BUILDER_4: {
              name: 'Team Builder 4 Active Frontline',
              daysLimit: 60,
              requiredActiveFrontline: 4,
              bonusAmount: 200,
            },
          },
        },
      },
      {
        name: 'Frontline Leadership Matching Bonus',
        type: 'FRONTLINE' as CommissionRuleType,
        enabled: true,
        priority: 1,
        configurationJson: {
          matchPercentage: 10,
          minPersonalBV: 100,
          minActiveLegs: 2,
          description: '10% matching bonus earned on base commission of personally sponsored frontline partners',
        },
      },
      {
        name: 'Binary Dual-Leg Matching Commission',
        type: 'BINARY' as CommissionRuleType,
        enabled: true,
        priority: 1,
        configurationJson: {
          matchPercentage: 15,
          minLegVolume: 100,
          maxPayoutCap: 10000,
          carryoverEnabled: true,
          description: '15% binary commission on matched volume of lesser leg across active Business Centers',
        },
      },
      {
        name: 'Executive Rank Advancement Bonus',
        type: 'RANK' as CommissionRuleType,
        enabled: true,
        priority: 1,
        configurationJson: {
          payouts: {
            BRONZE: 50,
            SILVER: 150,
            GOLD: 500,
            PLATINUM: 1500,
            DIAMOND: 5000,
            CROWN: 10000,
          },
          isOneTime: true,
        },
      },
    ];

    for (const rule of defaultRules) {
      const existing = await db.commissionRule.findFirst({
        where: { type: rule.type },
      });

      if (!existing) {
        await db.commissionRule.create({
          data: {
            name: rule.name,
            type: rule.type,
            enabled: rule.enabled,
            priority: rule.priority,
            configurationJson: rule.configurationJson,
          },
        });
        logger.info({ type: rule.type }, 'Default database commission rule initialized');
      }
    }
  }

  /**
   * Retrieves the active database-driven rule for a specified rule type.
   * Considers enabled state, priority, and optional effective dates.
   */
  public static async getActiveRule(
    type: CommissionRuleType,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const now = new Date();

    const rule = await db.commissionRule.findFirst({
      where: {
        type,
        enabled: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
        AND: [
          {
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    return rule;
  }

  /**
   * Calculates Base Commission for a period.
   * Database-driven, idempotent, append-only commission ledger entry.
   */
  public static async calculateBaseCommission(
    periodId: string,
    distributorId?: string,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const rule = await this.getActiveRule('BASE', db);
    if (!rule) {
      logger.info('No active BASE commission rule found in database; skipping');
      return [];
    }

    const config = (rule.configurationJson as any) || { percentage: 20, minPersonalBV: 100, minActiveLegs: 2 };
    const percentage = Number(config.percentage || 20);
    const minPersonalBV = Number(config.minPersonalBV || 100);
    const minActiveLegs = Number(config.minActiveLegs || 2);

    const distributors = await db.distributorProfile.findMany({
      where: {
        status: 'ACTIVE',
        ...(distributorId ? { id: distributorId } : {}),
      },
      include: {
        businessCenters: true,
        sponsoredDistributors: { where: { status: 'ACTIVE' } },
      },
    });

    const results = [];

    for (const dist of distributors) {
      // Check qualification
      const personalBV = Number(dist.lifetimePV);
      const activeLegsCount = dist.sponsoredDistributors.length;
      if (personalBV < minPersonalBV || activeLegsCount < minActiveLegs) {
        continue;
      }

      for (const bc of dist.businessCenters) {
        // Query leg volumes for this business center
        const [leftResult, rightResult] = await Promise.all([
          BVService.getLeftBV(dist.id, { periodId, businessCenterId: bc.id }, db),
          BVService.getRightBV(dist.id, { periodId, businessCenterId: bc.id }, db),
        ]);

        const leftBV = leftResult.totalBV > 0 ? leftResult.totalBV : Number(bc.leftVolume);
        const rightBV = rightResult.totalBV > 0 ? rightResult.totalBV : Number(bc.rightVolume);
        const matchedVolume = Math.min(leftBV, rightBV);

        if (matchedVolume <= 0) continue;

        const commissionAmount = Number(((matchedVolume * percentage) / 100).toFixed(2));
        if (commissionAmount <= 0) continue;

        // Idempotency: unique business reference
        const businessReference = `BASE:${periodId}:${dist.id}:${bc.id}`;

        const existing = await db.commission.findUnique({
          where: { businessReference },
        });

        if (existing) {
          results.push(existing);
          continue;
        }

        const commissionNumber = `COM-BASE-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const entry = await db.commission.create({
          data: {
            commissionNumber,
            businessReference,
            distributorId: dist.id,
            businessCenterId: bc.id,
            periodId,
            ruleId: rule.id,
            type: 'BASE',
            amount: new Prisma.Decimal(commissionAmount),
            status: 'CALCULATED',
            leftVolumeMatched: new Prisma.Decimal(matchedVolume),
            rightVolumeMatched: new Prisma.Decimal(matchedVolume),
            details: {
              percentage,
              leftBV,
              rightBV,
              matchedVolume,
            },
          },
        });

        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Calculates Preferred Customer (PC) Order Bonus.
   * Triggered when a preferred customer places a qualified paid order.
   * Idempotent: processing the same order multiple times NEVER creates duplicate commissions.
   * Does NOT directly modify wallet balance. Creates commission ledger first.
   */
  public static async calculatePCOrderBonus(
    orderId: string,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const rule = await this.getActiveRule('PC_ORDER', db);
    if (!rule) {
      logger.info('No active PC_ORDER commission rule found; skipping');
      return null;
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            sponsor: true,
          },
        },
        distributor: {
          include: {
            sponsor: true,
          },
        },
      },
    });

    if (!order) return null;

    // Must be paid/confirmed and have positive BV
    if (order.status !== 'PAID' && order.status !== 'CONFIRMED') {
      return null;
    }

    const orderBV = Number(order.totalBV);
    if (orderBV <= 0) return null;

    // Resolve sponsor to receive PC Order Bonus
    const sponsor = order.customer?.sponsor || order.distributor?.sponsor;
    if (!sponsor) return null;

    const config = (rule.configurationJson as any) || { bonusPercentage: 10, minOrderBV: 1 };
    const bonusPercentage = Number(config.bonusPercentage || 10);
    const minOrderBV = Number(config.minOrderBV || 1);

    if (orderBV < minOrderBV) return null;

    const bonusAmount = Number(((orderBV * bonusPercentage) / 100).toFixed(2));
    if (bonusAmount <= 0) return null;

    // Idempotency check: unique business reference
    const businessReference = `PC_ORDER:${order.id}:${sponsor.id}`;

    const existing = await db.commission.findUnique({
      where: { businessReference },
    });

    if (existing) {
      logger.info({ businessReference }, 'PC order commission already exists; skipping duplicate');
      return existing;
    }

    // Resolve open period
    const period = await db.commissionPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });

    const commissionNumber = `COM-PC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const entry = await db.commission.create({
      data: {
        commissionNumber,
        businessReference,
        distributorId: sponsor.id,
        periodId: period?.id || null,
        ruleId: rule.id,
        type: 'PC_ORDER',
        amount: new Prisma.Decimal(bonusAmount),
        status: 'CALCULATED',
        sourceOrderId: order.id,
        sourceDistributorId: order.distributorId || null,
        details: {
          orderNumber: order.orderNumber,
          orderBV,
          bonusPercentage,
        },
      },
    });

    logger.info(
      {
        commissionId: entry.id,
        businessReference,
        sponsorId: sponsor.id,
        bonusAmount,
      },
      'PC order bonus calculated and recorded in commission ledger'
    );

    return entry;
  }

  /**
   * Calculates Milestone Bonus for fast-growth or volume thresholds.
   * Idempotent per distributor and milestone key.
   */
  public static async calculateMilestoneBonus(
    distributorId: string,
    milestoneKey: string,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const rule = await this.getActiveRule('MILESTONE', db);
    if (!rule) return null;

    const config = (rule.configurationJson as any) || {};
    const milestones = config.milestones || {};
    const milestone = milestones[milestoneKey];

    if (!milestone) {
      throw AppError.notFound(`Milestone ${milestoneKey} not defined in commission rule configuration`);
    }

    const businessReference = `MILESTONE:${distributorId}:${milestoneKey}`;

    // Idempotency: if already awarded, return existing
    const existing = await db.commission.findUnique({
      where: { businessReference },
    });
    if (existing) return existing;

    const distributor = await db.distributorProfile.findUnique({
      where: { id: distributorId },
      include: { sponsoredDistributors: { where: { status: 'ACTIVE' } } },
    });
    if (!distributor) throw AppError.notFound('Distributor not found');

    // Evaluate conditions
    const lifetimePV = Number(distributor.lifetimePV);
    const activeFrontline = distributor.sponsoredDistributors.length;

    if (milestone.requiredBV && lifetimePV < milestone.requiredBV) {
      return null;
    }
    if (milestone.requiredActiveFrontline && activeFrontline < milestone.requiredActiveFrontline) {
      return null;
    }

    // Check days limit if configured
    if (milestone.daysLimit) {
      const daysSinceJoining = Math.floor(
        (Date.now() - new Date(distributor.joinedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceJoining > milestone.daysLimit) {
        return null;
      }
    }

    const bonusAmount = Number(milestone.bonusAmount || 0);
    if (bonusAmount <= 0) return null;

    const commissionNumber = `COM-MS-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const entry = await db.commission.create({
      data: {
        commissionNumber,
        businessReference,
        distributorId,
        ruleId: rule.id,
        type: 'MILESTONE',
        amount: new Prisma.Decimal(bonusAmount),
        status: 'CALCULATED',
        details: {
          milestoneKey,
          milestoneName: milestone.name,
          bonusAmount,
        },
      },
    });

    return entry;
  }

  /**
   * Calculates Frontline Leadership Matching Bonus.
   * Matches base/binary commissions earned by personally sponsored partners.
   */
  public static async calculateFrontlineBonus(
    periodId: string,
    distributorId?: string,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const rule = await this.getActiveRule('FRONTLINE', db);
    if (!rule) return [];

    const config = (rule.configurationJson as any) || { matchPercentage: 10, minPersonalBV: 100 };
    const matchPercentage = Number(config.matchPercentage || 10);
    const minPersonalBV = Number(config.minPersonalBV || 100);

    const sponsors = await db.distributorProfile.findMany({
      where: {
        status: 'ACTIVE',
        ...(distributorId ? { id: distributorId } : {}),
      },
      include: {
        sponsoredDistributors: { where: { status: 'ACTIVE' } },
      },
    });

    const results = [];

    for (const sponsor of sponsors) {
      if (Number(sponsor.lifetimePV) < minPersonalBV) continue;

      for (const frontline of sponsor.sponsoredDistributors) {
        // Query commissions earned by frontline partner in this period
        const frontlineCommissions = await db.commission.findMany({
          where: {
            distributorId: frontline.id,
            periodId,
            type: { in: ['BASE', 'BINARY'] },
            status: { in: ['CALCULATED', 'QUALIFIED', 'PAID'] },
          },
        });

        const totalEarned = frontlineCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
        if (totalEarned <= 0) continue;

        const bonusAmount = Number(((totalEarned * matchPercentage) / 100).toFixed(2));
        if (bonusAmount <= 0) continue;

        // Idempotent business reference
        const businessReference = `FRONTLINE:${periodId}:${sponsor.id}:${frontline.id}`;

        const existing = await db.commission.findUnique({
          where: { businessReference },
        });

        if (existing) {
          results.push(existing);
          continue;
        }

        const commissionNumber = `COM-FL-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const entry = await db.commission.create({
          data: {
            commissionNumber,
            businessReference,
            distributorId: sponsor.id,
            periodId,
            ruleId: rule.id,
            type: 'FRONTLINE',
            amount: new Prisma.Decimal(bonusAmount),
            status: 'CALCULATED',
            sourceDistributorId: frontline.id,
            details: {
              frontlineId: frontline.id,
              frontlineCode: frontline.distributorCode,
              frontlineCommissionTotal: totalEarned,
              matchPercentage,
            },
          },
        });

        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Calculates Binary Dual-Leg Matching Commission.
   * Matches lesser leg volume across active Business Centers.
   */
  public static async calculateBinaryCommission(
    periodId: string,
    distributorId?: string,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const rule = await this.getActiveRule('BINARY', db);
    if (!rule) return [];

    const config = (rule.configurationJson as any) || { matchPercentage: 15, minLegVolume: 100, maxPayoutCap: 10000 };
    const matchPercentage = Number(config.matchPercentage || 15);
    const minLegVolume = Number(config.minLegVolume || 100);
    const maxPayoutCap = config.maxPayoutCap ? Number(config.maxPayoutCap) : null;

    const distributors = await db.distributorProfile.findMany({
      where: {
        status: 'ACTIVE',
        ...(distributorId ? { id: distributorId } : {}),
      },
      include: {
        businessCenters: true,
      },
    });

    const results = [];

    for (const dist of distributors) {
      for (const bc of dist.businessCenters) {
        const [leftResult, rightResult] = await Promise.all([
          BVService.getLeftBV(dist.id, { periodId, businessCenterId: bc.id }, db),
          BVService.getRightBV(dist.id, { periodId, businessCenterId: bc.id }, db),
        ]);

        const leftBV = leftResult.totalBV > 0 ? leftResult.totalBV : Number(bc.leftVolume);
        const rightBV = rightResult.totalBV > 0 ? rightResult.totalBV : Number(bc.rightVolume);
        const matchedVolume = Math.min(leftBV, rightBV);

        if (matchedVolume < minLegVolume) continue;

        let calculatedPayout = Number(((matchedVolume * matchPercentage) / 100).toFixed(2));
        if (maxPayoutCap && calculatedPayout > maxPayoutCap) {
          calculatedPayout = maxPayoutCap;
        }

        if (calculatedPayout <= 0) continue;

        const businessReference = `BINARY:${periodId}:${dist.id}:${bc.id}`;

        const existing = await db.commission.findUnique({
          where: { businessReference },
        });

        if (existing) {
          results.push(existing);
          continue;
        }

        const commissionNumber = `COM-BIN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const entry = await db.commission.create({
          data: {
            commissionNumber,
            businessReference,
            distributorId: dist.id,
            businessCenterId: bc.id,
            periodId,
            ruleId: rule.id,
            type: 'BINARY',
            amount: new Prisma.Decimal(calculatedPayout),
            status: 'CALCULATED',
            leftVolumeMatched: new Prisma.Decimal(matchedVolume),
            rightVolumeMatched: new Prisma.Decimal(matchedVolume),
            details: {
              leftBV,
              rightBV,
              matchedVolume,
              matchPercentage,
              maxPayoutCap,
            },
          },
        });

        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Calculates Rank Advancement or Maintenance Bonus.
   * Idempotent: one-time rank rewards are never paid more than once per rank.
   */
  public static async calculateRankBonus(
    distributorId: string,
    rankCode: string,
    periodId?: string,
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const rule = await this.getActiveRule('RANK', db);
    if (!rule) return null;

    const config = (rule.configurationJson as any) || { payouts: {}, isOneTime: true };
    const payouts = config.payouts || {};
    const normalizedRank = rankCode.toUpperCase();
    const bonusAmount = Number(payouts[normalizedRank] || 0);

    if (bonusAmount <= 0) return null;

    // Unique reference: ONE-TIME vs PERIODIC
    const isOneTime = config.isOneTime !== false;
    const businessReference = isOneTime
      ? `RANK:ONETIME:${distributorId}:${normalizedRank}`
      : `RANK:${periodId || 'CYCLE'}:${distributorId}:${normalizedRank}`;

    const existing = await db.commission.findUnique({
      where: { businessReference },
    });
    if (existing) return existing;

    const commissionNumber = `COM-RNK-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const entry = await db.commission.create({
      data: {
        commissionNumber,
        businessReference,
        distributorId,
        periodId: periodId || null,
        ruleId: rule.id,
        type: 'RANK',
        amount: new Prisma.Decimal(bonusAmount),
        status: 'CALCULATED',
        details: {
          rankCode: normalizedRank,
          bonusAmount,
          isOneTime,
        },
      },
    });

    return entry;
  }

  /**
   * Orchestrates the weekly commission calculation run for an active period.
   * Executes Base, Binary, and Frontline calculation engines.
   * Purely creates ledger entries; wallet balances are untouched.
   */
  public static async calculateWeeklyCommission(
    periodIdOrCode?: string,
    client?: Prisma.TransactionClient
  ): Promise<WeeklyCalculationResult> {
    const db = client || prisma;

    // Ensure database-driven rules exist
    await this.ensureDefaultRules(db);

    // Resolve or generate current weekly period
    let period: any = null;
    if (periodIdOrCode) {
      period = await db.commissionPeriod.findFirst({
        where: {
          OR: [{ id: periodIdOrCode }, { periodCode: periodIdOrCode }],
        },
      });
    }

    if (!period) {
      period = await db.commissionPeriod.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startDate: 'desc' },
      });
    }

    if (!period) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const weekNumber = Math.ceil(now.getDate() / 7);
      const periodCode = `W-${now.getFullYear()}-${now.getMonth() + 1}-${weekNumber}`;

      period = await db.commissionPeriod.upsert({
        where: { periodCode },
        update: {},
        create: {
          periodCode,
          startDate: startOfWeek,
          endDate: endOfWeek,
          status: 'OPEN',
        },
      });
    }

    logger.info({ periodId: period.id, periodCode: period.periodCode }, 'Starting weekly commission calculation run');

    // Run core commission engines
    const [baseCommissions, binaryCommissions, frontlineCommissions] = await Promise.all([
      this.calculateBaseCommission(period.id, undefined, db),
      this.calculateBinaryCommission(period.id, undefined, db),
      this.calculateFrontlineBonus(period.id, undefined, db),
    ]);

    const allGenerated = [...baseCommissions, ...binaryCommissions, ...frontlineCommissions];
    const totalAmount = allGenerated.reduce((sum, c) => sum + Number(c.amount), 0);

    // Update period totals
    await db.commissionPeriod.update({
      where: { id: period.id },
      data: {
        totalCommissionsCalculated: new Prisma.Decimal(totalAmount),
      },
    });

    const activeDistributorsCount = await db.distributorProfile.count({
      where: { status: 'ACTIVE' },
    });

    return {
      periodId: period.id,
      periodCode: period.periodCode,
      distributorsEvaluated: activeDistributorsCount,
      commissionsGenerated: allGenerated.length,
      totalAmountCalculated: Number(totalAmount.toFixed(2)),
      breakdown: {
        BASE: baseCommissions.reduce((sum, c) => sum + Number(c.amount), 0),
        BINARY: binaryCommissions.reduce((sum, c) => sum + Number(c.amount), 0),
        FRONTLINE: frontlineCommissions.reduce((sum, c) => sum + Number(c.amount), 0),
      },
    };
  }

  /**
   * Payout Processing: transitions eligible CALCULATED commissions to PAID
   * and credits the respective distributor wallet via a WalletTransaction.
   * Adheres to the rule: "Do not directly modify wallet balance during calculation.
   * Create commission ledger first. Then wallet service processes eligible payable commissions."
   */
  public static async payoutCommissions(
    options: {
      periodId?: string;
      commissionIds?: string[];
      distributorId?: string;
    },
    client?: Prisma.TransactionClient
  ): Promise<{
    paidCount: number;
    totalPaidAmount: number;
    commissionIds: string[];
  }> {
    return WalletService.processPayableCommissions(options, client);
  }

  /**
   * Backward-compatible helper for order creation pipeline.
   * Invokes calculatePCOrderBonus idempotently without modifying wallet balances.
   */
  public static async processOrderCommissions(
    orderId: string,
    client?: Prisma.TransactionClient
  ): Promise<boolean> {
    try {
      const result = await this.calculatePCOrderBonus(orderId, client);
      return result !== null;
    } catch (err) {
      logger.error({ orderId, err }, 'Failed to process order commission');
      return false;
    }
  }

  /**
   * Real-time commission dashboard summary.
   */
  public static async getCommissionSummary(distributorId: string): Promise<CommissionSummaryResult> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { id: distributorId },
      include: {
        businessCenters: true,
        sponsoredDistributors: { where: { status: 'ACTIVE' } },
      },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    // Sum recent calculated commissions
    const activeCommissions = await prisma.commission.findMany({
      where: {
        distributorId,
        status: { in: ['CALCULATED', 'QUALIFIED'] },
      },
    });

    const totalBase = activeCommissions
      .filter((c) => c.type === 'BASE' || c.type === 'BINARY')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const pcBonus = activeCommissions
      .filter((c) => c.type === 'PC_ORDER')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const milestoneBonus = activeCommissions
      .filter((c) => c.type === 'MILESTONE')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const frontlineBonus = activeCommissions
      .filter((c) => c.type === 'FRONTLINE')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const rankBonus = activeCommissions
      .filter((c) => c.type === 'RANK')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    // Qualification Check
    const personalBV = Number(distributor.lifetimePV);
    const requiredPersonalBV = 100;
    const activeLegsCount = distributor.sponsoredDistributors.length;
    const isQualified = personalBV >= requiredPersonalBV && activeLegsCount >= 2;
    const qualificationStatus = isQualified ? 'Commission Qualified' : 'Not Commission Qualified';

    const totalEstimatedCommission = Number(
      (totalBase + pcBonus + milestoneBonus + frontlineBonus + rankBonus).toFixed(2)
    );

    return {
      estimatedCommission: totalEstimatedCommission,
      currency: 'CP',
      currencySymbol: 'CP',
      isQualified,
      qualificationStatus,
      breakdown: [
        {
          name: 'Binary Commission',
          amount: Number(totalBase.toFixed(2)),
          description:
            'Binary Commission is calculated weekly on balanced Commission Volume Points (CVP) across your active Business Centers.',
        },
        {
          name: 'Frontline Bonus',
          amount: Number(frontlineBonus.toFixed(2)),
          description:
            'Matching leadership bonus earned on the base/binary commission of your personally sponsored partners.',
        },
        {
          name: 'Milestone Bonus',
          amount: Number(milestoneBonus.toFixed(2)),
          description:
            'Incentive bonuses awarded when achieving key volume and frontline growth milestones.',
        },
        {
          name: 'Rank Bonus',
          amount: Number(rankBonus.toFixed(2)),
          description:
            'One-time advancement awards and leadership pool rewards upon achieving higher ranks.',
        },
        {
          name: 'Customer/PC Bonus',
          amount: Number(pcBonus.toFixed(2)),
          description:
            'Cash bonus on initial and repeat orders made by your enrolled Preferred Customers.',
        },
      ],
    };
  }

  /**
   * Retrieves qualification progress and weekly cycle calendar info.
   */
  public static async getQualificationStatus(distributorId: string): Promise<QualificationStatusResult> {
    const distributor = await prisma.distributorProfile.findUnique({
      where: { id: distributorId },
      include: {
        sponsoredDistributors: true,
      },
    });

    if (!distributor) {
      throw AppError.notFound('Distributor not found.', 'DISTRIBUTOR_NOT_FOUND');
    }

    const personalBV = Number(distributor.lifetimePV);
    const requiredPersonalBV = 100;
    const activeLegs = distributor.sponsoredDistributors.filter(
      (d) => d.status === 'ACTIVE'
    ).length;
    const requiredActiveLegs = 2;
    const isCommissionQualified = personalBV >= requiredPersonalBV && activeLegs >= requiredActiveLegs;

    const now = new Date();
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(23, 59, 59, 999);

    return {
      isCommissionQualified,
      statusText: isCommissionQualified ? 'Commission Qualified' : 'Not Commission Qualified',
      personalBV,
      requiredPersonalBV,
      activeLegs,
      requiredActiveLegs,
      cycle: '1/1A',
      cycleEndDate: friday.toISOString(),
    };
  }
}
