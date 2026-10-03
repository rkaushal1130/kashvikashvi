import { z } from 'zod';

export const updateDistributorWebsiteSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  subdomain: z
    .string()
    .trim()
    .min(2, 'Subdomain must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  theme: z.string().trim().max(50).optional(),
  logo: z.string().trim().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export const createWebsiteLinkSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(100),
  url: z.string().trim().min(1, 'URL is required').max(500),
  type: z.string().trim().default('CUSTOM'),
  sortOrder: z.coerce.number().int().default(0),
  enabled: z.boolean().default(true),
});

export const updateWebsiteLinkSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  url: z.string().trim().min(1).max(500).optional(),
  type: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().optional(),
  enabled: z.boolean().optional(),
});

export const linkIdParamSchema = z.object({
  id: z.string().uuid('Link ID must be a valid UUID'),
});

export const distributorSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'Slug or distributor code is required')
    .max(100),
});

export type UpdateDistributorWebsiteInput = z.infer<typeof updateDistributorWebsiteSchema>;
export type CreateWebsiteLinkInput = z.infer<typeof createWebsiteLinkSchema>;
export type UpdateWebsiteLinkInput = z.infer<typeof updateWebsiteLinkSchema>;
export type DistributorSlugParamInput = z.infer<typeof distributorSlugParamSchema>;

