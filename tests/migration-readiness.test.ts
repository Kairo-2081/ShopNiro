import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { migrationsPending, pendingMigrations, resetMigrationReadinessCache } from '../server/services/migrationReadiness.ts';

type Fake = { history: boolean; adoptions: boolean; applied: string[]; adopted: string[] };

const fakeDatabase = (state: Fake) => async <T,>(sql: string): Promise<{ rows: T[] }> => {
  if (sql.includes('to_regclass')) return { rows: [{ history: state.history, adoptions: state.adoptions }] as T[] };
  if (sql.includes('FROM public.schema_migrations')) return { rows: state.applied.map((version) => ({ version })) as T[] };
  if (sql.includes('FROM public.schema_migration_adoptions')) return { rows: state.adopted.map((baseline_version) => ({ baseline_version })) as T[] };
  throw new Error(`unexpected query: ${sql}`);
};

const withMigrationFiles = async (names: string[], fn: (directory: string) => Promise<void>) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ready-migrations-'));
  try {
    for (const name of names) await writeFile(path.join(directory, name), '-- test\n');
    await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const FILES = ['0001_baseline.sql', '0002_a.sql', '0003_b.sql', 'README.md'];

test('a database with every shipped migration recorded has nothing pending', async () => {
  await withMigrationFiles(FILES, async (directory) => {
    const run = fakeDatabase({ history: true, adoptions: false, applied: ['0001', '0002', '0003'], adopted: [] });
    assert.deepEqual(await pendingMigrations(run, directory), []);
  });
});

test('names the shipped migrations the database has not had', async () => {
  await withMigrationFiles(FILES, async (directory) => {
    const run = fakeDatabase({ history: true, adoptions: false, applied: ['0001', '0002'], adopted: [] });
    assert.deepEqual(await pendingMigrations(run, directory), ['0003']);
  });
});

test('an adopted starting schema counts as applied even though it has no history row', async () => {
  await withMigrationFiles(FILES, async (directory) => {
    const run = fakeDatabase({ history: true, adoptions: true, applied: ['0002', '0003'], adopted: ['0001'] });
    assert.deepEqual(await pendingMigrations(run, directory), []);
  });
});

test('a database with no migration history at all has everything pending', async () => {
  await withMigrationFiles(FILES, async (directory) => {
    const run = fakeDatabase({ history: false, adoptions: false, applied: [], adopted: [] });
    assert.deepEqual(await pendingMigrations(run, directory), ['0001', '0002', '0003']);
  });
});

test('missing or empty migration files mean "unknown", not "pending", so a bad deploy layout cannot take the site down', async () => {
  const run = fakeDatabase({ history: true, adoptions: false, applied: [], adopted: [] });
  assert.equal(await pendingMigrations(run, path.join(os.tmpdir(), 'does-not-exist-migrations')), null);
  await withMigrationFiles(['README.md'], async (directory) => {
    assert.equal(await pendingMigrations(run, directory), null);
  });
});

test('READY_REQUIRE_MIGRATIONS=false switches the check off', async () => {
  const previous = process.env.READY_REQUIRE_MIGRATIONS;
  process.env.READY_REQUIRE_MIGRATIONS = 'false';
  resetMigrationReadinessCache();
  try {
    const run = async () => { throw new Error('must not query when switched off'); };
    assert.equal(await migrationsPending(run as never), false);
  } finally {
    if (previous === undefined) delete process.env.READY_REQUIRE_MIGRATIONS;
    else process.env.READY_REQUIRE_MIGRATIONS = previous;
    resetMigrationReadinessCache();
  }
});
