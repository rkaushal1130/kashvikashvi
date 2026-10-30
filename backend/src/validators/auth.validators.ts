import { z } from 'zod';

export const registerSchema = z
  .object({
    phone: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim() : val),
      z.string({ required_error: 'Mobile number is required' })
        .min(10, 'Valid mobile number with at least 10 digits is required')
    ),
    email: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim().toLowerCase();
          return trimmed === '' ? undefined : trimmed;
        }
        return val;
      },
      z.string().email('Please enter a valid email address').optional()
    ),
    password: z.string().min(8, 'Password must be at least 8 characters/digits'),
    role: z.enum(['DISTRIBUTOR', 'CUSTOMER_CARE', 'ADMIN']).default('DISTRIBUTOR').optional(),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    name: z.string().trim().optional(),
    username: z.string().trim().optional(),
    referralCode: z.string().trim().optional(),
    sponsorCode: z.string().trim().optional(),
    sponsorId: z.string().trim().optional(),
    placementPosition: z.string().trim().optional(),
    confirmPassword: z.string().trim().optional(),
    acceptTerms: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword && data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }
  );

export const loginSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.string().optional()
  ),
  phone: z.string().trim().optional(),
  username: z.string().trim().optional(),
  identifier: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  sponsorId: z.string().optional(),
}).refine((data) => Boolean(data.email || data.phone || data.username || data.identifier), {
  message: 'Please provide your mobile number or email',
  path: ['identifier'],
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required').trim(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
