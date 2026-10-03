import { z } from 'zod';

export const productStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'INACTIVE']);
export const productSortEnum = z.enum(['featured', 'newest', 'price_low', 'price_high', 'BV']);

export const imageInputSchema = z.union([
  z.string().url('Image must be a valid URL'),
  z.object({
    url: z.string().url('Image must be a valid URL'),
    altText: z.string().trim().optional(),
    isPrimary: z.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).default(0),
  }),
]);

export const createProductSchema = z.object({
  sku: z.string().min(2, 'SKU must be at least 2 characters').max(50).trim().toUpperCase(),
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200).trim(),
  slug: z
    .string()
    .min(2)
    .max(250)
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  description: z.string().trim().optional(),
  categoryId: z.string().min(1, 'Category ID or Code is required').trim(),
  wholesalePrice: z.coerce.number().min(0, 'Wholesale price cannot be negative'),
  mrp: z.coerce.number().min(0, 'MRP cannot be negative'),
  bv: z.coerce.number().min(0, 'BV cannot be negative').default(0),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  status: productStatusEnum.default('DRAFT'),
  isFeatured: z.boolean().default(false),
  images: z.array(imageInputSchema).optional().default([]),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({
    sku: z.string().min(2).max(50).trim().toUpperCase().optional(),
    name: z.string().min(2).max(200).trim().optional(),
  });

export const productQuerySchema = z.object({
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minBV: z.coerce.number().min(0).optional(),
  maxBV: z.coerce.number().min(0).optional(),
  stock: z.enum(['all', 'in_stock', 'out_of_stock', 'low_stock']).optional(),
  status: productStatusEnum.optional(),
  sort: productSortEnum.default('featured'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid('Product ID must be a valid UUID'),
});

export const productSlugParamSchema = z.object({
  slug: z.string().min(1, 'Product slug is required').trim(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
