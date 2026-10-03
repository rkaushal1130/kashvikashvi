import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z.preprocess(
      (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
      z.string().email('Please enter a valid email address')
    ) as z.ZodType<string>,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['DISTRIBUTOR', 'CUSTOMER']).default('DISTRIBUTOR').optional(),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    username: z.string().trim().optional(),
    referralCode: z.string().trim().optional(),
    sponsorCode: z.string().trim().optional(),
    sponsorId: z.string().trim().optional(),
    placementPosition: z.string().trim().optional(),
    confirmPassword: z.string().trim().optional(),
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
  username: z.string().trim().optional(),
  identifier: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  sponsorId: z.string().optional(),
}).refine((data) => Boolean(data.email || data.username || data.identifier), {
  message: 'Please provide your email or username',
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
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
