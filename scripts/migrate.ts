import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg, { type Client } from 'pg';
import { buildDatabaseSsl } from '../server/db/ssl.ts';

const { Client: PgClient } = pg;
const migrationsDirectory = path.resolve(process.cwd(), 'db/migrations');
const lockName = 'shopniro:schema-migrations';

type MigrationMode = 'apply' | 'status' | 'dry-run' | 'baseline';

interface Migration {
  version: string;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
  transactional: boolean;
}

interface AppliedMigration {
  version: string;
  name: string;
  checksum: string;
}

export interface MigrationReport {
  mode: MigrationMode;
  applied: string[];
  pending: string[];
}

export interface MigrationOptions {
  client: Client;
  mode?: MigrationMode;
  baselineVersion?: string;
  directory?: string;
}

async function loadMigrations(directory: string): Promise<Migration[]> {
  const entries = (await readdir(directory)).filter((entry) => entry.endsWith('.sql')).sort();
  const migrations: Migration[] = [];
  const versions = new Set<string>();

  for (const filename of entries) {
    const match = filename.match(/^(\d{4})_([a-z0-9][a-z0-9_-]*)\.sql$/);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    const [, version, name] = match;
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`);
    versions.add(version);

    const sql = await readFile(path.join(directory, filename), 'utf8');
    migrations.push({
      version,
      name,
      filename,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
      transactional: !sql.split(/\r?\n/, 1)[0]?.trim().startsWith('-- migrate:no-transaction'),
    });
  }

  return migrations;
}

async function readAppliedMigrations(client: Client): Promise<AppliedMigration[]> {
  const tableResult = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists"
  );
  if (!tableResult.rows[0]?.exists) return [];
  const result = await client.query<AppliedMigration>(
    'SELECT version, name, checksum FROM public.schema_migrations ORDER BY version'
  );
  return result.rows;
}

function validateAppliedMigrations(migrations: Migration[], applied: AppliedMigration[]) {
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  for (const entry of applied) {
    const migration = byVersion.get(entry.version);
    if (!migration) {
      throw new Error(`Applied migration ${entry.version} is missing from db/migrations.`);
    }
    if (migration.checksum !== entry.checksum) {
      throw new Error(`Checksum mismatch for applied migration ${entry.version}; restore the original file.`);
    }
    if (migration.name !== entry.name) {
      throw new Error(`Name mismatch for applied migration ${entry.version}; restore the original filename.`);
    }
  }

  const latestApplied = applied.reduce((latest, entry) => entry.version > latest ? entry.version : latest, '');
  const outOfOrder = migrations.find((migration) =>
    migration.version < latestApplied && !applied.some((entry) => entry.version === migration.version)
  );
  if (outOfOrder) {
    throw new Error(`Migration ${outOfOrder.version} is pending before an already-applied migration.`);
  }
}

const displayName = (migration: Pick<Migration, 'version' | 'name'>) =>
  `${migration.version}_${migration.name}`;

async function hasApplicationTables(client: Client): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('public.users') IS NOT NULL AS exists"
  );
  return Boolean(result.rows[0]?.exists);
}

async function ensureMigrationTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function runMigrations({
  client,
  mode = 'apply',
  baselineVersion,
  directory = migrationsDirectory,
}: MigrationOptions): Promise<MigrationReport> {
  const migrations = await loadMigrations(directory);
  if (migrations.length === 0) throw new Error(`No SQL migrations found in ${directory}.`);

  let lockAcquired = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockName]);
    lockAcquired = true;

    if (mode === 'apply' || mode === 'baseline') await ensureMigrationTable(client);
    let applied = await readAppliedMigrations(client);
    validateAppliedMigrations(migrations, applied);

    if (mode === 'baseline') {
      if (!baselineVersion) throw new Error('--baseline requires a migration version.');
      const targetIndex = migrations.findIndex((migration) => migration.version === baselineVersion);
      if (targetIndex < 0) throw new Error(`Unknown baseline version: ${baselineVersion}`);
      if (targetIndex !== 0) throw new Error('Only the first migration can be baselined.');
      if (applied.some((entry) => entry.version !== baselineVersion)) {
        throw new Error('Cannot baseline after other migrations have been applied.');
      }
      const baseline = migrations[targetIndex];
      if (!applied.some((entry) => entry.version === baseline.version)) {
        await client.query(
          `INSERT INTO public.schema_migrations (version, name, checksum)
           VALUES ($1, $2, $3)`,
          [baseline.version, baseline.name, baseline.checksum]
        );
      }
      applied = await readAppliedMigrations(client);
      return {
        mode,
        applied: applied.map((entry) => `${entry.version}_${entry.name}`),
        pending: migrations
          .filter((migration) => !applied.some((entry) => entry.version === migration.version))
          .map(displayName),
      };
    }

    const pending = migrations.filter((migration) =>
      !applied.some((entry) => entry.version === migration.version)
    );
    if (mode === 'apply' && applied.length === 0 && (await hasApplicationTables(client))) {
      throw new Error(
        'This database already has application tables but no migration history. ' +
          'Refusing to run the baseline over an existing schema. Run npm run migrate:drift against a ' +
          'freshly migrated reference database, and only when it reports no drift record the baseline ' +
          'with npm run migrate -- --baseline 0001.'
      );
    }
    if (mode === 'status' || mode === 'dry-run') {
      return {
        mode,
        applied: applied.map((entry) => `${entry.version}_${entry.name}`),
        pending: pending.map(displayName),
      };
    }

    for (const migration of pending) {
      let transactionOpen = false;
      try {
        if (migration.transactional) {
          await client.query('BEGIN');
          transactionOpen = true;
        }
        await client.query(migration.sql);
        if (!transactionOpen) {
          await client.query('BEGIN');
          transactionOpen = true;
        }
        await client.query(
          `INSERT INTO public.schema_migrations (version, name, checksum)
           VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum]
        );
        await client.query('COMMIT');
        transactionOpen = false;
      } catch (error) {
        if (transactionOpen) {
          await client.query('ROLLBACK').catch((rollbackError: unknown) => {
            console.error('Failed to roll back migration record transaction:', rollbackError);
          });
        }
        throw error;
      }
      applied.push({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
      });
      console.log(`Applied migration ${displayName(migration)}`);
    }

    return {
      mode,
      applied: applied.map((entry) => `${entry.version}_${entry.name}`),
      pending: [],
    };
  } finally {
    if (lockAcquired) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
  }
}

function parseArguments(args: string[]): { mode: MigrationMode; baselineVersion?: string } {
  if (args.includes('--help')) {
    console.log('Usage: npm run migrate [--status | --dry-run | --baseline <version>]\nSee also: npm run migrate:drift -- --help');
    process.exit(0);
  }
  if (args.length === 0) return { mode: 'apply' };
  if (args.length === 1 && args[0] === '--status') return { mode: 'status' };
  if (args.length === 1 && args[0] === '--dry-run') return { mode: 'dry-run' };
  if (args.length === 2 && args[0] === '--baseline' && /^\d{4}$/.test(args[1])) {
    return { mode: 'baseline', baselineVersion: args[1] };
  }
  throw new Error('Expected no flags, --status, --dry-run, or --baseline <four-digit version>.');
}

function printReport(report: MigrationReport) {
  console.log(`Migration ${report.mode} report`);
  console.log(`Applied: ${report.applied.length ? report.applied.join(', ') : 'none'}`);
  console.log(`Pending: ${report.pending.length ? report.pending.join(', ') : 'none'}`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');

  const host = new URL(connectionString).hostname;
  const client = new PgClient({
    connectionString,
    ssl: buildDatabaseSsl(host),
  });
  try {
    await client.connect();
    const report = await runMigrations({ client, ...options });
    printReport(report);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  });
}
