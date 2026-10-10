import type { NextFunction, Request, Response } from 'express';
import { requireAuth } from './auth.ts';

export const PUBLIC_API_RULES: Array<[string, RegExp]> = [
  ['POST', /^\/api\/auth\/(login|logout)$/],
  ['GET', /^\/api\/auth\/me$/],
  ['POST', /^\/api\/(customers|sellers)$/],
  ['POST', /^\/api\/riders\/(apply|cv\/parse|cv\/format)$/],
  ['GET', /^\/api\/(categories|reviews|sellers|bundles)$/],
  ['GET', /^\/api\/products(?:\/[^/]+)?$/],
  ['GET', /^\/api\/analytics\/(trending-products|top-rated-products|top-rated-sellers|related-products)$/],
  ['POST', /^\/api\/analytics\/events$/],
  ['GET', /^\/api\/maps\/reverse$/],
  ['POST', /^\/api\/ai\/chat$/],
  ['GET', /^\/api\/payment\/(methods|bkash\/direct|simulator)$/],
  ['POST', /^\/api\/payment\/simulator\/complete$/],
  ['GET', /^\/api\/payment\/sslcommerz\/(success|fail|cancel)$/],
  ['POST', /^\/api\/payment\/sslcommerz\/(success|fail|cancel|ipn)$/],
  ['POST', /^\/api\/support\/requests$/],
  ['GET', /^\/api\/riders\/payroll\/settle$/],
  ['POST', /^\/api\/cron\/(expire-orders|refunds)$/],
];

export function isPublicApiRoute(method: string, path: string): boolean {
  const normalizedPath = path.split('?')[0];
  const normalizedMethod = method.toUpperCase();
  return PUBLIC_API_RULES.some(([allowedMethod, pattern]) => allowedMethod === normalizedMethod && pattern.test(normalizedPath));
}

export function enforcePublicApiPolicy(req: Request, res: Response, next: NextFunction): void {
  if (isPublicApiRoute(req.method, req.originalUrl)) {
    return next();
  }

  void requireAuth(req as any, res, next);
}
