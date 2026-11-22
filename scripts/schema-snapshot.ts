import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { buildDatabaseSsl } from '../server/db/ssl.ts';
import { fingerprintToSnapshot, readFingerprint } from './schema-drift.ts';

const { Client } = pg;

/**
 * Writes db/expected-schema.json from a database that was just built by `npm run migrate` on an empty
 * database. The running app compares the live schema with this file (see schemaWatch.service.ts), and a
 * test fails when the file no longer matches what the migrations build, so a migration PR must refresh it.
 */
const target = process.env.DATABASE_URL;
if (!target) throw new Error('DATABASE_URL (a freshly migrated, empty-start database) is required.');
const client = new Client({ connectionString: target, ssl: buildDatabaseSsl(new URL(target).hostname) });
await client.connect();
try {
  const snapshot = fingerprintToSnapshot(await readFingerprint(client));
  await writeFile(path.resolve(process.cwd(), 'db/expected-schema.json'), `${JSON.stringify(snapshot, null, 1)}\n`);
  console.log(`Wrote db/expected-schema.json with ${Object.keys(snapshot).length} objects.`);
} finally {
  await client.end();
}
