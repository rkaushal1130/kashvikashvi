import { z } from 'zod';

export const payoutStatusEnum = z.enum([
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'REJECTED',
  'FAILED',
  'COMPLETED',
  'CANCELLED',
]);

export const createPayoutRequestSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Payout amount must be greater than zero')
    .min(1, 'Minimum payout request amount is 1.00'),
  bankAccountId: z.string().uuid('bankAccountId must be a valid UUID'),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export const payoutQuerySchema = z.object({
  status: payoutStatusEnum.optional(),
  distributorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const payoutIdParamSchema = z.object({
  id: z.string().uuid('Payout ID must be a valid UUID'),
});

export const approvePayoutSchema = z.object({
  adminNotes: z.string().trim().max(500).optional(),
});

export const rejectPayoutSchema = z.object({
  reason: z.string().trim().min(3, 'Rejection reason is required (min 3 characters)'),
  adminNotes: z.string().trim().max(500).optional(),
});

export const markPaidPayoutSchema = z.object({
  referenceNumber: z.string().trim().max(100).optional(),
  adminNotes: z.string().trim().max(500).optional(),
});

export type PayoutStatusEnum = z.infer<typeof payoutStatusEnum>;
export type CreatePayoutRequestInput = z.infer<typeof createPayoutRequestSchema>;
export type PayoutQueryInput = z.infer<typeof payoutQuerySchema>;
export type RejectPayoutInput = z.infer<typeof rejectPayoutSchema>;
export type MarkPaidPayoutInput = z.infer<typeof markPaidPayoutSchema>;
