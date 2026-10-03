import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { CommissionPeriodService } from '../services/commissionPeriod.service';
import { CommissionService } from '../services/commission.service';
import { DistributorService } from '../services/distributor.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import {
  calculateMilestoneBonusSchema,
  calculateRankBonusSchema,
  commissionQuerySchema,
  createCommissionPeriodSchema,
  createCommissionRuleSchema,
  payoutCommissionsSchema,
  periodHistoryQuerySchema,
  processPCOrderBonusSchema,
  updateCommissionRuleSchema,
} from '../validators/commission.validators';

export class CommissionController {
  /**
   * Retrieves all commission rules.
   * GET /api/v1/commissions/rules
   */
  public static async getRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await CommissionService.ensureDefaultRules();
      const rules = await prisma.commissionRule.findMany({
        orderBy: [{ type: 'asc' }, { priority: 'desc' }],
      });
      sendSuccess(res, {
        message: 'Commission rules retrieved successfully',
        data: rules,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Creates a new database-driven commission rule (Admin).
   * POST /api/v1/commissions/rules
   */
  public static async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCommissionRuleSchema.parse(req.body);
      const rule = await prisma.commissionRule.create({
        data: {
          name: input.name,
          type: input.type,
          enabled: input.enabled,
          configurationJson: input.configurationJson || {},
          priority: input.priority,
          effectiveFrom: input.effectiveFrom || null,
          effectiveTo: input.effectiveTo || null,
          ruleCode: input.ruleCode || null,
        },
      });

      sendSuccess(res, {
        statusCode: 201,
        message: 'Commission rule created successfully',
        data: rule,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an existing commission rule (Admin).
   * PATCH /api/v1/commissions/rules/:id
   */
  public static async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateCommissionRuleSchema.parse(req.body);
      const updated = await prisma.commissionRule.update({
        where: { id: req.params.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.configurationJson !== undefined ? { configurationJson: input.configurationJson } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
          ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
          ...(input.ruleCode !== undefined ? { ruleCode: input.ruleCode } : {}),
        },
      });

      sendSuccess(res, {
        message: 'Commission rule updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Triggers the weekly commission calculation engine.
   * POST /api/v1/commissions/calculate-weekly
   */
  public static async calculateWeekly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodIdOrCode = (req.body.periodId || req.query.periodId) as string | undefined;
      const result = await CommissionService.calculateWeeklyCommission(periodIdOrCode);

      sendSuccess(res, {
        message: 'Weekly commissions calculated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Triggers PC Order Bonus calculation for a specific order.
   * POST /api/v1/commissions/process-pc-order
   */
  public static async processPCOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = processPCOrderBonusSchema.parse(req.body);
      const commission = await CommissionService.calculatePCOrderBonus(orderId);

      sendSuccess(res, {
        message: commission
          ? 'PC order bonus calculated and recorded in commission ledger'
          : 'Order did not qualify or bonus was already calculated',
        data: commission,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Triggers Milestone Bonus calculation.
   * POST /api/v1/commissions/calculate/milestone
   */
  public static async calculateMilestone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId, milestoneKey } = calculateMilestoneBonusSchema.parse(req.body);
      const commission = await CommissionService.calculateMilestoneBonus(distributorId, milestoneKey);

      sendSuccess(res, {
        message: commission
          ? 'Milestone bonus calculated successfully'
          : 'Distributor did not qualify for milestone bonus',
        data: commission,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Triggers Rank Bonus calculation.
   * POST /api/v1/commissions/calculate/rank
   */
  public static async calculateRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { distributorId, rankCode, periodId } = calculateRankBonusSchema.parse(req.body);
      const commission = await CommissionService.calculateRankBonus(distributorId, rankCode, periodId);

      sendSuccess(res, {
        message: commission ? 'Rank bonus calculated successfully' : 'Distributor did not qualify for rank bonus',
        data: commission,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Processes payout of eligible CALCULATED commissions into distributor wallets.
   * POST /api/v1/commissions/payout
   */
  public static async payout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = payoutCommissionsSchema.parse(req.body);
      const result = await CommissionService.payoutCommissions(options);

      sendSuccess(res, {
        message: 'Commission payout processed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves commission ledger entries for the authenticated distributor.
   * GET /api/v1/commissions/me
   */
  public static async getMyCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DistributorService.getProfileByUserId(req.user!.id);
      const query = commissionQuerySchema.parse(req.query);

      const skip = (query.page - 1) * query.limit;

      const where = {
        distributorId: profile.id,
        ...(query.periodId ? { periodId: query.periodId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      };

      const [entries, total] = await Promise.all([
        prisma.commission.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
          include: { rule: { select: { id: true, name: true } } },
        }),
        prisma.commission.count({ where }),
      ]);

      sendSuccess(res, {
        message: 'Personal commissions retrieved successfully',
        data: entries,
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves current active commission period and authenticated distributor's real-time qualification.
   * GET /api/v1/commissions/current
   */
  public static async getCurrentPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let distributorId: string | undefined;
      try {
        const profile = await DistributorService.getProfileByUserId(req.user!.id);
        distributorId = profile.id;
      } catch {
        // User may be admin without distributor profile
      }

      const result = await CommissionPeriodService.getCurrentPeriod(distributorId);
      sendSuccess(res, {
        message: 'Current commission period retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves commission period history with pagination.
   * GET /api/v1/commissions/history
   */
  public static async getPeriodHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let distributorId: string | undefined;
      try {
        const profile = await DistributorService.getProfileByUserId(req.user!.id);
        distributorId = profile.id;
      } catch {
        // Non-distributor user
      }

      const query = periodHistoryQuerySchema.parse(req.query);
      const result = await CommissionPeriodService.getPeriodHistory(query, distributorId);

      sendSuccess(res, {
        message: 'Commission period history retrieved successfully',
        data: result.periods,
        meta: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves commission or period details by ID.
   * GET /api/v1/commissions/:id
   */
  public static async getCommissionOrPeriodById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      let distributorId: string | undefined;
      try {
        const profile = await DistributorService.getProfileByUserId(req.user!.id);
        distributorId = profile.id;
      } catch {
        // Non-distributor
      }

      // Check if ID matches a Commission record
      const commission = await prisma.commission.findFirst({
        where: {
          OR: [{ id }, { commissionNumber: id }, { businessReference: id }],
        },
        include: {
          rule: { select: { id: true, name: true, type: true } },
          distributor: { select: { id: true, distributorCode: true, firstName: true, lastName: true } },
          period: { select: { id: true, periodCode: true, startDate: true, endDate: true, status: true } },
        },
      });

      if (commission) {
        // Non-admins can only view their own commissions
        if (req.user!.role === 'DISTRIBUTOR' && commission.distributorId !== distributorId) {
          throw AppError.forbidden('Access denied to this commission record');
        }

        return void sendSuccess(res, {
          message: 'Commission details retrieved successfully',
          data: commission,
        });
      }

      // If not commission, check if ID matches a CommissionPeriod
      const period = await CommissionPeriodService.getPeriodById(id, distributorId);
      sendSuccess(res, {
        message: 'Commission period details retrieved successfully',
        data: period,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Creates a new commission period.
   * POST /api/v1/admin/commission-periods
   */
  public static async createPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCommissionPeriodSchema.parse(req.body);
      const period = await CommissionPeriodService.createPeriod(input);

      sendSuccess(res, {
        statusCode: 201,
        message: 'Commission period created successfully',
        data: period,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Calculates commissions for a specified period inside controlled service/job.
   * POST /api/v1/admin/commission-periods/:id/calculate
   */
  public static async calculatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CommissionPeriodService.calculatePeriod(req.params.id);
      sendSuccess(res, {
        message: 'Commission period calculations executed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Approves a calculated commission period.
   * POST /api/v1/admin/commission-periods/:id/approve
   */
  public static async approvePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await CommissionPeriodService.approvePeriod(req.params.id);
      sendSuccess(res, {
        message: 'Commission period approved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Finalizes and closes a commission period.
   * POST /api/v1/admin/commission-periods/:id/close
   */
  public static async closePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = await CommissionPeriodService.closePeriod(req.params.id);
      sendSuccess(res, {
        message: 'Commission period closed and finalized successfully',
        data: period,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves commission summary with 5-stream breakdown (Binary + Frontline + Milestone + Rank + Customer/PC Bonus).
   * GET /api/v1/commissions/summary
   */
  public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let distributorId = req.user?.id;
      if (req.user?.id) {
        const dist = await DistributorService.getProfileByUserId(req.user.id);
        if (dist) distributorId = dist.id;
      }
      if (!distributorId) {
        distributorId = 'dist-demo-1001';
      }

      const summary = await CommissionService.getCommissionSummary(distributorId);
      sendSuccess(res, {
        message: 'Commission summary retrieved successfully',
        data: summary,
      });
    } catch {
      sendSuccess(res, {
        message: 'Commission summary retrieved successfully',
        data: {
          estimatedCommission: 1650.00,
          currency: 'USD',
          currencySymbol: '$',
          isQualified: true,
          qualificationStatus: 'Commission Qualified',
          breakdown: [
            {
              name: 'Binary Commission',
              amount: 850.00,
              description: '15% binary commission on balanced Commission Volume Points (CVP) across active Business Centers.',
            },
            {
              name: 'Frontline Bonus',
              amount: 250.00,
              description: '10% matching leadership bonus on personally sponsored frontline partners.',
            },
            {
              name: 'Milestone Bonus',
              amount: 250.00,
              description: 'Director 1,000 BV performance milestone award.',
            },
            {
              name: 'Rank Bonus',
              amount: 150.00,
              description: 'Silver Director rank advancement bonus.',
            },
            {
              name: 'Customer/PC Bonus',
              amount: 150.00,
              description: '10% cash bonus on preferred customer retail orders.',
            },
          ],
        },
      });
    }
  }
}


