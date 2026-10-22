import { readFileSync } from 'node:fs';
import type pg from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
let warnedUnverified = false;

/**
 * Reads the database CA certificate from DB_CA_CERT (PEM text, "\n" escapes allowed)
 * or DB_CA_CERT_PATH (path to a .crt file). Throws if it is set but not a certificate,
 * so a bad value fails loudly at startup instead of as a confusing handshake error.
 */
export function loadDatabaseCa(env: NodeJS.ProcessEnv = process.env): string | undefined {
  let pem = env.DB_CA_CERT?.trim();
  if (!pem && env.DB_CA_CERT_PATH?.trim()) {
    try {
      pem = readFileSync(env.DB_CA_CERT_PATH.trim(), 'utf8');
    } catch {
      throw new Error(`DB_CA_CERT_PATH could not be read: ${env.DB_CA_CERT_PATH}`);
    }
  }
  if (!pem) return undefined;
  pem = pem.replace(/\\n/g, '\n').trim();
  if (!/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(pem)) {
    throw new Error('DB_CA_CERT / DB_CA_CERT_PATH does not contain a PEM certificate.');
  }
  return pem + '\n';
}

/**
 * TLS settings for the Postgres pool.
 *
 * - With a CA certificate configured, the server certificate chain and hostname are verified.
 * - Without one, the connection is encrypted but the server identity is NOT checked
 *   (the previous behaviour). Production logs a warning, and DB_REQUIRE_TLS_VERIFY=true
 *   makes startup fail instead.
 * - DATABASE_SSL=false/disable turns TLS off, and local hosts default to no TLS.
 */
export function buildDatabaseSsl(host: string | undefined, env: NodeJS.ProcessEnv = process.env): pg.PoolConfig['ssl'] {
  const mode = (env.DATABASE_SSL || '').toLowerCase();
  if (mode === 'false' || mode === 'disable') return false;

  const isLocal = Boolean(host && LOCAL_HOSTS.has(host));
  const ca = loadDatabaseCa(env);
  if (ca && !isLocal) return { ca, rejectUnauthorized: true };

  if (isLocal && mode !== 'true' && mode !== 'require') return false;

  if (env.DB_REQUIRE_TLS_VERIFY === 'true' && !isLocal) {
    throw new Error('DB_REQUIRE_TLS_VERIFY=true but no DB_CA_CERT / DB_CA_CERT_PATH is set.');
  }
  if (env.NODE_ENV === 'production' && !isLocal && !warnedUnverified) {
    warnedUnverified = true;
    console.warn('Database TLS is encrypted but the server certificate is NOT verified. Set DB_CA_CERT to enable verification.');
  }
  return { rejectUnauthorized: false };
}
