import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../utils/appError';

interface RequestValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate = (schemas: RequestValidationSchemas) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as any;
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        next(AppError.unprocessableEntity('Request validation failed', issues));
      } else {
        next(error);
      }
    }
  };
};
