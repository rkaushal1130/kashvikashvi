import rateLimit from 'express-rate-limit';
import { isTest } from './env';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: () => isTest,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 10, // Max 10 attempts per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  skip: () => isTest,
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 10000 : 10, // Max 10 registrations per hour per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many accounts created from this IP. Please try again after an hour.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  skip: () => isTest,
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 5, // Max 5 password reset attempts per 15 minutes
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again after 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  skip: () => isTest,
});

export const treeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 120, // Max 120 tree queries per 15 minutes per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many network tree requests from this IP. Please try again after 15 minutes.',
    code: 'TREE_RATE_LIMIT_EXCEEDED',
  },
  skip: () => isTest,
});

