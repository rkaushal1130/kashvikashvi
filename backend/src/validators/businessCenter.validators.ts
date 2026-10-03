import { z } from 'zod';

export const businessCenterStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const businessCenterQuerySchema = z.object({
  distributorId: z.string().uuid().optional(),
  status: businessCenterStatusEnum.optional(),
});

export const businessCenterIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Business center ID or code is required'),
});

export const businessCenterTreeQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(10).default(3),
});

export const createBusinessCenterSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  centerNumber: z.coerce.number().int().min(1).max(10),
  status: businessCenterStatusEnum.default('ACTIVE'),
});

export type BusinessCenterStatusEnum = z.infer<typeof businessCenterStatusEnum>;
export type BusinessCenterQueryInput = z.infer<typeof businessCenterQuerySchema>;
export type BusinessCenterTreeQueryInput = z.infer<typeof businessCenterTreeQuerySchema>;
export type CreateBusinessCenterInput = z.infer<typeof createBusinessCenterSchema>;
