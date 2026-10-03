import pino from 'pino';
import { config } from './env.js';

export const sensitiveFieldsToRedact = [
  'password',
  'confirmPassword',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'password_hash',
  'token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'req.headers.authorization',
  'cookie',
  'req.headers.cookie',
  'bankAccountNumber',
  'bank_account_number',
  'accountNumber',
  'account_number',
  'panNumber',
  'pan_number',
  'ifscCode',
  'bank_ifsc_code',
  'bankName',
  'bank_name',
  'panCard',
  'aadhaar',
  'aadhaarNumber',
  'aadhaar_number',
];

export const logger = pino({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  redact: {
    paths: sensitiveFieldsToRedact,
    censor: '[REDACTED_SECURITY_DATA]',
  },
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
