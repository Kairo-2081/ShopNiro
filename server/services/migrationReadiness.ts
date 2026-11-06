import { readdir } from 'node:fs/promises';
import path from 'node:path';

type Rows<T> = { rows: T[] };
type Run = <T = Record<string, unknown>>(sql: string) => Promise<Rows<T>>;

const defaultDirectory = path.resolve(process.cwd(), 'db/migrations');

/**
 * Migration versions that ship with this build but are not recorded in the database, or null when that cannot be
 * known (the migration files are not next to the running server). The adopted starting schema counts as applied:
 * a database adopted instead of baselined has no row for it by design.
 */
export async function pendingMigrations(run: Run, directory = defaultDirectory): Promise<string[] | null> {
  let files: string[];
  try {
    files = await readdir(directory);
  } catch {
    return null;
  }
  const shipped = files
    .map((file) => file.match(/^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/)?.[1])
    .filter((version): version is string => Boolean(version));
  if (shipped.length === 0) return null;

  const tables = await run<{ history: boolean; adoptions: boolean }>(
    `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS history,
            to_regclass('public.schema_migration_adoptions') IS NOT NULL AS adoptions`
  );
  const known = new Set<string>();
  if (tables.rows[0]?.history) {
    const applied = await run<{ version: string }>('SELECT version FROM public.schema_migrations');
    for (const row of applied.rows) known.add(row.version);
  }
  if (tables.rows[0]?.adoptions) {
    const adopted = await run<{ baseline_version: string }>('SELECT baseline_version FROM public.schema_migration_adoptions');
    for (const row of adopted.rows) known.add(row.baseline_version);
  }
  return shipped.filter((version) => !known.has(version)).sort();
}

const CACHE_MS = 15_000;
let cached: { at: number; pending: string[] | null } | undefined;

/** True when the database is missing a migration this build needs. Cached briefly so a health check every few seconds stays cheap. */
export async function migrationsPending(run: Run): Promise<boolean> {
  if (process.env.READY_REQUIRE_MIGRATIONS === 'false') return false;
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_MS) {
    cached = { at: now, pending: await pendingMigrations(run) };
  }
  return Boolean(cached.pending && cached.pending.length > 0);
}

export function resetMigrationReadinessCache() {
  cached = undefined;
}
