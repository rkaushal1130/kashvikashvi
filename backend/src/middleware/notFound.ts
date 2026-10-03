import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/appError';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};
