import type { NextFunction, Response } from 'express';
import { AuthRequest, optionalAuth } from './auth.ts';
import { getUserProfileCompletion } from '../services/profileCompletion.service.ts';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const profileGatedReadPaths = new Set(['/api/riders/me', '/api/riders/wallet']);
const systemMutationPaths = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/signup',
  '/api/payment/simulator/complete',
]);

const isSystemMutation = (path: string) =>
  systemMutationPaths.has(path)
  || /^\/api\/payment\/sslcommerz\/(success|fail|cancel|ipn)$/.test(path)
  || /^\/api\/cron\/(expire-orders|refunds)$/.test(path);

function isOwnProfileEdit(req: AuthRequest, path: string): boolean {
  const user = req.user;
  if (!user || req.method.toUpperCase() !== 'PUT') return false;
  if (user.role === 'customer') return path === `/api/customers/${encodeURIComponent(user.entityId)}`;
  if (user.role === 'seller') return path === '/api/sellers/me/profile';
  if (user.role === 'rider') return path === '/api/riders/me';
  return false;
}

export function requireCompleteProfile(req: AuthRequest, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split('?')[0];
  const safeRead = safeMethods.has(method) && !profileGatedReadPaths.has(path);
  if (safeRead || isSystemMutation(path)) return next();

  const enforce = () => {
    if (!req.user || req.user.role === 'admin') return next();
    if (isOwnProfileEdit(req, path)) return next();
    void getUserProfileCompletion(req.user.role, req.user.entityId).then((completion) => {
      if (completion.complete) return next();
      return res.status(403).json({
        code: 'PROFILE_INCOMPLETE',
        error: 'Update your profile first before making changes.',
        missingFields: completion.missingFields,
      });
    }).catch(next);
  };

  if (req.user || !req.headers.cookie?.includes('shopniro_session=')) return enforce();
  void optionalAuth(req, res, enforce);
}