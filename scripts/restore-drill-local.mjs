// Local restore drill: dump a disposable local database, restore the dump into a brand new database, and check that
// every table has the same row count. Prints the measured times as JSON.
//
//   DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/shopniro_test node scripts/restore-drill-local.mjs
//
// This rehearses the dump and restore mechanics and the size-to-time relationship only. It does not decrypt an `age`
// backup, download the CI artifact or touch Supabase, so it does not replace the dated drill in
// docs/runbooks/drill-record.md. It refuses a non-local database, and it drops the database it creates.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const raw = process.env.DATABASE_URL || '';
let url;
try { url = new URL(raw); } catch { console.error('Set DATABASE_URL to a local PostgreSQL URL.'); process.exit(2); }
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
  console.error('Refusing to run: DATABASE_URL must be a local database.');
  process.exit(2);
}
const sourceName = url.pathname.slice(1);
const restoreName = `${sourceName}_restore_${Date.now()}`;
const env = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
const base = ['-h', url.hostname, '-p', url.port || '5432', '-U', decodeURIComponent(url.username)];

const run = (cmd, args, label) => {
  const started = performance.now();
  const result = spawnSync(cmd, args, { env, encoding: 'utf8' });
  const ms = performance.now() - started;
  if (result.status !== 0) {
    console.error(`${label} failed:`, (result.stderr || '').slice(0, 500));
    throw new Error(`${label} failed`);
  }
  return { ms, stdout: result.stdout };
};
const counts = (db) => {
  const tables = run('psql', [...base, '-d', db, '-Atc', "select tablename from pg_tables where schemaname='public' order by 1"], 'list tables').stdout.trim().split('\n').filter(Boolean);
  const sql = tables.map((t) => `select '${t}', count(*) from public."${t}"`).join(' union all ');
  const rows = run('psql', [...base, '-d', db, '-Atc', sql], 'count rows').stdout.trim().split('\n').map((line) => line.split('|'));
  return Object.fromEntries(rows.map(([table, n]) => [table, Number(n)]));
};

const dir = mkdtempSync(join(tmpdir(), 'restore-drill-'));
const dump = join(dir, 'drill.dump');
let result;
try {
  const dumped = run('pg_dump', [...base, '-Fc', '--no-owner', '-f', dump, sourceName], 'pg_dump');
  const bytes = statSync(dump).size;
  run('createdb', [...base, restoreName], 'createdb');
  const restored = run('pg_restore', [...base, '--no-owner', '-d', restoreName, dump], 'pg_restore');
  const before = counts(sourceName);
  const after = counts(restoreName);
  const mismatched = Object.keys(before).filter((t) => before[t] !== after[t]);
  const size = Number(run('psql', [...base, '-d', sourceName, '-Atc', 'select pg_database_size(current_database())'], 'size').stdout);
  result = {
    drill: 'local-restore',
    date: new Date().toISOString().slice(0, 10),
    databaseBytes: size,
    dumpBytes: bytes,
    tables: Object.keys(before).length,
    totalRows: Object.values(before).reduce((a, b) => a + b, 0),
    dumpSeconds: +(dumped.ms / 1000).toFixed(2),
    restoreSeconds: +(restored.ms / 1000).toFixed(2),
    dumpPlusRestoreSeconds: +((dumped.ms + restored.ms) / 1000).toFixed(2),
    rowCountsMatch: mismatched.length === 0,
    mismatchedTables: mismatched,
    note: 'Local PostgreSQL, unencrypted dump, no network. A hosted restore adds download, decryption and network time.',
  };
} finally {
  spawnSync('dropdb', [...base, '--if-exists', restoreName], { env });
  rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(result, null, 2));
if (process.env.DRILL_OUT) writeFileSync(process.env.DRILL_OUT, JSON.stringify(result, null, 2));
process.exit(result.rowCountsMatch ? 0 : 1);
