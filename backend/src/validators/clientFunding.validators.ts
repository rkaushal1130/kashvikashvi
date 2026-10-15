import { z } from 'zod';

// Validates funding amount: positive number, min ₹10, max ₹500,000 per transaction
export const createClientFundingOrderSchema = z.object({
  amount: z
    .number({ required_error: 'Funding amount is required' })
    .positive('Funding amount must be greater than zero')
    .min(10, 'Minimum funding amount is ₹10.00')
    .max(500000, 'Maximum per-transaction funding limit is ₹500,000.00'),
  currency: z.string().trim().default('INR'),
  paymentMethod: z.enum(
    ['RAZORPAY_UPI', 'RAZORPAY_CARD', 'RAZORPAY_NETBANKING', 'BANK_WIRE'],
    { required_error: 'Payment method is required' }
  ),
  idempotencyKey: z.string().trim().optional(),
  metadata: z.record(z.any()).optional(),
});

export const verifyClientFundingPaymentSchema = z.object({
  orderId: z.string().trim().optional(),
  razorpayOrderId: z.string().trim().min(1, 'Razorpay Order ID is required'),
  razorpayPaymentId: z.string().trim().min(1, 'Razorpay Payment ID is required'),
  razorpaySignature: z.string().trim().min(1, 'Razorpay Signature is required'),
});

// IFSC Validation: 4 letters, 0, 6 alphanumeric characters
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const addBankAccountSchema = z.object({
  accountHolderName: z
    .string({ required_error: 'Account holder name is required' })
    .trim()
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name exceeds maximum length'),
  bankName: z
    .string({ required_error: 'Bank name is required' })
    .trim()
    .min(2, 'Bank name is required')
    .max(100, 'Bank name exceeds maximum length'),
  accountNumber: z
    .string({ required_error: 'Account number is required' })
    .trim()
    .min(8, 'Account number must be at least 8 digits')
    .max(20, 'Account number cannot exceed 20 digits')
    .regex(/^\d+$/, 'Account number must contain only numeric digits'),
  ifscCode: z
    .string({ required_error: 'IFSC code is required' })
    .trim()
    .toUpperCase()
    .regex(ifscRegex, 'Invalid IFSC code format (e.g., HDFC0001234)'),
  branchName: z.string().trim().max(100).optional(),
  isPrimary: z.boolean().optional().default(false),
});

export const listClientFundingOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['ALL', 'CREATED', 'PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REVERSED']).optional().default('ALL'),
});
