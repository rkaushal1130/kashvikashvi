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
