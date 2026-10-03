import { Response } from 'express';
import { ApiResponse } from '../types';

interface SendSuccessOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, any>;
}

interface SendErrorOptions {
  statusCode?: number;
  message: string;
  code?: string;
  errors?: any;
}

export function sendSuccess<T>(res: Response, options: SendSuccessOptions<T> = {}): Response {
  const { statusCode = 200, message, data, meta } = options;

  const responseBody: ApiResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message !== undefined && { message }),
    ...(meta !== undefined && { meta }),
  };

  return res.status(statusCode).json(responseBody);
}

export function sendError(res: Response, options: SendErrorOptions): Response {
  const { statusCode = 500, message, code, errors } = options;

  const responseBody: ApiResponse = {
    success: false,
    message,
    ...(code !== undefined && { code }),
    ...(errors !== undefined && { errors }),
  };

  return res.status(statusCode).json(responseBody);
}
