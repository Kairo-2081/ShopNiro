import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from './auth.ts';

const PUBLIC_API_PATTERNS = [
  /^\/api\/auth(?:\/.*)?$/,
  /^\/api\/categories(?:\/.*)?$/,
  /^\/api\/products(?:\/.*)?$/,
  /^\/api\/analytics(?:\/.*)?$/,
  /^\/api\/maps(?:\/.*)?$/,
  /^\/api\/payment\/methods$/,
  /^\/api\/payment\/bkash\/direct$/,
  /^\/api\/payment\/simulator(?:\/.*)?$/,
  /^\/api\/payment\/sslcommerz\/(?:success|fail|cancel|ipn)$/,
  /^\/api\/payment\/sslcommerz\/.+$/,
  /^\/api\/health(?:\/.*)?$/,
];

export function isPublicApiRoute(pathname: string): boolean {
  const normalized = pathname.split('?')[0];
  return PUBLIC_API_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function enforcePublicApiPolicy(req: Request, res: Response, next: NextFunction): void {
  if (isPublicApiRoute(req.path)) {
    return next();
  }

  void requireAuth(req as any, res, next);
}
