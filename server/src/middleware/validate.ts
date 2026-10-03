import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Zod Request Validation Middleware
 * Intercepts incoming requests and validates them against the provided schema.
 * Rejects invalid payloads with a standard structured 400 Bad Request error.
 */
export function validateRequest(schemas: ValidationTargets) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request payload or parameters.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
