import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg, { type Client } from 'pg';
import { buildDatabaseSsl } from '../../server/db/ssl.ts';

const { Client: PgClient } = pg;

/**
 * Creates throwaway databases next to DATABASE_URL and drops them afterwards. Refuses to run unless
 * DATABASE_URL is a local database with "test" in its name, so it can never touch shared data.
 */
export async function withScratchDatabases(
  count: number,
  work: (clients: Client[]) => Promise<void>
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'DATABASE_URL is required');
  const baseUrl = new URL(databaseUrl);
  const baseName = decodeURIComponent(baseUrl.pathname.slice(1));
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname) && /test/i.test(baseName),
    'Scratch databases may only be created next to a local database with "test" in its name.'
  );

  const ssl = buildDatabaseSsl(baseUrl.hostname);
  const admin = new PgClient({ connectionString: databaseUrl, ssl });
  const names = Array.from({ length: count }, () => `shopniro_scratch_test_${randomUUID().replaceAll('-', '')}`);
  const clients: Client[] = [];
  let adminConnected = false;
  try {
    await admin.connect();
    adminConnected = true;
    for (const name of names) {
      await admin.query(`CREATE DATABASE "${name}"`);
      const client = new PgClient({ connectionString: new URL(`/${name}`, databaseUrl).toString(), ssl });
      await client.connect();
      clients.push(client);
    }
    await work(clients);
  } finally {
    for (const client of clients) await client.end();
    if (adminConnected) {
      for (const name of names) await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.end();
    }
  }
}
