import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      cookies: Record<string, string>;
    }
  }
}

/**
 * Enterprise Cookie Parser Middleware
 * Parses HTTP request Cookie header into req.cookies dictionary
 * Zero external dependencies.
 */
export function cookieParser(req: Request, _res: Response, next: NextFunction): void {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};

  if (cookieHeader) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx !== -1) {
        const key = pair.substring(0, idx).trim();
        const rawVal = pair.substring(idx + 1).trim();
        try {
          req.cookies[key] = decodeURIComponent(rawVal);
        } catch {
          req.cookies[key] = rawVal;
        }
      }
    }
  }

  next();
}

export default cookieParser;
