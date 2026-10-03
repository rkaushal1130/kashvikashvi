import { z } from 'zod';

export const bvSourceTypeEnum = z.enum([
  'ORDER',
  'ORDER_REFUND',
  'ADJUSTMENT',
  'BONUS',
  'REVERSAL',
]);

export const placementLegEnum = z.enum(['LEFT', 'RIGHT']);

export const creditBVSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  businessCenterId: z.string().uuid('businessCenterId must be a valid UUID').optional(),
  sourceType: bvSourceTypeEnum.default('ORDER'),
  sourceId: z.string().trim().min(1, 'Transaction reference (sourceId) is required'),
  bv: z.coerce.number().positive('BV credit amount must be greater than zero'),
  position: placementLegEnum.nullable().optional(),
  sourceDistributorId: z.string().uuid().optional(),
  description: z.string().trim().optional(),
  commissionPeriodId: z.string().optional(),
});

export const debitBVSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  businessCenterId: z.string().uuid('businessCenterId must be a valid UUID').optional(),
  sourceType: z.enum(['ORDER_REFUND', 'ADJUSTMENT', 'REVERSAL']).default('ADJUSTMENT'),
  sourceId: z.string().trim().min(1, 'Transaction reference (sourceId) is required'),
  bv: z.coerce.number().positive('BV debit amount must be greater than zero'),
  position: placementLegEnum.nullable().optional(),
  description: z.string().trim().optional(),
  commissionPeriodId: z.string().optional(),
});

export const reverseBVTransactionSchema = z.object({
  originalTransactionId: z.string().uuid('originalTransactionId must be a valid UUID'),
  reason: z.string().trim().min(3, 'Reversal reason is required'),
  referenceId: z.string().trim().min(1, 'Reversal reference ID is required'),
});

export const bvLedgerQuerySchema = z.object({
  sourceType: bvSourceTypeEnum.optional(),
  position: placementLegEnum.optional(),
  businessCenterId: z.string().uuid().optional(),
  commissionPeriodId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const periodParamSchema = z.object({
  periodId: z.string().min(1, 'Period ID or Code is required').trim(),
});

export type CreditBVInput = z.infer<typeof creditBVSchema>;
export type DebitBVInput = z.infer<typeof debitBVSchema>;
export type ReverseBVTransactionInput = z.infer<typeof reverseBVTransactionSchema>;
export type BVLedgerQueryInput = z.infer<typeof bvLedgerQuerySchema>;
