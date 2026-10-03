import { z } from 'zod';

export const orderStatusEnum = z.enum([
  'PENDING',
  'PAYMENT_PENDING',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const paymentMethodEnum = z.enum([
  'CREDIT_CARD',
  'DEBIT_CARD',
  'WALLET',
  'BANK_TRANSFER',
  'CRYPTO',
  'UPI',
]);

// IMPORTANT: Never trust price or BV sent from client! We strictly only accept productId & quantity.
export const orderItemInputSchema = z.object({
  productId: z.string().uuid('Product ID must be a valid UUID'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export const inlineAddressSchema = z.object({
  recipientName: z.string().min(2, 'Recipient name must be at least 2 characters').trim(),
  phone: z.string().trim().optional(),
  streetAddress: z.string().min(3, 'Street address must be at least 3 characters').trim(),
  apartment: z.string().trim().optional(),
  city: z.string().min(2, 'City is required').trim(),
  state: z.string().min(2, 'State is required').trim(),
  postalCode: z.string().min(3, 'Postal code is required').trim(),
  country: z.string().trim().default('USA'),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1).optional(),
  fromCart: z.boolean().default(false),
  shippingAddressId: z.string().uuid().optional(),
  billingAddressId: z.string().uuid().optional(),
  shippingAddress: inlineAddressSchema.optional(),
  billingAddress: inlineAddressSchema.optional(),
  paymentMethod: paymentMethodEnum.default('CREDIT_CARD'),
  // Optional flag to simulate immediate payment confirmation (e.g. from payment gateway or wallet)
  markPaid: z.boolean().default(false),
});

export const orderQuerySchema = z.object({
  status: orderStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const orderIdParamSchema = z.object({
  id: z.string().min(1, 'Order ID or Order Number is required').trim(),
});

export const adminAdjustOrderBVSchema = z.object({
  commissionableBusinessVolume: z
    .union([z.number(), z.string()])
    .refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0;
    }, {
      message: 'Commissionable Business Volume must be a non-negative number',
    }),
  reason: z.string().min(3, 'Adjustment reason is required').trim(),
});

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type AdminAdjustOrderBVInput = z.infer<typeof adminAdjustOrderBVSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

