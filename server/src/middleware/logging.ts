import pinoHttp from 'pino-http';
import { logger } from '../config/logger.js';
import { Request, Response } from 'express';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: Request) => req.id || 'anonymous',
  customLogLevel: (_req: Request, res: Response, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req: Request) => ({
    requestId: req.id,
    ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'Unknown',
  }),
  customSuccessMessage: (req: Request, res: Response) => {
    return `[${req.id}] ${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage: (req: Request, res: Response, err: Error) => {
    return `[${req.id}] ${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
});
