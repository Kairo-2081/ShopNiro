import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compareFingerprints, hasDrift, readFingerprint, snapshotToFingerprint, type DriftReport } from '../../scripts/schema-drift.ts';
import { query } from '../db/index.ts';
import { pendingMigrations } from './migrationReadiness.ts';

const snapshotPath = path.resolve(process.cwd(), 'db/expected-schema.json');

export interface SchemaWatchResult {
  ok: boolean;
  /** Migration versions in this deploy that the live database has not recorded; null when the files are not deployed. */
  pendingMigrations: string[] | null;
  report: DriftReport;
}

/**
 * Compares the live database with the schema the migration files build (db/expected-schema.json), and checks
 * that every shipped migration is recorded. Catalog reads only; the result names objects, never data.
 */
export async function runSchemaWatch(): Promise<SchemaWatchResult> {
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as Record<string, string>;
  const report = compareFingerprints(await readFingerprint({ query }), snapshotToFingerprint(snapshot));
  const pending = await pendingMigrations(query);
  return { ok: !hasDrift(report) && (pending?.length ?? 0) === 0, pendingMigrations: pending, report };
}
