import { z } from 'zod';

export const walletTransactionTypeEnum = z.enum([
  'CREDIT',
  'DEBIT',
  'COMMISSION',
  'PAYOUT',
  'REFUND',
  'ADJUSTMENT',
  'REVERSAL',
  'COMMISSION_CREDIT',
  'BONUS_CREDIT',
  'ORDER_PAYMENT',
  'PAYOUT_WITHDRAWAL',
  'PEER_TRANSFER_DEBIT',
  'PEER_TRANSFER_CREDIT',
  'ADMIN_ADJUSTMENT',
]);

export const walletTransactionQuerySchema = z.object({
  type: walletTransactionTypeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const adminWalletAdjustmentSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  type: z.enum(['CREDIT', 'DEBIT', 'ADJUSTMENT']),
  amount: z.coerce.number().positive('Adjustment amount must be greater than zero'),
  reason: z.string().trim().min(3, 'Reason is required (min 3 characters)'),
  referenceId: z.string().trim().optional(),
});

export type WalletTransactionTypeEnum = z.infer<typeof walletTransactionTypeEnum>;
export type WalletTransactionQueryInput = z.infer<typeof walletTransactionQuerySchema>;
export type AdminWalletAdjustmentInput = z.infer<typeof adminWalletAdjustmentSchema>;
