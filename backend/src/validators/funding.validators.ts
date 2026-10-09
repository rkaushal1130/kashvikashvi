import { z } from 'zod';

export const connectFundingAccountSchema = z.object({
  provider: z.string().trim().min(2, 'Provider name is required'),
  providerAccountId: z.string().trim().min(2, 'Provider account identifier is required'),
  accountType: z.string().trim().default('CURRENT'),
  accountName: z.string().trim().min(3, 'Account name is required'),
  maskedAccountNumber: z.string().trim().min(4, 'Masked account number is required'),
  currency: z.string().trim().default('INR'),
  isPrimary: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

export const MAX_FUNDING_AMOUNT = 10_000_000; // ₹10,000,000 (1 Crore INR) configured max limit per transaction

export const initiateFundingSchema = z.object({
  fundingAccountId: z.string().uuid('fundingAccountId must be a valid UUID').optional(),
  amount: z.coerce
    .number()
    .positive('Intended funding amount must be greater than zero')
    .min(100, 'Minimum funding amount is 100')
    .max(MAX_FUNDING_AMOUNT, `Funding amount exceeds maximum configured limit of ₹${MAX_FUNDING_AMOUNT.toLocaleString('en-IN')}`),
  currency: z.string().trim().default('INR'),
  description: z.string().trim().min(3, 'Description is required').default('Corporate operational float top-up'),
  idempotencyKey: z.string().trim().optional(),
  metadata: z.record(z.any()).optional(),
});

export const verifyFundingSchema = z.object({
  utrNumber: z.string().trim().optional(),
});

export const reverseFundingSchema = z.object({
  reason: z.string().trim().min(5, 'Reversal reason is required (minimum 5 characters)'),
});

export const reconcileFundingSchema = z.object({
  expectedAmount: z.coerce.number().positive().optional(),
  utrNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const fundingQuerySchema = z.object({
  status: z
    .enum([
      'CREATED',
      'PENDING',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'REVERSED',
      'RECONCILIATION_REQUIRED',
    ])
    .optional(),
  provider: z.string().optional(),
  transactionId: z.string().trim().optional(),
  admin: z.string().trim().optional(),
  amount: z.coerce.number().positive().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const treasuryTransactionQuerySchema = z.object({
  type: z
    .enum([
      'FUNDING',
      'FUNDING_REVERSAL',
      'COMMISSION_RESERVE',
      'PAYOUT',
      'ADJUSTMENT',
      'REFUND',
      'RECONCILIATION',
    ])
    .optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REVERSED']).optional(),
  referenceType: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const disconnectFundingAccountSchema = z.object({
  reason: z.string().trim().min(3, 'Disconnect reason must be at least 3 characters').optional(),
});

export const initiateTreasuryAdjustmentSchema = z.object({
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.coerce.number().positive('Adjustment amount must be greater than zero'),
  reason: z.string().trim().min(5, 'Adjustment reason is required (minimum 5 characters)'),
  referenceNumber: z.string().trim().optional(),
  walletCode: z.string().trim().default('PRIMARY_TREASURY'),
});

export const reconcileFundingPeriodSchema = z.object({
  startDate: z.coerce.date({ required_error: 'startDate is required' }),
  endDate: z.coerce.date({ required_error: 'endDate is required' }),
  provider: z.string().trim().optional(),
});

export const resolveFundingDiscrepancySchema = z.object({
  action: z.enum([
    'FORCE_SETTLE_CREDIT',
    'REVERSE_DEBIT',
    'MARK_FAILED',
    'MARK_RESOLVED_NO_ACTION',
  ]),
  reason: z.string().trim().min(5, 'Resolution reason is required (minimum 5 characters)'),
  notes: z.string().trim().optional(),
  correctionAmount: z.coerce.number().positive().optional(),
});

export const discrepancyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  provider: z.string().trim().optional(),
});

export type ConnectFundingAccountInput = z.infer<typeof connectFundingAccountSchema>;
export type DisconnectFundingAccountInput = z.infer<typeof disconnectFundingAccountSchema>;
export type InitiateTreasuryAdjustmentInput = z.infer<typeof initiateTreasuryAdjustmentSchema>;
export type InitiateFundingInput = z.infer<typeof initiateFundingSchema>;
export type VerifyFundingInput = z.infer<typeof verifyFundingSchema>;
export type ReverseFundingInput = z.infer<typeof reverseFundingSchema>;
export type ReconcileFundingInput = z.infer<typeof reconcileFundingSchema>;
export type FundingQueryInput = z.infer<typeof fundingQuerySchema>;
export type TreasuryTransactionQueryInput = z.infer<typeof treasuryTransactionQuerySchema>;
export type ReconcileFundingPeriodInput = z.infer<typeof reconcileFundingPeriodSchema>;
export type ResolveFundingDiscrepancyInput = z.infer<typeof resolveFundingDiscrepancySchema>;
export type DiscrepancyQueryInput = z.infer<typeof discrepancyQuerySchema>;
