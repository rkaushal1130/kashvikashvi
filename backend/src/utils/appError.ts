export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly errors?: any;

  constructor(
    message: string,
    statusCode = 500,
    code?: string,
    errors?: any,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', code = 'BAD_REQUEST', errors?: any): AppError {
    return new AppError(message, 400, code, errors);
  }

  static unauthorized(message = 'Unauthorized', code = 'AUTH_UNAUTHORIZED'): AppError {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code = 'AUTH_FORBIDDEN'): AppError {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, code);
  }

  static conflict(message = 'Resource already exists', code = 'CONFLICT'): AppError {
    return new AppError(message, 409, code);
  }

  static unprocessableEntity(message = 'Validation failed', errors?: any): AppError {
    return new AppError(message, 422, 'VALIDATION_ERROR', errors);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED'): AppError {
    return new AppError(message, 429, code);
  }

  static invalidCredentials(message = 'Invalid credentials'): AppError {
    return new AppError(message, 401, 'AUTH_INVALID_CREDENTIALS');
  }

  static accountInactive(
    message = 'Account is not active',
    code = 'AUTH_ACCOUNT_NOT_ACTIVE'
  ): AppError {
    return new AppError(message, 403, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, 500, code, undefined, false);
  }
}
