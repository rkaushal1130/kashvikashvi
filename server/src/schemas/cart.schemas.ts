import { z } from 'zod';

export const cartItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity must be 0 or more').max(100, 'Quantity cannot exceed 100'),
});

export const validateCartSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'At least one item is required to validate cart'),
});
