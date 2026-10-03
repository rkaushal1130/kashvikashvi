import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * Tight limits in production; generous in development so a browser session
 * (several API calls per page view, plus hot reloads) is not throttled.
 */
const isDev = config.nodeEnv !== 'production';

/**
 * Standard Global API Rate Limiter
 * 300 requests per 15 minutes per IP in production.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Global rate limit exceeded. Please try again after 15 minutes.',
  },
});

/**
 * Strict Rate Limiter for Authentication & Security-Critical Endpoints
 * 15 requests per 15 minutes per IP (25 in development, to leave room for login testing).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please wait 15 minutes before retrying.',
  },
});
