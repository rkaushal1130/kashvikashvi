import { z } from 'zod';

export const loginSchema = z
  .object({
    username: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, 'Password is required'),
    sponsorId: z.string().optional(),
    rememberMe: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.username || data.email), {
    message: 'Username, Member ID or Email is required to log in',
    path: ['email'],
  });

export const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Valid email address is required'),
    phone: z.string().optional(),
    username: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().optional(),
    sponsorId: z.string().optional(),
    referralCode: z.string().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(), // Can come from body or HTTP-only cookie
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid registered email address is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Valid reset token is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});
