import { z } from 'zod';

export const createBatchSchema = z.object({
  periodId: z.string().optional(),
  payoutMode: z.enum(['PNB_BANK_TRANSFER', 'WALLET_CREDIT']).optional().default('PNB_BANK_TRANSFER'),
  excludeUnverifiedBanks: z.boolean().optional().default(true),
  notes: z.string().max(500).optional(),
});

export const approveBatchSchema = z.object({
  checkerNotes: z.string().max(500).optional(),
  confirmationToken: z.string().optional(),
});

export const rejectBatchSchema = z.object({
  reason: z.string().min(3, 'Rejection reason is required').max(500),
});

export const remediateItemSchema = z.object({
  action: z.enum(['UPDATE_BANK_AND_RETRY', 'EXCLUDE_FROM_BATCH', 'DIVERT_TO_WALLET']),
  bankName: z.string().optional(),
  accountHolderName: z.string().optional(),
  accountNumber: z.string().min(5).max(30).optional(),
  ifscCode: z.string().min(4).max(15).optional(),
  notes: z.string().max(300).optional(),
});

export const batchListQuerySchema = z.object({
  status: z.string().optional(),
  approvalStatus: z.string().optional(),
  periodId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

export const batchIdParamSchema = z.object({
  batchId: z.string().min(1),
});

export const itemIdParamSchema = z.object({
  batchId: z.string().min(1),
  itemId: z.string().min(1),
});
