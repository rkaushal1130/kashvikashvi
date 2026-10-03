import { z } from 'zod';

export const placementPositionEnum = z.enum(['LEFT', 'RIGHT']);

export const placeDistributorSchema = z.object({
  distributorId: z.string().min(1, 'distributorId is required'),
  businessCenterId: z.string().optional(),
  sponsorId: z.string().optional(),
  placementParentId: z.string().min(1, 'placementParentId is required'),
  placementPosition: placementPositionEnum,
});

export const getTreeQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(10).default(3),
});

export const nextSlotQuerySchema = z.object({
  preferredLeg: z.enum(['LEFT', 'RIGHT', 'BALANCED']).default('BALANCED'),
});

export type PlaceDistributorInput = z.infer<typeof placeDistributorSchema>;
export type GetTreeQueryInput = z.infer<typeof getTreeQuerySchema>;
export type NextSlotQueryInput = z.infer<typeof nextSlotQuerySchema>;
