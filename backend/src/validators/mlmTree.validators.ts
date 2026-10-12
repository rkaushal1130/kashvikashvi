import { z } from 'zod';

export const placementPositionEnum = z.enum(['LEFT', 'RIGHT'], {
  errorMap: () => ({ message: 'Position must be strictly LEFT or RIGHT' }),
});

export const placeDistributorSchema = z
  .object({
    distributorId: z.string().min(1, 'distributorId is required'),
    businessCenterId: z.string().optional(),
    sponsorId: z.string().optional(),
    placementParentId: z.string().optional(),
    parentId: z.string().optional(),
    placementPosition: placementPositionEnum.optional(),
    position: placementPositionEnum.optional(),
  })
  .refine((data) => Boolean(data.placementParentId || data.parentId), {
    message: 'Placement parent ID is required',
    path: ['parentId'],
  })
  .refine((data) => Boolean(data.placementPosition || data.position), {
    message: 'Position must be strictly LEFT or RIGHT',
    path: ['position'],
  })
  .refine(
    (data) => {
      const pId = data.parentId || data.placementParentId;
      return pId !== data.distributorId;
    },
    {
      message: 'Distributors cannot place themselves as their own parent',
      path: ['parentId'],
    }
  );

export const getTreeQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(10).default(3),
});

export const nextSlotQuerySchema = z.object({
  preferredLeg: z.enum(['LEFT', 'RIGHT', 'BALANCED']).default('BALANCED'),
});

export type PlaceDistributorInput = z.infer<typeof placeDistributorSchema>;
export type GetTreeQueryInput = z.infer<typeof getTreeQuerySchema>;
export type NextSlotQueryInput = z.infer<typeof nextSlotQuerySchema>;
