import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTestDatabase, databaseIdentity, resolveTarget } from '../e2e/target.ts';

// The browser suite empties tables when it seeds. These tests pin down the rules that keep it away from production.
const STAGING_DB = 'postgresql://postgres.stagingref:secret@aws-0-ap.pooler.supabase.com:6543/postgres';
const STAGING_ID = 'postgres.stagingref@aws-0-ap.pooler.supabase.com:6543/postgres';
const remoteEnv = { E2E_BASE_URL: 'https://shopniro-staging.onrender.com', E2E_TARGET: 'staging', E2E_STAGING_DB_IDENTITY: STAGING_ID };

test('with no E2E_BASE_URL the target is the local server and only a local database is accepted', () => {
  const target = resolveTarget({});
  assert.deepEqual(target, { remote: false, baseURL: 'http://127.0.0.1:3100' });
  assert.equal(assertTestDatabase('postgresql://u:p@127.0.0.1:5544/shopniro_e2e', target, {}), 'postgresql://u:p@127.0.0.1:5544/shopniro_e2e');
  assert.throws(() => assertTestDatabase(STAGING_DB, target, {}), /non-local database/);
  assert.throws(() => assertTestDatabase(undefined, target, {}), /DATABASE_URL is required/);
});

test('a remote site needs E2E_TARGET=staging, https, and must not be local or production', () => {
  assert.throws(() => resolveTarget({ E2E_BASE_URL: 'https://shopniro-staging.onrender.com' }), /E2E_TARGET=staging/);
  assert.throws(() => resolveTarget({ ...remoteEnv, E2E_BASE_URL: 'http://shopniro-staging.onrender.com' }), /https/);
  assert.throws(() => resolveTarget({ ...remoteEnv, E2E_BASE_URL: 'https://shopniro.onrender.com' }), /production site/);
  assert.throws(() => resolveTarget({ ...remoteEnv, E2E_BASE_URL: 'https://SHOPNIRO.onrender.com/' }), /production site/);
  assert.throws(() => resolveTarget({ ...remoteEnv, E2E_BASE_URL: 'https://localhost' }), /local/);
  assert.throws(() => resolveTarget({ ...remoteEnv, E2E_BASE_URL: 'not a url' }), /not a valid URL/);
  assert.deepEqual(resolveTarget(remoteEnv), { remote: true, baseURL: 'https://shopniro-staging.onrender.com', hostname: 'shopniro-staging.onrender.com' });
});

test('a remote target seeds only the database named exactly in E2E_STAGING_DB_IDENTITY', () => {
  const target = resolveTarget(remoteEnv);
  assert.equal(assertTestDatabase(STAGING_DB, target, remoteEnv), STAGING_DB);
  // Same pooler host, different project in the user name: this is how a production pooler URL differs.
  const production = 'postgresql://postgres.prodref:secret@aws-0-ap.pooler.supabase.com:6543/postgres';
  assert.throws(() => assertTestDatabase(production, target, remoteEnv), /not the database named/);
  assert.throws(() => assertTestDatabase(STAGING_DB, target, { ...remoteEnv, E2E_STAGING_DB_IDENTITY: undefined }), /E2E_STAGING_DB_IDENTITY/);
  assert.throws(() => assertTestDatabase('postgresql://u:p@127.0.0.1:5544/x', target, remoteEnv), /not a local one/);
});

test('the database identity leaves the password out', () => {
  assert.equal(databaseIdentity(STAGING_DB), STAGING_ID);
  assert.ok(!databaseIdentity(STAGING_DB).includes('secret'));
  assert.equal(databaseIdentity('postgresql://u:p@db.example.com/app'), 'u@db.example.com:5432/app');
});
