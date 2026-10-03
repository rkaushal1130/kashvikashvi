import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const isProd = config.nodeEnv === 'production';

  // Secure structured logging with request correlation
  logger.error(
    {
      requestId: req.id,
      statusCode,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      err: {
        message: err.message,
        name: err.name,
        code: err.code,
        stack: err.stack,
      },
    },
    `[${req.id}] Handled API error: ${err.message}`
  );

  // Secure error messaging: Never leak database schemas or system internals to callers
  let safeMessage = err.message || 'An unexpected server error occurred.';
  if (statusCode >= 500 && isProd) {
    safeMessage = `An unexpected server error occurred. Please contact customer support with Request ID: ${req.id}`;
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    requestId: req.id,
    stack: !isProd ? err.stack : undefined,
  });
}
