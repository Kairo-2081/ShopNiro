// Where the browser tests run, and the guards that stop them running somewhere they must not.
//
// Default: a throwaway local server and database. Staging: set E2E_BASE_URL to the staging site and the suite
// runs against it instead, seeding and checking the staging database directly. The seed script empties tables, so
// the staging database is only accepted when the whole connection identity matches one the operator wrote down.
// This file has no imports so a unit test can load it without Playwright.

export type E2ETarget = { remote: false; baseURL: string } | { remote: true; baseURL: string; hostname: string };

// The public production API host (it is also the default in src/apiConfig.ts). Never a test target.
export const PRODUCTION_HOSTS = ['shopniro.onrender.com'];

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

type Env = Record<string, string | undefined>;

export function resolveTarget(env: Env): E2ETarget {
  const port = Number(env.E2E_PORT) || 3100;
  if (!env.E2E_BASE_URL) return { remote: false, baseURL: `http://127.0.0.1:${port}` };

  if (env.E2E_TARGET !== 'staging') {
    throw new Error('E2E_BASE_URL points the tests at a remote site; also set E2E_TARGET=staging to confirm that is intended.');
  }
  let url: URL;
  try { url = new URL(env.E2E_BASE_URL); } catch { throw new Error(`E2E_BASE_URL is not a valid URL: ${env.E2E_BASE_URL}`); }
  if (url.protocol !== 'https:') throw new Error('E2E_BASE_URL must be an https URL.');
  if (LOCAL_HOSTS.includes(url.hostname)) throw new Error('E2E_BASE_URL is local; leave it unset to use the local test server.');
  if (PRODUCTION_HOSTS.includes(url.hostname.toLowerCase())) {
    throw new Error(`Refusing to run the e2e tests against the production site (${url.hostname}).`);
  }
  return { remote: true, baseURL: url.origin, hostname: url.hostname };
}

/** user@host:port/database, without the password, so it can be compared and logged safely. */
export function databaseIdentity(connectionString: string): string {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return `${decodeURIComponent(url.username)}@${url.hostname}:${url.port || '5432'}/${database}`;
}

/** Returns the URL when it is safe to seed and empty; throws otherwise. */
export function assertTestDatabase(url: string | undefined, target: E2ETarget, env: Env = process.env): string {
  if (!url) throw new Error('DATABASE_URL is required for the e2e tests.');
  const host = new URL(url).hostname;
  const local = LOCAL_HOSTS.includes(host);

  if (!target.remote) {
    if (!local) throw new Error(`Refusing to run e2e tests against a non-local database (${host}).`);
    return url;
  }
  // A remote site with a local database would seed one database and test another, silently.
  if (local) throw new Error('A remote E2E_BASE_URL needs the staging DATABASE_URL, not a local one.');
  const allowed = env.E2E_STAGING_DB_IDENTITY;
  if (!allowed) {
    throw new Error('Set E2E_STAGING_DB_IDENTITY to the staging database as user@host:port/database (no password) so the suite can tell it from production.');
  }
  const actual = databaseIdentity(url);
  if (actual !== allowed) {
    throw new Error(`Refusing to seed ${actual}: it is not the database named in E2E_STAGING_DB_IDENTITY.`);
  }
  return url;
}
