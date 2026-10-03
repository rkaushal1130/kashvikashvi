import { z } from 'zod';

export const treeDepthQuerySchema = z.object({
  depth: z
    .coerce
    .number()
    .int()
    .min(1, 'Depth must be at least 1')
    .max(5, 'Depth cannot exceed 5 for performance and security')
    .default(3)
    .optional(),
});

export const distributorIdParamSchema = z.object({
  distributorId: z
    .string()
    .trim()
    .min(3, 'Distributor ID must be at least 3 characters')
    .max(50, 'Distributor ID cannot exceed 50 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Distributor ID must contain only alphanumeric characters, underscores, or hyphens'),
});

export const treeSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional(),
});

export const treePlacementInputSchema = z
  .object({
    distributorId: z
      .string()
      .trim()
      .min(3, 'Distributor ID must be at least 3 characters')
      .max(50, 'Distributor ID cannot exceed 50 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Distributor ID contains invalid characters'),
    sponsorId: z
      .string()
      .trim()
      .min(3, 'Sponsor ID must be at least 3 characters')
      .max(50, 'Sponsor ID cannot exceed 50 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Sponsor ID contains invalid characters'),
    placementParentId: z
      .string()
      .trim()
      .min(3, 'Placement parent ID must be at least 3 characters')
      .max(50, 'Placement parent ID cannot exceed 50 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Placement parent ID contains invalid characters'),
    placementPosition: z.enum(['LEFT', 'RIGHT'], {
      errorMap: () => ({ message: 'Placement position must be either LEFT or RIGHT' }),
    }),
  })
  .refine((data) => data.distributorId.toUpperCase() !== data.sponsorId.toUpperCase(), {
    message: 'Self-sponsorship is forbidden: A distributor cannot sponsor themselves',
    path: ['sponsorId'],
  })
  .refine((data) => data.distributorId.toUpperCase() !== data.placementParentId.toUpperCase(), {
    message: 'Self-placement is forbidden: A distributor cannot place a node under themselves',
    path: ['placementParentId'],
  });

export type TreeDepthQuery = z.infer<typeof treeDepthQuerySchema>;
export type DistributorIdParam = z.infer<typeof distributorIdParamSchema>;
export type TreeSearchQuery = z.infer<typeof treeSearchQuerySchema>;
export type TreePlacementInput = z.infer<typeof treePlacementInputSchema>;

