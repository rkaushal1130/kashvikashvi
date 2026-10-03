import { z } from 'zod';

/**
 * ============================================================================
 * MEMBER LEVEL & VOLUME API VALIDATORS
 * ============================================================================
 * Validates route parameters, query strings, and request bodies.
 * RULE: Never trust BB or matching values sent directly from the frontend.
 * Volume values are strictly calculated from trusted backend ledgers.
 */

export const memberIdParamSchema = z.object({
  memberId: z.string().trim().min(1, 'Member identifier is required'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  source: z.string().trim().optional(),
  type: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const adminRecalculateBodySchema = z
  .object({
    reason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    forceUpdate: z.boolean().optional(),
  })
  .strict(); // Rejects any extra keys (such as arbitrary bb or matching amounts) sent from client
