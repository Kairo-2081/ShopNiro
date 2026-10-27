import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const directory = path.resolve(process.cwd(), 'db/migrations');
// Changing the baseline changes what every new database looks like and breaks the checksum already
// recorded in production. If this fails, add a numbered migration instead of editing the file.
const BASELINE_SHA256 = '06df2fdde6fbfff260397f16b2f8a34d1b46dd84b8cddbda4da62c7f468dc315';

test('migration files are numbered 0001, 0002, ... with no gaps or duplicates', async () => {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(files.length > 0, 'at least the baseline exists');
  files.forEach((name, index) => {
    assert.match(name, /^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/, `${name} must look like 0001_description.sql`);
    assert.equal(Number(name.slice(0, 4)), index + 1, `${name} must be migration number ${index + 1}`);
  });
  assert.equal(files[0], '0001_baseline.sql');
});

test('the baseline file is unchanged', async () => {
  const baseline = await readFile(path.join(directory, '0001_baseline.sql'), 'utf8');
  assert.equal(createHash('sha256').update(baseline).digest('hex'), BASELINE_SHA256);
});

test('schema.sql is only a labelled copy of the baseline, never a second source of truth', async () => {
  const baseline = await readFile(path.join(directory, '0001_baseline.sql'), 'utf8');
  const schema = await readFile(path.resolve(process.cwd(), 'schema.sql'), 'utf8');
  const newline = schema.indexOf('\n');
  assert.match(schema.slice(0, newline), /^-- Frozen baseline snapshot/);
  assert.equal(schema.slice(newline + 1), baseline);
});
