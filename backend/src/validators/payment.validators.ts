import { z } from 'zod';

export const createRazorpayOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID format'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'Order must contain at least one item'),
  shippingAddressId: z.string().uuid().optional(),
  billingAddressId: z.string().uuid().optional(),
  shippingAddress: z
    .object({
      recipientName: z.string().min(2),
      phone: z.string().min(8),
      streetAddress: z.string().min(3),
      apartment: z.string().optional(),
      city: z.string().min(2),
      state: z.string().min(2),
      postalCode: z.string().min(3),
      country: z.string().default('India'),
    })
    .optional(),
  paymentMethod: z.enum(['UPI', 'CREDIT_CARD', 'DEBIT_CARD']).default('UPI'),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
  orderId: z.string().optional(),
});

export const walletCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid('Invalid product ID format'),
        quantity: z.number().int().positive('Quantity must be at least 1'),
      })
    )
    .min(1, 'Order must contain at least one item'),
  shippingAddressId: z.string().uuid().optional(),
  billingAddressId: z.string().uuid().optional(),
  shippingAddress: z
    .object({
      recipientName: z.string().min(2),
      phone: z.string().min(8),
      streetAddress: z.string().min(3),
      apartment: z.string().optional(),
      city: z.string().min(2),
      state: z.string().min(2),
      postalCode: z.string().min(3),
      country: z.string().default('India'),
    })
    .optional(),
});

export type CreateRazorpayOrderInput = z.infer<typeof createRazorpayOrderSchema>;
export type VerifyRazorpayPaymentInput = z.infer<typeof verifyRazorpayPaymentSchema>;
export type WalletCheckoutInput = z.infer<typeof walletCheckoutSchema>;
