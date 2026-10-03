import { z } from 'zod';

export const createCategorySchema = z.object({
  categoryCode: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'categoryCode must be uppercase alphanumeric with underscores')
    .optional(),
  name: z.string().min(2, 'Category name must be at least 2 characters').max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(120)
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  description: z.string().trim().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).default(0),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryIdParamSchema = z.object({
  id: z.string().min(1).trim(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
