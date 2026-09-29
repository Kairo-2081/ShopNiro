import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '../types.ts';

const JWT_SECRET: string = process.env.JWT_SECRET || 'shopniro-super-secure-secret-key-2026';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  entityId: string;
}

/**
 * Signs a new JWT token containing user identity and role.
 */
export function generateToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: '7d',
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
