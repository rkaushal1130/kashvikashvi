import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Determine environment and load appropriate .env file
const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'test') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
}
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FUNDING_PROVIDER: z.string().default('MOCK'),
  FUNDING_PROVIDER_KEY_ID: z.string().optional(),
  FUNDING_PROVIDER_KEY_SECRET: z.string().optional(),
  FUNDING_PROVIDER_WEBHOOK_SECRET: z.string().optional(),
  FUNDING_PROVIDER_ACCOUNT_NUMBER: z.string().optional(),
  RAZORPAYX_KEY_ID: z.string().optional(),
  RAZORPAYX_KEY_SECRET: z.string().optional(),
  RAZORPAYX_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAYX_ACCOUNT_NUMBER: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    
    // In test environment, fallback with sane defaults if missing
    if (nodeEnv === 'test') {
      return envSchema.parse({
        PORT: 5001,
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:5173',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/kashvimlm_test?schema=public',
        JWT_ACCESS_SECRET: 'test_jwt_access_secret_key_32_chars_long_min',
        JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_key_32_chars_long_min',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        ...process.env,
      });
    }

    // In Vercel serverless environment, do not call process.exit(1) as it crashes the lambda container.
    // Provide safe defaults so health check endpoints still respond and log the missing vars.
    if (process.env.VERCEL) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️ Warning: Missing environment variables on Vercel:\n${formattedErrors}\nPlease add them in Vercel Project Settings > Environment Variables.`);
      return envSchema.parse({
        PORT: 5000,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://kashvimlm.vercel.app',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured',
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'temporary_secret_key_needs_replacement_32_chars_min',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'temporary_secret_key_needs_replacement_32_chars_min',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        ...process.env,
      });
    }

    // eslint-disable-next-line no-console
    console.error(`❌ Invalid environment configuration:\n${formattedErrors}`);
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
