import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
});

export const cartItemIdParamSchema = z.object({
  id: z.string().min(1, 'Cart item ID is required'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
