import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { query } from '../db/index.ts';
import { UserRole } from '../../src/types.ts';

const developmentFallbackSecret = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  ? 'shopniro-dev-test-jwt-secret-at-least-32-chars'
  : undefined;
const JWT_SECRET = process.env.JWT_SECRET || developmentFallbackSecret;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

export const AUTH_COOKIE_NAME = 'shopniro_session';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  entityId: string;
  id?: string;
  jti: string;
}

/**
 * Signs a new JWT token containing user identity and role.
 */
export function generateToken(payload: Omit<TokenPayload, 'jti'>): string {
  const options: SignOptions = {
    expiresIn: '1h',
  };
  return jwt.sign({ ...payload, jti: randomUUID() }, JWT_SECRET, options);
}

/**
 * Verifies and decodes a JWT token.
 * Throws an error if invalid or expired.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function issueAuthCookie(res: Response, payload: Omit<TokenPayload, 'jti'>): Promise<void> {
  const token = generateToken(payload);
  const decoded = verifyToken(token);
  const expiresAt = new Date((jwt.decode(token) as jwt.JwtPayload).exp! * 1000);
  await query('SELECT gocart_session_create($1, $2, $3)', [decoded.jti, decoded.userId, expiresAt]);

  const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(configuredSameSite || '')
    ? configuredSameSite
    : process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  const secure = process.env.NODE_ENV === 'production' || sameSite === 'none';
  const secureAttribute = secure ? '; Secure' : '';
  res.append('Set-Cookie', `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=3600; Path=/; HttpOnly; SameSite=${sameSite}${secureAttribute}`);
}

export function clearAuthCookie(res: Response): void {
  const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(configuredSameSite || '')
    ? configuredSameSite
    : process.env.NODE_ENV === 'production' ? 'none' : 'lax';
  const secure = process.env.NODE_ENV === 'production' || sameSite === 'none';
  const secureAttribute = secure ? '; Secure' : '';
  res.append('Set-Cookie', `${AUTH_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${sameSite}${secureAttribute}`);
}

function getRequestToken(req: Request): string | null {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(AUTH_COOKIE_NAME.length + 1)) || null;
  } catch {
    return null;
  }
}

async function getActiveSession(token: string): Promise<TokenPayload | null> {
  const decoded = verifyToken(token);
  const session = await query('SELECT gocart_session_active($1) AS active', [decoded.jti]);
  return session.rows[0]?.active ? decoded : null;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware: Requires a valid, active JWT session in the HttpOnly cookie.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication session' });
  }

  try {
    const decoded = await getActiveSession(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized: Session is expired or revoked. Please sign in again.' });
    }
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Unauthorized: Session token is expired or invalid. Please sign in again.' });
    }
    next(error);
  }
};

/**
 * Middleware: Optional token extraction. If a valid token is present, attaches req.user without blocking.
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = getRequestToken(req);
  if (!token) return next();
  try {
    req.user = await getActiveSession(token) || undefined;
  } catch {
    // Optional authentication ignores absent, invalid, or unavailable sessions.
  }
  next();
};

/**
 * Middleware: Role-Based Authorization Guard.
 * Ensures the authenticated user has one of the required roles.
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Your current role is "${req.user.role}".` 
      });
    }

    next();
  };
};
