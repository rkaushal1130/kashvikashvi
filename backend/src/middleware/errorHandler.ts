import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { isProd } from '../config/env';
import { logger } from '../config/logger';
import { sendError } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined = undefined;
  let errors: any = undefined;

  // Custom Application Errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    errors = err.errors;
  }
  // Zod Validation Errors
  else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }
  // JWT Errors
  else if (err instanceof TokenExpiredError) {
    statusCode = 401;
    message = 'Authentication token expired';
    code = 'AUTH_TOKEN_EXPIRED';
  } else if (err instanceof JsonWebTokenError) {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = 'AUTH_INVALID_TOKEN';
  }
  // Prisma Known Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        message = `A record with this ${target} already exists`;
        code = 'DUPLICATE_RESOURCE';
        break;
      }
      case 'P2025': {
        statusCode = 404;
        message = 'Record to operate on does not exist';
        code = 'RESOURCE_NOT_FOUND';
        break;
      }
      default:
        statusCode = 400;
        message = 'Database operation failed';
        code = 'DATABASE_ERROR';
        break;
    }
  }
  // Standard unexpected errors
  else {
    statusCode = 500;
    message = isProd ? 'Internal server error' : err.message;
    code = 'INTERNAL_SERVER_ERROR';
  }

  // Log error with appropriate severity
  if (statusCode >= 500) {
    logger.error(
      {
        err,
        method: req.method,
        url: req.originalUrl,
        body: req.body,
        params: req.params,
        query: req.query,
      },
      `Unhandled server error: ${err.message}`
    );
  } else {
    logger.warn(
      {
        statusCode,
        code,
        message,
        method: req.method,
        url: req.originalUrl,
      },
      `Client error [${code}]: ${message}`
    );
  }

  sendError(res, {
    statusCode,
    message,
    code,
    errors,
  });
};
