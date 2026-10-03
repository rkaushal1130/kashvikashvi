import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  category: z.string().min(2, 'Category is required'),
  distributorPrice: z.coerce.number().min(0, 'Distributor price must be 0 or greater'),
  mrp: z.coerce.number().min(0, 'MRP must be 0 or greater'),
  volumeBv: z.coerce.number().min(0, 'Volume BV must be 0 or greater'),
  stockQuantity: z.coerce.number().int().min(0, 'Stock must be 0 or greater').optional(),
  status: z.string().optional(),
  imageUrl: z.string().optional(),
  sizeSpec: z.string().optional(),
  shortDesc: z.string().optional(),
  benefits: z.union([z.array(z.string()), z.string()]).optional(),
  usageInstructions: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one product ID must be provided'),
});
