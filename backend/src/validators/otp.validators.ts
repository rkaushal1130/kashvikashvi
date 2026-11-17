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
