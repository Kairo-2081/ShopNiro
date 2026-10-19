import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Global Error Handling Middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : typeof err.status === 'number' && err.status >= 400 && err.status < 600
      ? err.status
      : 500;

  req.log.error({ err }, 'request failed');
  if (statusCode >= 500) Sentry.captureException(err);

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Something went wrong' : err.message,
    requestId: req.id,
  });
}

/**
 * 404 Route Not Found Middleware
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl} - Endpoint not found`,
  });
}

export const publicMessage = (err: any, fallback: string) =>
  typeof err?.statusCode === 'number' && err.statusCode < 500 ? err.message : fallback;
