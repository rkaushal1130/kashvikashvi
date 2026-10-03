import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { isTest } from '../config/env';
import { logger } from '../config/logger';

export const requestLogger = pinoHttp({
  logger,
  autoLogging: !isTest,
  genReqId: (req) => {
    const existingId = req.headers['x-request-id'] as string;
    return existingId || randomUUID();
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
});
