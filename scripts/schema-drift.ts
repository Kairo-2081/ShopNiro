import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg, { type Client } from 'pg';
import { buildDatabaseSsl } from '../server/db/ssl.ts';

const { Client: PgClient } = pg;

/** One entry per database object, keyed by "<kind> <name>", valued by its normalised definition. */
export type Fingerprint = Map<string, string>;

export interface DriftDifference {
  key: string;
  live: string;
  reference: string;
}

export interface DriftReport {
  /** In the reference database but not in the live one. These break later migrations. */
  missing: string[];
  /** In both databases with a different definition. */
  different: DriftDifference[];
  /** Only in the live database. Harmless to migrations, but the live schema is not what the files build. */
  extra: string[];
}

/**
 * Reads the public schema as a map of object definitions. Only catalog reads, so it is safe to run
 * against production. Column order is ignored on purpose: it differs between databases built by
 * different histories and no query depends on it.
 */
export async function readFingerprint(client: Client): Promise<Fingerprint> {
  const result = await client.query<{ kind: string; name: string; definition: string }>(`
    SELECT 'table' AS kind, c.relname::text AS name, 'table' AS definition
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('schema_migrations', 'schema_migration_adoptions')
    UNION ALL
    SELECT 'column', c.relname::text || '.' || a.attname::text,
           format_type(a.atttypid, a.atttypmod)
             || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END
             || COALESCE(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      AND c.relname NOT IN ('schema_migrations', 'schema_migration_adoptions')
      AND a.attnum > 0 AND NOT a.attisdropped
    UNION ALL
    SELECT 'constraint', c.conrelid::regclass::text || '.' || c.conname::text, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    WHERE c.connamespace = 'public'::regnamespace AND c.conrelid <> 0
      AND c.conrelid::regclass::text NOT IN ('schema_migrations', 'schema_migration_adoptions')
    UNION ALL
    SELECT 'index', i.tablename::text || '.' || i.indexname::text, i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public' AND i.tablename NOT IN ('schema_migrations', 'schema_migration_adoptions')
    UNION ALL
    -- Older function bodies may retain Windows line endings in prosrc.
    SELECT 'function', p.oid::regprocedure::text,
           replace(replace(pg_get_functiondef(p.oid), E'\\r\\n', E'\\n'), E'\\r', E'\\n')
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
    UNION ALL
    SELECT 'trigger', t.tgrelid::regclass::text || '.' || t.tgname::text, pg_get_triggerdef(t.oid)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
      AND c.relname NOT IN ('schema_migrations', 'schema_migration_adoptions')
    UNION ALL
    SELECT 'view', v.viewname::text, v.definition
    FROM pg_views v
    WHERE v.schemaname = 'public'
  `);
  return new Map(result.rows.map((row) => [`${row.kind} ${row.name}`, row.definition]));
}

export function compareFingerprints(live: Fingerprint, reference: Fingerprint): DriftReport {
  const missing: string[] = [];
  const different: DriftDifference[] = [];
  const extra: string[] = [];

  for (const [key, referenceDefinition] of reference) {
    const liveDefinition = live.get(key);
    if (liveDefinition === undefined) missing.push(key);
    else if (liveDefinition !== referenceDefinition) {
      different.push({ key, live: liveDefinition, reference: referenceDefinition });
    }
  }
  for (const key of live.keys()) {
    if (!reference.has(key)) extra.push(key);
  }
  return { missing: missing.sort(), different: different.sort((a, b) => a.key.localeCompare(b.key)), extra: extra.sort() };
}

/** Missing and different objects mean the live database is not what the migration files build. */
export function hasDrift(report: DriftReport, strict = false): boolean {
  return report.missing.length > 0 || report.different.length > 0 || (strict && report.extra.length > 0);
}

const oneLine = (definition: string, limit = 150) => {
  const flat = definition.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}...` : flat;
};

export function formatReport(report: DriftReport, options: { full?: boolean } = {}): string {
  const limit = options.full ? Infinity : 40;
  const lines: string[] = [];
  const section = (title: string, entries: string[]) => {
    lines.push(`${title}: ${entries.length}`);
    for (const entry of entries.slice(0, limit)) lines.push(`  ${entry}`);
    if (entries.length > limit) lines.push(`  ... ${entries.length - limit} more (use --full)`);
  };
  section('Missing from the live database', report.missing);
  section(
    'Different in the live database',
    report.different.map((entry) =>
      `${entry.key}\n      live:      ${oneLine(entry.live)}\n      reference: ${oneLine(entry.reference)}`
    )
  );
  section('Only in the live database', report.extra);
  return lines.join('\n');
}

function hostOf(connectionString: string): string {
  return new URL(connectionString).hostname;
}

async function readFingerprintFromUrl(connectionString: string): Promise<Fingerprint> {
  const client = new PgClient({ connectionString, ssl: buildDatabaseSsl(hostOf(connectionString)) });
  try {
    await client.connect();
    await client.query('SET default_transaction_read_only = on');
    return await readFingerprint(client);
  } finally {
    await client.end();
  }
}

function parseArguments(args: string[]) {
  if (args.includes('--help')) {
    console.log(
      'Usage: DATABASE_URL=<live> npm run migrate:drift -- --reference <url> [--strict] [--full]\n' +
        'Compares the live database with a reference database that was built by running npm run migrate\n' +
        'on an empty database. Exits 1 when objects are missing or different.'
    );
    process.exit(0);
  }
  let reference = process.env.REFERENCE_DATABASE_URL;
  let strict = false;
  let full = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--reference') reference = args[++index];
    else if (argument === '--strict') strict = true;
    else if (argument === '--full') full = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return { reference, strict, full };
}

async function main() {
  const { reference, strict, full } = parseArguments(process.argv.slice(2));
  const live = process.env.DATABASE_URL;
  if (!live) throw new Error('DATABASE_URL (the live database) is required.');
  if (!reference) throw new Error('--reference <url> (a freshly migrated database) is required.');
  if (live === reference) throw new Error('The live and reference databases must be different.');

  const [liveFingerprint, referenceFingerprint] = await Promise.all([
    readFingerprintFromUrl(live),
    readFingerprintFromUrl(reference),
  ]);
  const report = compareFingerprints(liveFingerprint, referenceFingerprint);
  console.log(`Schema drift: live ${hostOf(live)} against reference ${hostOf(reference)}`);
  console.log(`Compared ${referenceFingerprint.size} reference objects and ${liveFingerprint.size} live objects.`);
  console.log(formatReport(report, { full }));
  if (hasDrift(report, strict)) {
    console.error('Drift found. Do not record this database as baselined until it matches.');
    process.exitCode = 1;
  } else {
    console.log('No drift: the live schema matches the migration files.');
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error('Schema drift check failed:', error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
