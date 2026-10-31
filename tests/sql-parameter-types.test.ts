import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';

// Postgres refuses a statement that uses one parameter as a column value and again in a comparison when the two
// positions imply different types ("inconsistent types deduced for parameter $1"). Migration 0004 changed column
// types, which turned two such statements (seller status, support ticket status) into 500s on the live database
// while every test passed. This parses each statement that reuses a parameter, so the next one fails here.
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : name.endsWith('.ts') ? [full] : [];
});

const databaseUrl = process.env.DATABASE_URL;
const dbTest = databaseUrl ? test : test.skip;

dbTest('statements that reuse a parameter parse on the migrated schema', async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const failures: string[] = [];
  let checked = 0;
  try {
    for (const file of walk('server')) {
      for (const match of readFileSync(file, 'utf8').matchAll(/`([^`]*)`/g)) {
        const sql = match[1];
        if (!/\b(UPDATE|INSERT INTO|DELETE FROM|SELECT)\b/i.test(sql) || sql.includes('${')) continue;
        const params = [...sql.matchAll(/\$(\d+)/g)].map((found) => found[1]);
        if (new Set(params).size === params.length) continue;
        checked += 1;
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`PREPARE reuse_check_${checked} AS ${sql}`);
        } catch (error: any) {
          if (error.code === '42P08' || error.code === '42P18') failures.push(`${file}: ${error.message}: ${sql.replace(/\s+/g, ' ').slice(0, 120)}`);
        } finally {
          await client.query('ROLLBACK').catch(() => undefined);
          client.release();
        }
      }
    }
  } finally {
    await pool.end();
  }
  assert.ok(checked > 0, 'the scan found statements to check');
  assert.deepEqual(failures, []);
});
