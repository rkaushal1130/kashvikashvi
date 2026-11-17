import { z } from 'zod';

export const verifyOtpTokenSchema = z.object({
  accessToken: z
    .string({ required_error: 'MSG91 access token is required' })
    .min(1, 'MSG91 access token cannot be empty'),
  phone: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z
      .string({ required_error: 'Mobile number is required' })
      .min(10, 'Valid 10-digit mobile number is required')
  ),
});

export type VerifyOtpTokenInput = z.infer<typeof verifyOtpTokenSchema>;

export const sendOtpSchema = z.object({
  phone: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z
      .string({ required_error: 'Mobile number is required' })
      .min(10, 'Valid 10-digit mobile number is required')
  ),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const retryOtpSchema = z.object({
  reqId: z
    .string({ required_error: 'Request ID is required' })
    .min(1, 'Request ID cannot be empty'),
  channel: z.union([z.string(), z.number()]).optional(),
});

export type RetryOtpInput = z.infer<typeof retryOtpSchema>;

export const verifyOtpRestSchema = z.object({
  reqId: z.string().optional(),
  otp: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z
      .string({ required_error: 'OTP is required' })
      .length(4, 'OTP must be exactly 4 digits')
  ),
  phone: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z
      .string({ required_error: 'Mobile number is required' })
      .min(10, 'Valid 10-digit mobile number is required')
  ),
});

export type VerifyOtpRestInput = z.infer<typeof verifyOtpRestSchema>;
