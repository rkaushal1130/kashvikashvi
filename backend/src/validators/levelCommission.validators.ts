import { z } from 'zod';

export const calculateOrderCommissionSchema = z.object({
  orderId: z.string().uuid('Valid order UUID is required'),
});

export const previewOrderCommissionSchema = z.object({
  orderBV: z.coerce.number().positive('Order BV must be greater than zero'),
  purchaserDistributorId: z.string().min(1, 'Purchaser distributor ID or code is required'),
});

export const payoutLevelCommissionsSchema = z.object({
  orderId: z.string().uuid().optional(),
  distributorId: z.string().uuid().optional(),
  commissionIds: z.array(z.string().uuid()).optional(),
  periodId: z.string().uuid().optional(),
});

export const reverseLevelCommissionsSchema = z.object({
  orderId: z.string().uuid('Valid order UUID is required'),
  reason: z.string().min(3, 'Reversal reason is required'),
});

export const queryLevelCommissionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  level: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(['CALCULATED', 'APPROVED', 'PAID', 'CANCELLED', 'REVERSED', 'FORFEITED']).optional(),
  distributorId: z.string().optional(),
  orderId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CalculateOrderCommissionInput = z.infer<typeof calculateOrderCommissionSchema>;
export type PreviewOrderCommissionInput = z.infer<typeof previewOrderCommissionSchema>;
export type PayoutLevelCommissionsInput = z.infer<typeof payoutLevelCommissionsSchema>;
export type ReverseLevelCommissionsInput = z.infer<typeof reverseLevelCommissionsSchema>;
export type QueryLevelCommissionsInput = z.infer<typeof queryLevelCommissionsSchema>;
