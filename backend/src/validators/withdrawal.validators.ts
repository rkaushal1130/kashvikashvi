import { z } from 'zod';

export const withdrawalStatusEnum = z.enum([
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REVERSED',
]);

export const createWithdrawalSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Withdrawal amount must be greater than zero')
    .min(500, 'Minimum withdrawal amount is 500.00 INR')
    .max(100000, 'Maximum single withdrawal amount is 100,000.00 INR'),
  bankAccountId: z.string().uuid('bankAccountId must be a valid UUID'),
  payoutProvider: z.string().trim().max(50).optional(),
  idempotencyKey: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export const validateWithdrawalQuerySchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  bankAccountId: z.string().uuid().optional(),
});

export const withdrawalQuerySchema = z.object({
  status: withdrawalStatusEnum.optional(),
  memberId: z.string().uuid().optional(),
  payoutProvider: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const withdrawalIdParamSchema = z.object({
  id: z.string().uuid('Withdrawal ID must be a valid UUID'),
});

export const approveWithdrawalSchema = z.object({
  adminNotes: z.string().trim().max(500).optional(),
});

export const processWithdrawalSchema = z.object({
  provider: z.string().trim().max(50).default('RAZORPAYX'),
  externalTransactionId: z.string().trim().max(100).optional(),
});

export const disburseWithdrawalSchema = z.object({
  externalTransactionId: z.string().trim().max(100).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
  adminNotes: z.string().trim().max(500).optional(),
});

export const cancelOrFailWithdrawalSchema = z.object({
  reason: z.string().trim().min(3, 'Reason is required (min 3 characters)'),
});

export const reverseWithdrawalSchema = z.object({
  reason: z.string().trim().min(3, 'Reversal reason is required (min 3 characters)'),
});

export type CreateWithdrawalSchema = z.infer<typeof createWithdrawalSchema>;
export type WithdrawalQuerySchema = z.infer<typeof withdrawalQuerySchema>;
