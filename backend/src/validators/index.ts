import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID identifier format'),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'Identifier is required'),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
export type UuidParamInput = z.infer<typeof uuidParamSchema>;

export * from './auth.validators';
export * from './distributor.validators';
export * from './mlmTree.validators';
export * from './sponsor.validators';
export * from './commissionApi.validators';

