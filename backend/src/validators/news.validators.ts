import { z } from 'zod';
import { NewsStatus } from '@prisma/client';

export const newsStatusSchema = z.nativeEnum(NewsStatus);

export const createNewsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(150, 'Slug cannot exceed 150 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  summary: z
    .string()
    .trim()
    .min(5, 'Summary must be at least 5 characters')
    .max(1000, 'Summary cannot exceed 1000 characters'),
  content: z
    .string()
    .trim()
    .min(10, 'Content must be at least 10 characters'),
  image: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable(),
  status: newsStatusSchema.default('DRAFT'),
  publishedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.date())
    .optional()
    .nullable(),
  authorId: z
    .string()
    .uuid('Author ID must be a valid UUID')
    .optional()
    .nullable(),
  targetAudience: z
    .string()
    .trim()
    .default('ALL'),
});

export const updateNewsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200)
    .optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(150)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  summary: z
    .string()
    .trim()
    .min(5)
    .max(1000)
    .optional(),
  content: z
    .string()
    .trim()
    .min(10)
    .optional(),
  image: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable(),
  status: newsStatusSchema.optional(),
  publishedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.date())
    .optional()
    .nullable(),
  authorId: z
    .string()
    .uuid()
    .optional()
    .nullable(),
  targetAudience: z
    .string()
    .trim()
    .optional(),
});

export const newsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: newsStatusSchema.optional(),
  targetAudience: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['newest', 'oldest', 'title_asc', 'title_desc']).default('newest'),
});

export const newsSlugParamSchema = z.object({
  slug: z.string().trim().min(1, 'News slug is required'),
});

export const newsIdParamSchema = z.object({
  id: z.string().trim().min(1, 'News ID is required'),
});

export type CreateNewsInput = z.infer<typeof createNewsSchema>;
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;
export type NewsQueryInput = z.infer<typeof newsQuerySchema>;
export type NewsSlugParamInput = z.infer<typeof newsSlugParamSchema>;
export type NewsIdParamInput = z.infer<typeof newsIdParamSchema>;
