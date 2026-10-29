import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg, { type Client } from 'pg';
import { readFingerprint, type Fingerprint } from './schema-drift.ts';
import { buildDatabaseSsl } from '../server/db/ssl.ts';

const { Client: PgClient } = pg;
const migrationsDirectory = path.resolve(process.cwd(), 'db/migrations');
const lockName = 'shopniro:schema-migrations';

type MigrationMode = 'apply' | 'status' | 'dry-run' | 'baseline' | 'adopt' | 'refresh-adoption';

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

interface SchemaAdoption {
  baseline_version: string;
  baseline_name: string;
  baseline_checksum: string;
  fingerprint_checksum: string;
  fingerprint: Record<string, string>;
}

export interface MigrationReport {
  mode: MigrationMode;
  applied: string[];
  pending: string[];
  adopted?: string;
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

function validateAppliedMigrations(
  migrations: Migration[],
  applied: AppliedMigration[],
  adoptedBaselineVersion?: string
) {
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
    migration.version < latestApplied &&
    migration.version !== adoptedBaselineVersion &&
    !applied.some((entry) => entry.version === migration.version)
  );
  if (outOfOrder) {
    throw new Error(`Migration ${outOfOrder.version} is pending before an already-applied migration.`);
  }
}

function canonicalFingerprint(fingerprint: Fingerprint): { checksum: string; snapshot: Record<string, string> } {
  const entries = [...fingerprint.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const snapshot = Object.fromEntries(entries);
  return {
    checksum: createHash('sha256').update(JSON.stringify(entries)).digest('hex'),
    snapshot,
  };
}

function fingerprintFromSnapshot(snapshot: Record<string, string>): Fingerprint {
  return new Map(Object.entries(snapshot));
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

async function ensureAdoptionTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migration_adoptions (
      baseline_version text PRIMARY KEY,
      baseline_name text NOT NULL,
      baseline_checksum text NOT NULL,
      fingerprint_checksum text NOT NULL,
      fingerprint jsonb NOT NULL,
      adopted_at timestamptz NOT NULL DEFAULT now(),
      adopted_by text NOT NULL DEFAULT current_user
    )
  `);
}

async function readSchemaAdoption(client: Client): Promise<SchemaAdoption | null> {
  const tableResult = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('public.schema_migration_adoptions') IS NOT NULL AS exists"
  );
  if (!tableResult.rows[0]?.exists) return null;
  const result = await client.query<SchemaAdoption>(
    `SELECT baseline_version, baseline_name, baseline_checksum, fingerprint_checksum, fingerprint
     FROM public.schema_migration_adoptions
     ORDER BY baseline_version`
  );
  if (result.rows.length > 1) throw new Error('Multiple schema adoptions exist; manual review is required.');
  return result.rows[0] ?? null;
}

function validateSchemaAdoption(
  migrations: Migration[],
  applied: AppliedMigration[],
  adoption: SchemaAdoption
): Migration {
  const baseline = migrations[0];
  if (!baseline || adoption.baseline_version !== baseline.version ||
      adoption.baseline_name !== baseline.name || adoption.baseline_checksum !== baseline.checksum) {
    throw new Error('The adopted baseline does not match the first migration; restore the original migration files.');
  }
  if (applied.some((entry) => entry.version === baseline.version)) {
    throw new Error('The adopted baseline is also recorded as applied; manual migration-history review is required.');
  }
  return baseline;
}

async function verifyAdoptedFingerprint(client: Client, adoption: SchemaAdoption): Promise<void> {
  const currentFingerprint = await readFingerprint(client);
  const current = canonicalFingerprint(currentFingerprint);
  const recorded = canonicalFingerprint(fingerprintFromSnapshot(adoption.fingerprint));
  if (current.checksum !== adoption.fingerprint_checksum ||
      recorded.checksum !== adoption.fingerprint_checksum) {
    throw new Error(
      'The live schema changed outside the migration runner since adoption (or the adoption record is invalid). ' +
        'Stop and review schema drift before continuing.'
    );
  }
}

const MAX_LEGACY_NAME_LENGTH = 63;

/**
 * Early versions of the fingerprint reader truncated object names to 63 characters (a `name`-typed
 * UNION branch), kept Windows line endings inside function bodies, and had no way to say that a
 * constraint had since been validated. This reduces a fingerprint to a form in which those three
 * artifacts cannot hide or invent a real change.
 */
function legacyComparable(snapshot: Record<string, string>, stored: boolean): Map<string, string[]> {
  // Two long names can share their first 63 characters, so one legacy key may stand for several
  // objects. Collect every definition under the key.
  const grouped = new Map<string, string[]>();
  for (const [fullKey, definition] of Object.entries(snapshot)) {
    const space = fullKey.indexOf(' ');
    const kind = fullKey.slice(0, space);
    const name = fullKey.slice(space + 1).slice(0, MAX_LEGACY_NAME_LENGTH);
    let value = definition.replace(/\r\n?/g, '\n');
    // Validating a constraint is the one change this refresh exists to accept, and only from the
    // stored side: a constraint that became NOT VALID since adoption is a real change.
    if (stored && kind === 'constraint') value = value.replace(/ NOT VALID$/, '');
    const key = `${kind} ${name}`;
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return grouped;
}

async function refreshAdoptedFingerprint(client: Client, adoption: SchemaAdoption): Promise<void> {
  const current = canonicalFingerprint(await readFingerprint(client));
  const before = legacyComparable(adoption.fingerprint, true);
  const after = legacyComparable(current.snapshot, false);
  const changes: string[] = [];
  for (const [key, definitions] of after) {
    const recorded = before.get(key);
    if (!recorded) {
      changes.push(`added: ${key}`);
      continue;
    }
    // A stored 63-character key may have lost all but one of several colliding objects, because the
    // record was a JSON object. Accept a subset there; anywhere else the sets must be equal.
    const truncated = key.slice(key.indexOf(' ') + 1).length === MAX_LEGACY_NAME_LENGTH;
    const sameSet = recorded.length === definitions.length && recorded.every((value) => definitions.includes(value));
    const subset = recorded.every((value) => definitions.includes(value));
    if (!(truncated ? subset : sameSet)) changes.push(`changed: ${key}`);
  }
  for (const key of before.keys()) if (!after.has(key)) changes.push(`removed: ${key}`);
  if (changes.length > 0) {
    throw new Error(
      'Refusing to refresh the adopted schema record: the live schema changed in ways other than validating ' +
        `constraints.\n${changes.slice(0, 40).join('\n')}${changes.length > 40 ? `\n... ${changes.length - 40} more` : ''}`
    );
  }
  await client.query('BEGIN');
  try {
    const result = await client.query(
      `UPDATE public.schema_migration_adoptions
       SET fingerprint_checksum = $2, fingerprint = $3::jsonb
       WHERE baseline_version = $1 AND fingerprint_checksum = $4`,
      [adoption.baseline_version, current.checksum, JSON.stringify(current.snapshot), adoption.fingerprint_checksum]
    );
    if (result.rowCount !== 1) throw new Error('The adopted schema record changed during the refresh.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError: unknown) => {
      console.error('Failed to roll back adoption refresh:', rollbackError);
    });
    throw error;
  }
}

async function updateAdoptedFingerprint(client: Client, baselineVersion: string): Promise<void> {
  const current = canonicalFingerprint(await readFingerprint(client));
  const result = await client.query(
    `UPDATE public.schema_migration_adoptions
     SET fingerprint_checksum = $2, fingerprint = $3::jsonb
     WHERE baseline_version = $1`,
    [baselineVersion, current.checksum, JSON.stringify(current.snapshot)]
  );
  if (result.rowCount !== 1) throw new Error('The adopted schema record disappeared during migration.');
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

    if (mode === 'apply' || mode === 'baseline' || mode === 'adopt') await ensureMigrationTable(client);
    if (mode === 'adopt') await ensureAdoptionTable(client);
    let applied = await readAppliedMigrations(client);
    let adoption = await readSchemaAdoption(client);
    if (adoption) validateSchemaAdoption(migrations, applied, adoption);
    validateAppliedMigrations(migrations, applied, adoption?.baseline_version);

    if (mode === 'baseline') {
      if (!baselineVersion) throw new Error('--baseline requires a migration version.');
      if (adoption) throw new Error('This database already has an adopted starting schema.');
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

    if (mode === 'adopt') {
      if (!baselineVersion) throw new Error('--adopt requires a migration version.');
      if (adoption) throw new Error('This database already has an adopted starting schema.');
      const targetIndex = migrations.findIndex((migration) => migration.version === baselineVersion);
      if (targetIndex < 0) throw new Error(`Unknown adoption baseline: ${baselineVersion}`);
      if (targetIndex !== 0) throw new Error('Only the first migration can be adopted.');
      if (applied.length > 0) throw new Error('Cannot adopt a schema after migrations have been recorded.');
      if (!(await hasApplicationTables(client))) {
        throw new Error('Cannot adopt an empty database; use npm run migrate to build a fresh schema.');
      }

      const baseline = migrations[targetIndex];
      const current = canonicalFingerprint(await readFingerprint(client));
      if (Object.keys(current.snapshot).length === 0) {
        throw new Error('Cannot adopt a database with an empty public schema fingerprint.');
      }
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO public.schema_migration_adoptions
             (baseline_version, baseline_name, baseline_checksum, fingerprint_checksum, fingerprint)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            baseline.version,
            baseline.name,
            baseline.checksum,
            current.checksum,
            JSON.stringify(current.snapshot),
          ]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch((rollbackError: unknown) => {
          console.error('Failed to roll back schema adoption:', rollbackError);
        });
        throw error;
      }
      return {
        mode,
        applied: [],
        pending: migrations.slice(1).map(displayName),
        adopted: displayName(baseline),
      };
    }

    if (mode === 'refresh-adoption') {
      if (!adoption) throw new Error('This database has no adopted starting schema to refresh.');
      await refreshAdoptedFingerprint(client, adoption);
      return {
        mode,
        applied: applied.map((entry) => `${entry.version}_${entry.name}`),
        pending: migrations
          .filter((migration) => !applied.some((entry) => entry.version === migration.version))
          .filter((migration) => migration.version !== adoption.baseline_version)
          .map(displayName),
        adopted: `${adoption.baseline_version}_${adoption.baseline_name}`,
      };
    }

    if (adoption) {
      const baseline = validateSchemaAdoption(migrations, applied, adoption);
      await verifyAdoptedFingerprint(client, adoption);
      validateAppliedMigrations(migrations, applied, baseline.version);
    }

    const pending = migrations.filter((migration) =>
      !applied.some((entry) => entry.version === migration.version) &&
      !(adoption && migration.version === adoption.baseline_version)
    );
    if (mode === 'apply' && applied.length === 0 && !adoption && (await hasApplicationTables(client))) {
      throw new Error(
        'This database already has application tables but no migration history. ' +
        'Refusing to run the baseline over an existing schema. If the existing schema was reviewed ' +
        'for reconciliation, record it explicitly with npm run migrate -- --adopt 0001.'
      );
    }
    if (mode === 'status' || mode === 'dry-run') {
      return {
        mode,
        applied: applied.map((entry) => `${entry.version}_${entry.name}`),
        pending: pending.map(displayName),
        ...(adoption ? { adopted: `${adoption.baseline_version}_${adoption.baseline_name}` } : {}),
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
        if (adoption) {
          await updateAdoptedFingerprint(client, adoption.baseline_version);
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
      if (adoption) {
        const currentFingerprint = canonicalFingerprint(await readFingerprint(client));
        adoption = {
          ...adoption,
          fingerprint_checksum: currentFingerprint.checksum,
          fingerprint: currentFingerprint.snapshot,
        };
      }
      console.log(`Applied migration ${displayName(migration)}`);
    }

    return {
      mode,
      applied: applied.map((entry) => `${entry.version}_${entry.name}`),
      pending: [],
      ...(adoption ? { adopted: `${adoption.baseline_version}_${adoption.baseline_name}` } : {}),
    };
  } finally {
    if (lockAcquired) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
  }
}

function parseArguments(args: string[]): { mode: MigrationMode; baselineVersion?: string } {
  if (args.includes('--help')) {
    console.log(
      'Usage: npm run migrate [--status | --dry-run | --baseline <version> | --adopt <version> | --refresh-adoption]\n' +
        'Adopt records the reviewed current schema as the starting fingerprint without claiming it matches the baseline.\n' +
        'Refresh-adoption re-records the fingerprint after constraints were validated by hand; any other change is refused.\n' +
        'See also: npm run migrate:drift -- --help'
    );
    process.exit(0);
  }
  if (args.length === 0) return { mode: 'apply' };
  if (args.length === 1 && args[0] === '--status') return { mode: 'status' };
  if (args.length === 1 && args[0] === '--dry-run') return { mode: 'dry-run' };
  if (args.length === 2 && args[0] === '--baseline' && /^\d{4}$/.test(args[1])) {
    return { mode: 'baseline', baselineVersion: args[1] };
  }
  if (args.length === 1 && args[0] === '--refresh-adoption') return { mode: 'refresh-adoption' };
  if (args.length === 2 && args[0] === '--adopt' && /^\d{4}$/.test(args[1])) {
    return { mode: 'adopt', baselineVersion: args[1] };
  }
  throw new Error('Expected no flags, --status, --dry-run, --baseline <version>, --adopt <version>, or --refresh-adoption.');
}

function printReport(report: MigrationReport) {
  console.log(`Migration ${report.mode} report`);
  console.log(`Applied: ${report.applied.length ? report.applied.join(', ') : 'none'}`);
  if (report.adopted) console.log(`Adopted starting schema: ${report.adopted}`);
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
