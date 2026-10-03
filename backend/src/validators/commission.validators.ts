import { z } from 'zod';

export const commissionRuleTypeEnum = z.enum([
  'BASE',
  'PC_ORDER',
  'MILESTONE',
  'FRONTLINE',
  'BINARY',
  'RANK',
  'OTHER',
]);

export const commissionStatusEnum = z.enum([
  'PENDING',
  'QUALIFIED',
  'CALCULATED',
  'PAID',
  'REVERSED',
  'CANCELLED',
]);

export const createCommissionRuleSchema = z.object({
  name: z.string().trim().min(2, 'Rule name must be at least 2 characters'),
  type: commissionRuleTypeEnum,
  enabled: z.boolean().default(true),
  configurationJson: z.any().optional(),
  priority: z.coerce.number().int().min(1).default(1),
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  ruleCode: z.string().trim().optional(),
});

export const updateCommissionRuleSchema = createCommissionRuleSchema.partial();

export const calculateCommissionQuerySchema = z.object({
  periodId: z.string().optional(),
  distributorId: z.string().uuid().optional(),
});

export const processPCOrderBonusSchema = z.object({
  orderId: z.string().uuid('orderId must be a valid UUID'),
});

export const calculateMilestoneBonusSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  milestoneKey: z.string().trim().min(1, 'milestoneKey is required'),
});

export const calculateRankBonusSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  rankCode: z.string().trim().min(1, 'rankCode is required'),
  periodId: z.string().optional(),
});

export const payoutCommissionsSchema = z.object({
  periodId: z.string().optional(),
  commissionIds: z.array(z.string().uuid()).optional(),
  distributorId: z.string().uuid().optional(),
});

export const commissionQuerySchema = z.object({
  distributorId: z.string().uuid().optional(),
  periodId: z.string().optional(),
  type: commissionRuleTypeEnum.optional(),
  status: commissionStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const commissionPeriodStatusEnum = z.enum([
  'OPEN',
  'PROCESSING',
  'CALCULATED',
  'APPROVED',
  'PAID',
  'CLOSED',
]);

export const createCommissionPeriodSchema = z
  .object({
    startDate: z.coerce.date({ required_error: 'startDate is required' }),
    endDate: z.coerce.date({ required_error: 'endDate is required' }),
    status: commissionPeriodStatusEnum.default('OPEN'),
    periodCode: z.string().trim().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export const periodIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Period ID or Code is required'),
});

export const periodHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: commissionPeriodStatusEnum.optional(),
});

export type CreateCommissionRuleInput = z.infer<typeof createCommissionRuleSchema>;
export type UpdateCommissionRuleInput = z.infer<typeof updateCommissionRuleSchema>;
export type CalculateCommissionQueryInput = z.infer<typeof calculateCommissionQuerySchema>;
export type ProcessPCOrderBonusInput = z.infer<typeof processPCOrderBonusSchema>;
export type CalculateMilestoneBonusInput = z.infer<typeof calculateMilestoneBonusSchema>;
export type CalculateRankBonusInput = z.infer<typeof calculateRankBonusSchema>;
export type PayoutCommissionsInput = z.infer<typeof payoutCommissionsSchema>;
export type CommissionQueryInput = z.infer<typeof commissionQuerySchema>;
export type CreateCommissionPeriodInput = z.infer<typeof createCommissionPeriodSchema>;
export type PeriodHistoryQueryInput = z.infer<typeof periodHistoryQuerySchema>;
