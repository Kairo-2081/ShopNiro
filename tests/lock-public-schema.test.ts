import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import pg from 'pg';
import { buildDatabaseSsl } from '../server/db/ssl.ts';
import { runMigrations } from '../scripts/migrate.ts';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

test('migrations leave row-level security enabled on every public table', {
  skip: !databaseUrl,
  timeout: 120_000,
}, async () => {
  if (!databaseUrl) return;
  const baseUrl = new URL(databaseUrl);
  const baseDatabaseName = decodeURIComponent(baseUrl.pathname.slice(1));
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname) && /test/i.test(baseDatabaseName),
    'This test may only connect to a local database with "test" in its name.'
  );

  const ssl = buildDatabaseSsl(baseUrl.hostname);
  const scratchName = `shopniro_lock_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: databaseUrl, ssl });
  let scratch: InstanceType<typeof Client> | undefined;

  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${scratchName}"`);
    scratch = new Client({ connectionString: new URL(`/${scratchName}`, databaseUrl).toString(), ssl });
    await scratch.connect();

    const report = await runMigrations({ client: scratch });
    assert.ok(report.applied.includes('0010_lock_public_schema'), 'the lock-down migration should be applied');

    const unlocked = await scratch.query<{ relname: string }>(
      `SELECT c.relname
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
       ORDER BY c.relname`
    );
    assert.deepEqual(unlocked.rows.map((row) => row.relname), [], 'every public table must have RLS enabled');

    // The application connects as the table owner, which RLS does not apply to, so it must keep working.
    const owner = await scratch.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM public.users');
    assert.equal(owner.rows[0].count, '0');

    // Running the migration's SQL a second time (as it would be on production, where everything is
    // already locked) must succeed and change nothing.
    const sql = await readFile(path.resolve(process.cwd(), 'db/migrations/0010_lock_public_schema.sql'), 'utf8');
    await scratch.query(sql);
    const afterSecondRun = await scratch.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity`
    );
    assert.equal(afterSecondRun.rows[0].count, '0');

    const again = await runMigrations({ client: scratch });
    assert.deepEqual(again.pending, []);
  } finally {
    await scratch?.end().catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`).catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
});
