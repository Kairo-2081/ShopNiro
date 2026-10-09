import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Checks if a string is already a valid bcrypt hash
 */
export function isBcryptHash(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$/.test(str);
}

export function needsPasswordRehash(storedPasswordHash: string): boolean {
  return isBcryptHash(storedPasswordHash) && bcrypt.getRounds(storedPasswordHash) < SALT_ROUNDS;
}

/**
 * Hashes a plaintext password using bcrypt
 */
export async function hashPassword(plainTextPassword: string): Promise<string> {
  if (!plainTextPassword) {
    throw new Error('Password cannot be empty');
  }
  // If already hashed, return as is
  if (isBcryptHash(plainTextPassword)) {
    return plainTextPassword;
  }
  return await bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 */
export async function comparePassword(plainTextPassword: string, storedPasswordHashOrPlain: string): Promise<boolean> {
  if (!plainTextPassword || !storedPasswordHashOrPlain) {
    return false;
  }

  if (!isBcryptHash(storedPasswordHashOrPlain)) return false;
  return bcrypt.compare(plainTextPassword, storedPasswordHashOrPlain);
}
