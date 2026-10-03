import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'] as string;
  const reqId = existingId && /^[a-zA-Z0-9_-]{1,64}$/.test(existingId) ? existingId : crypto.randomUUID();

  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
}
