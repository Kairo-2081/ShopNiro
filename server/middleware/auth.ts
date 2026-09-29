import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '../../src/types.ts';

const JWT_SECRET: string = process.env.JWT_SECRET || 'shopniro-super-secure-secret-key-2026';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  entityId: string;
  id?: string;
  jti?: string;
}

/**
 * Signs a new JWT token containing user identity and role.
 */
export function generateToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verifies and decodes a JWT token.
 * Throws an error if invalid or expired.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware: Strictly requires a valid JWT Bearer token in the Authorization header.
 */
export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token provided' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('requireAuth verifyToken failure:', error.message);
    return res.status(401).json({ 
      error: 'Unauthorized: Session token is expired or invalid. Please log in again.' 
    });
  }
};

/**
 * Middleware: Optional token extraction. If a valid token is present, attaches req.user without blocking.
 */
export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
      } catch (error) {
        // Token invalid or expired - ignore for optional auth
      }
    }
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
