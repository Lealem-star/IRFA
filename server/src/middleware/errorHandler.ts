import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handle JSON parsing errors from body-parser (e.g. malformed quotes/escaping)
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    console.warn('[CLIENT_BAD_REQUEST] Invalid JSON payload received:', err.message);
    res.status(400).json({
      success: false,
      message: 'Invalid JSON payload. Please ensure the request body is valid, properly formatted JSON.',
      error: err.message,
    });
    return;
  }

  // 2. Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // 3. Handle Custom or Middleware HTTP Errors (4xx vs 5xx)
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : typeof err.status === 'number' ? err.status : 500;

  if (statusCode >= 500) {
    console.error('[SERVER_ERROR]', err);
  } else {
    console.warn(`[HTTP_${statusCode}]`, err.message || err);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && process.env.NODE_ENV !== 'development'
      ? 'An internal server error occurred'
      : err.message || 'An error occurred processing the request',
  });
};
