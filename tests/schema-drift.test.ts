import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { runMigrations } from '../scripts/migrate.ts';
import { compareFingerprints, hasDrift, readFingerprint } from '../scripts/schema-drift.ts';
import { withScratchDatabases } from './helpers/scratchDatabase.ts';

const skip = !process.env.DATABASE_URL;

test('a database with application tables and no history is never migrated blindly', { skip, timeout: 120_000 }, async () => {
  await withScratchDatabases(1, async ([client]) => {
    // Simulate a database built by hand, the way production was: the schema exists, the history does not.
    const baseline = await readFile(path.resolve(process.cwd(), 'db/migrations/0001_baseline.sql'), 'utf8');
    await client.query(baseline);

    await assert.rejects(
      runMigrations({ client }),
      /already has application tables but no migration history/
    );
    const history = await client.query("SELECT to_regclass('public.schema_migrations') AS name");
    assert.equal(history.rows[0]?.name, 'schema_migrations', 'the history table may be created');
    const rows = await client.query('SELECT count(*)::int AS count FROM public.schema_migrations');
    assert.equal(rows.rows[0]?.count, 0, 'nothing may be recorded as applied');

    const recorded = await runMigrations({ client, mode: 'baseline', baselineVersion: '0001' });
    assert.deepEqual(recorded.applied, ['0001_baseline']);
    assert.deepEqual((await runMigrations({ client })).pending, []);
  });
});

test('the drift check reports missing, different and extra objects', { skip, timeout: 120_000 }, async () => {
  await withScratchDatabases(2, async ([reference, live]) => {
    await runMigrations({ client: reference });
    await runMigrations({ client: live });

    const clean = compareFingerprints(await readFingerprint(live), await readFingerprint(reference));
    assert.equal(hasDrift(clean, true), false, 'two databases built from the same files match exactly');

    // The kinds of drift production actually has: a lost foreign key, a looser column, an extra index.
    await live.query('ALTER TABLE cart DROP CONSTRAINT cart_customer_id_fkey');
    await live.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
    await live.query('ALTER TABLE orders ALTER COLUMN order_placed_at TYPE timestamp without time zone');
    await live.query('CREATE INDEX idx_drift_demo ON users (created_at)');

    const drifted = compareFingerprints(await readFingerprint(live), await readFingerprint(reference));
    assert.ok(drifted.missing.includes('constraint cart.cart_customer_id_fkey'));
    const different = drifted.different.map((entry) => entry.key);
    assert.ok(different.includes('column users.email'));
    assert.ok(different.includes('column orders.order_placed_at'));
    assert.deepEqual(drifted.extra, ['index users.idx_drift_demo']);
    assert.equal(hasDrift(drifted), true);
    assert.equal(hasDrift({ missing: [], different: [], extra: ['index x'] }), false, 'extras alone only fail in strict mode');
    assert.equal(hasDrift({ missing: [], different: [], extra: ['index x'] }, true), true);
  });
});
