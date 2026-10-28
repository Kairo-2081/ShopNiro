import assert from 'node:assert/strict';
import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg, { type Client } from 'pg';
import { buildDatabaseSsl } from '../server/db/ssl.ts';
import { runMigrations } from '../scripts/migrate.ts';

const { Client: PgClient } = pg;
const databaseUrl = process.env.DATABASE_URL;

test('migration runner applies, verifies, and baselines schemas safely', {
  skip: !databaseUrl,
  timeout: 120_000,
}, async () => {
  if (!databaseUrl) return;
  const baseUrl = new URL(databaseUrl);
  const baseDatabaseName = decodeURIComponent(baseUrl.pathname.slice(1));
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname) && /test/i.test(baseDatabaseName),
    'Migration integration tests may only connect to a local database with "test" in its name.'
  );

  const ssl = buildDatabaseSsl(baseUrl.hostname);
  const admin = new PgClient({ connectionString: databaseUrl, ssl });
  const scratchDatabaseNames = [
    `shopniro_migration_test_${randomUUID().replaceAll('-', '')}`,
    `shopniro_baseline_test_${randomUUID().replaceAll('-', '')}`,
  ];
  const tempMigrations = await mkdtemp(path.join(tmpdir(), 'shopniro-migrations-'));
  const migrationDirectory = path.resolve(process.cwd(), 'db/migrations');
  const connectedClients: Client[] = [];
  let adminConnected = false;

  const createScratchDatabase = async (name: string) => {
    await admin.query(`CREATE DATABASE "${name}"`);
    const client = new PgClient({
      connectionString: new URL(`/${name}`, databaseUrl).toString(),
      ssl,
    });
    await client.connect();
    connectedClients.push(client);
    return client;
  };

  try {
    await admin.connect();
    adminConnected = true;
    const freshClient = await createScratchDatabase(scratchDatabaseNames[0]);
    const beforeRun = await runMigrations({ client: freshClient, mode: 'status' });
    assert.deepEqual(beforeRun.pending, ['0001_baseline']);

    const firstRun = await runMigrations({ client: freshClient });
    assert.equal(firstRun.pending.length, 0);

    const schemaCounts = await freshClient.query<{
      table_count: string;
      shopniro_function_count: string;
    }>(`
      SELECT
        (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           AND table_name <> 'schema_migrations') AS table_count,
        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND left(p.proname, 9) = 'shopniro_') AS shopniro_function_count
    `);
    assert.equal(Number(schemaCounts.rows[0]?.table_count), 34);
    assert.equal(Number(schemaCounts.rows[0]?.shopniro_function_count), 54);

    const recordedBeforeRerun = await freshClient.query<{ applied_at: string }>(
      'SELECT applied_at::text FROM public.schema_migrations WHERE version = $1',
      ['0001']
    );
    const secondRun = await runMigrations({ client: freshClient });
    assert.equal(secondRun.pending.length, 0);
    const recordedAfterRerun = await freshClient.query<{ applied_at: string }>(
      'SELECT applied_at::text FROM public.schema_migrations WHERE version = $1',
      ['0001']
    );
    assert.equal(recordedAfterRerun.rows[0]?.applied_at, recordedBeforeRerun.rows[0]?.applied_at);

    await cp(path.join(migrationDirectory, '0001_baseline.sql'), path.join(tempMigrations, '0001_baseline.sql'));
    await appendFile(path.join(tempMigrations, '0001_baseline.sql'), '\n-- changed after apply\n');
    await assert.rejects(
      runMigrations({ client: freshClient, mode: 'status', directory: tempMigrations }),
      /Checksum mismatch for applied migration 0001/
    );

    const baselineClient = await createScratchDatabase(scratchDatabaseNames[1]);
    const baselineRun = await runMigrations({
      client: baselineClient,
      mode: 'baseline',
      baselineVersion: '0001',
    });
    assert.deepEqual(baselineRun.applied, ['0001_baseline']);
    const baselineObjects = await baselineClient.query<{ users: string | null }>(
      "SELECT to_regclass('public.users') AS users"
    );
    assert.equal(baselineObjects.rows[0]?.users, null);
  } finally {
    for (const client of connectedClients) await client.end();
    if (adminConnected) {
      for (const name of scratchDatabaseNames) {
        await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      }
      await admin.end();
    }
    await rm(tempMigrations, { recursive: true, force: true });
  }
});
