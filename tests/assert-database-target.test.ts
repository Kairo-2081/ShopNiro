import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const REF = 'abcdefghij1234567890';
const run = (env: Record<string, string | undefined>) => {
  const result = spawnSync(process.execPath, ['scripts/assert-database-target.mjs', 'staging'], {
    env: { PATH: process.env.PATH, ...env }, encoding: 'utf8',
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
};

test('a direct connection to the expected project passes', () => {
  const { code, output } = run({ DATABASE_URL: `postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`, EXPECTED_DATABASE_REF: REF });
  assert.equal(code, 0, output);
  assert.match(output, /passed/);
});

test('a pooler connection carries the reference in the user name and passes', () => {
  const { code } = run({ DATABASE_URL: `postgresql://postgres.${REF}:pw@aws-0-region.pooler.supabase.com:6543/postgres`, EXPECTED_DATABASE_REF: REF });
  assert.equal(code, 0);
});

test('a URL for a different project is refused', () => {
  const { code, output } = run({ DATABASE_URL: 'postgresql://postgres:pw@db.zzzzzzzzzz0987654321.supabase.co:5432/postgres', EXPECTED_DATABASE_REF: REF });
  assert.equal(code, 1);
  assert.match(output, /does not belong/);
});

test('a reference that only appears in the password or path does not count', () => {
  const { code } = run({ DATABASE_URL: `postgresql://postgres:${REF}@db.other0000000000000000.supabase.co/${REF}`, EXPECTED_DATABASE_REF: REF });
  assert.equal(code, 1);
});

test('it fails closed when the expected reference is missing or malformed', () => {
  for (const EXPECTED_DATABASE_REF of [undefined, '', 'short', 'HAS CAPS AND SPACES']) {
    const { code, output } = run({ DATABASE_URL: `postgresql://postgres:pw@db.${REF}.supabase.co/postgres`, EXPECTED_DATABASE_REF });
    assert.equal(code, 1, String(EXPECTED_DATABASE_REF));
    assert.match(output, /EXPECTED_DATABASE_REF/);
  }
});

test('it fails when there is no database URL or it is not a URL', () => {
  assert.equal(run({ EXPECTED_DATABASE_REF: REF }).code, 1);
  assert.equal(run({ DATABASE_URL: 'not a url', EXPECTED_DATABASE_REF: REF }).code, 1);
});

test('it never prints the password or the host', () => {
  const password = 'S3cretPassw0rdValue';
  for (const url of [
    `postgresql://postgres:${password}@db.${REF}.supabase.co:5432/postgres`,
    `postgresql://postgres:${password}@db.other0000000000000000.supabase.co:5432/postgres`,
  ]) {
    const { output } = run({ DATABASE_URL: url, EXPECTED_DATABASE_REF: REF });
    assert.ok(!output.includes(password), 'password leaked');
    assert.ok(!output.includes('supabase.co'), 'host leaked');
  }
});
