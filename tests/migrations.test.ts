import assert from 'node:assert/strict';
import { appendFile, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg, { type Client } from 'pg';
import { buildDatabaseSsl } from '../server/db/ssl.ts';
import { runMigrations } from '../scripts/migrate.ts';
import { compareFingerprints, readFingerprint } from '../scripts/schema-drift.ts';

const { Client: PgClient } = pg;
const databaseUrl = process.env.DATABASE_URL;

test('migration runner applies, verifies, and baselines schemas safely', {
  skip: !databaseUrl,
  timeout: 120_000,
}, async () => {
  if (!databaseUrl) return;
  const baseUrl = new URL(databaseUrl);
  const baseDatabaseName = decodeURIComponent(baseUrl.pathname.slice(1));
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname) && /test/i.test(baseDatabaseName),
    'Migration integration tests may only connect to a local database with "test" in its name.'
  );

  const ssl = buildDatabaseSsl(baseUrl.hostname);
  const admin = new PgClient({ connectionString: databaseUrl, ssl });
  const scratchDatabaseNames = [
    `shopniro_migration_test_${randomUUID().replaceAll('-', '')}`,
    `shopniro_baseline_test_${randomUUID().replaceAll('-', '')}`,
    `shopniro_reference_test_${randomUUID().replaceAll('-', '')}`,
  ];
  const tempMigrations = await mkdtemp(path.join(tmpdir(), 'shopniro-migrations-'));
  const baselineMigrations = await mkdtemp(path.join(tmpdir(), 'shopniro-baseline-migrations-'));
  const reconciledMigrations = await mkdtemp(path.join(tmpdir(), 'shopniro-reconciled-migrations-'));
  const migrationDirectory = path.resolve(process.cwd(), 'db/migrations');
  const connectedClients: Client[] = [];
  let adminConnected = false;

  const createScratchDatabase = async (name: string) => {
    await admin.query(`CREATE DATABASE "${name}"`);
    const client = new PgClient({
      connectionString: new URL(`/${name}`, databaseUrl).toString(),
      ssl,
    });
    await client.connect();
    connectedClients.push(client);
    return client;
  };

  try {
    await admin.connect();
    adminConnected = true;
    const freshClient = await createScratchDatabase(scratchDatabaseNames[0]);
    const beforeRun = await runMigrations({ client: freshClient, mode: 'status' });
    assert.deepEqual(beforeRun.pending, [
      '0001_baseline',
      '0002_reconcile_missing_constraints',
      '0003_validate_reconciled_constraints',
      '0004_reconcile_column_types',
    ]);

    await cp(path.join(migrationDirectory, '0001_baseline.sql'), path.join(baselineMigrations, '0001_baseline.sql'));
    const baselineOnly = await runMigrations({ client: freshClient, directory: baselineMigrations });
    assert.deepEqual(baselineOnly.applied, ['0001_baseline']);

    await freshClient.query(`
      ALTER TABLE cart DROP CONSTRAINT cart_customer_id_fkey;
      ALTER TABLE cart DROP CONSTRAINT cart_product_id_fkey;
      ALTER TABLE orders DROP CONSTRAINT orders_customer_id_fkey;
      ALTER TABLE products DROP CONSTRAINT products_category_id_fkey;
      ALTER TABLE products DROP CONSTRAINT products_seller_id_fkey;
      ALTER TABLE reviews DROP CONSTRAINT reviews_customer_id_fkey;
      ALTER TABLE reviews DROP CONSTRAINT reviews_product_id_fkey;
      ALTER TABLE reviews DROP CONSTRAINT reviews_rating_check;
      ALTER TABLE users DROP CONSTRAINT users_username_key;
    `);

    for (const filename of [
      '0001_baseline.sql',
      '0002_reconcile_missing_constraints.sql',
      '0003_validate_reconciled_constraints.sql',
    ]) {
      await cp(path.join(migrationDirectory, filename), path.join(reconciledMigrations, filename));
    }
    await runMigrations({ client: freshClient, directory: reconciledMigrations });

    await freshClient.query(`
      GRANT SELECT ON public.customer_profiles TO PUBLIC;
      GRANT SELECT (username) ON public.seller_profiles TO PUBLIC;
      REVOKE EXECUTE ON FUNCTION public.shopniro_customer_get(character varying) FROM PUBLIC;
      ALTER TABLE public.orders
        ALTER COLUMN payment_method TYPE text,
        ALTER COLUMN payment_method DROP NOT NULL,
        ALTER COLUMN payment_status TYPE text,
        ALTER COLUMN payment_status DROP NOT NULL;
      ALTER TABLE public.payments
        ALTER COLUMN amount TYPE numeric,
        ALTER COLUMN gateway TYPE text,
        ALTER COLUMN created_at DROP DEFAULT,
        ALTER COLUMN created_at TYPE timestamp without time zone
          USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
      INSERT INTO public.users (id, username, password, email, role)
        VALUES (
          'CUST-MIGRATION-TEST', 'migration-test-user', 'test-password',
          'migration-test@example.invalid', 'customer'
        );
      INSERT INTO public.customers (id, name)
        VALUES ('CUST-MIGRATION-TEST', 'Migration test customer');
      INSERT INTO public.orders (
        id, tracking_id, customer_id, items_json, subtotal, shipping_address_json, billing_address_json,
        payment_status, payment_method
      ) VALUES (
        'ORDER-MIGRATION-TEST', 'TRACK-MIGRATION-TEST', 'CUST-MIGRATION-TEST', '[]', 3000,
        '{}', '{}', NULL, NULL
      );
      ALTER TABLE public.payments DROP CONSTRAINT fk_payments_customer;
      ALTER TABLE public.payments DROP CONSTRAINT chk_payments_order_required;
      INSERT INTO public.payments (
        id, order_id, customer_id, amount, payment_method, transaction_id, status, created_at
      ) VALUES (
        'PAY-ORPHAN-TEST', NULL, 'MISSING-CUSTOMER-TEST', 3000,
        'sslcommerz', 'TXN-ORPHAN-TEST', 'VALIDATED', '2024-01-01 12:00:00'
      );
      ALTER TABLE public.payments
        ADD CONSTRAINT fk_payments_customer
        FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT NOT VALID;
      ALTER TABLE public.payments
        ADD CONSTRAINT chk_payments_order_required CHECK (order_id IS NOT NULL) NOT VALID;
    `);

    const firstRun = await runMigrations({ client: freshClient }).catch((error: unknown) => {
      console.dir(error, { depth: null });
      throw error;
    });
    assert.equal(firstRun.pending.length, 0);

    const migratedValues = await freshClient.query<{
      payment_method: string;
      payment_status: string;
      payment_amount: string;
      payment_gateway: string;
      payment_created_type: string;
      payment_created_utc: string;
      orphan_order_id: string | null;
      orphan_customer_id: string;
      orphan_status: string;
    }>(`
      SELECT o.payment_method, o.payment_status,
             p.amount::text AS payment_amount, p.gateway AS payment_gateway,
             pg_typeof(p.created_at)::text AS payment_created_type,
             to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS payment_created_utc,
             orphan.order_id AS orphan_order_id, orphan.customer_id AS orphan_customer_id,
             orphan.status AS orphan_status
      FROM public.orders o
      CROSS JOIN public.payments p
      JOIN public.payments orphan ON orphan.id = 'PAY-ORPHAN-TEST'
      WHERE o.id = 'ORDER-MIGRATION-TEST' AND p.id = 'PAY-ORPHAN-TEST'
    `);
    assert.deepEqual(migratedValues.rows[0], {
      payment_method: 'unknown',
      payment_status: 'pending',
      payment_amount: '3000.00',
      payment_gateway: 'sslcommerz',
      payment_created_type: 'timestamp with time zone',
      payment_created_utc: '2024-01-01 12:00:00',
      orphan_order_id: null,
      orphan_customer_id: 'MISSING-CUSTOMER-TEST',
      orphan_status: 'VALIDATED',
    });

    const restoredObjects = await freshClient.query<{
      view_count: string;
      profile_function_count: string;
      review_check_validated: boolean;
      public_view_select: boolean;
      public_column_select: boolean;
      public_function_execute: boolean;
      payment_customer_fk_validated: boolean;
      payment_order_check_validated: boolean;
    }>(`
      SELECT
        (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'v') AS view_count,
        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.prorettype = 'public.customer_profiles'::regclass) AS profile_function_count,
        (SELECT convalidated FROM pg_constraint
         WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_rating_check')
          AS review_check_validated,
        EXISTS (
          SELECT 1 FROM pg_class c
          CROSS JOIN LATERAL aclexplode(c.relacl) acl
          WHERE c.oid = 'public.customer_profiles'::regclass
            AND acl.grantee = 0 AND acl.privilege_type = 'SELECT'
        ) AS public_view_select,
        EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'username'
          CROSS JOIN LATERAL aclexplode(a.attacl) acl
          WHERE c.oid = 'public.seller_profiles'::regclass
            AND acl.grantee = 0 AND acl.privilege_type = 'SELECT'
        ) AS public_column_select,
        EXISTS (
          SELECT 1 FROM pg_proc p
          CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
          WHERE p.oid = 'public.shopniro_customer_get(character varying)'::regprocedure
            AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
        ) AS public_function_execute,
        (SELECT convalidated FROM pg_constraint
         WHERE conrelid = 'public.payments'::regclass AND conname = 'fk_payments_customer')
          AS payment_customer_fk_validated,
        (SELECT convalidated FROM pg_constraint
         WHERE conrelid = 'public.payments'::regclass AND conname = 'chk_payments_order_required')
          AS payment_order_check_validated
    `);
    assert.equal(Number(restoredObjects.rows[0]?.view_count), 7);
    assert.ok(Number(restoredObjects.rows[0]?.profile_function_count) > 0);
    assert.equal(restoredObjects.rows[0]?.review_check_validated, true);
    assert.equal(restoredObjects.rows[0]?.public_view_select, true);
    assert.equal(restoredObjects.rows[0]?.public_column_select, true);
    assert.equal(restoredObjects.rows[0]?.public_function_execute, false);
    assert.equal(restoredObjects.rows[0]?.payment_customer_fk_validated, false);
    assert.equal(restoredObjects.rows[0]?.payment_order_check_validated, false);

    const referenceClient = await createScratchDatabase(scratchDatabaseNames[2]);
    await runMigrations({ client: referenceClient });
    const schemaComparison = compareFingerprints(
      await readFingerprint(freshClient),
      await readFingerprint(referenceClient)
    );
    assert.deepEqual(schemaComparison.missing, []);
    assert.deepEqual(schemaComparison.extra, []);
    assert.deepEqual(
      schemaComparison.different.map((difference) => difference.key),
      [
        'constraint payments.chk_payments_order_required',
        'constraint payments.fk_payments_customer',
      ]
    );

    const reconciledConstraints = await freshClient.query<{ conname: string; convalidated: boolean }>(`
      SELECT conname, convalidated
      FROM pg_constraint
      WHERE conname = ANY($1::text[])
      ORDER BY conname
    `, [[
      'cart_customer_id_fkey',
      'cart_product_id_fkey',
      'orders_customer_id_fkey',
      'products_category_id_fkey',
      'products_seller_id_fkey',
      'reviews_customer_id_fkey',
      'reviews_product_id_fkey',
      'reviews_rating_check',
      'users_username_key',
    ]]);
    assert.equal(reconciledConstraints.rows.length, 9);
    assert.ok(reconciledConstraints.rows.every((constraint) => constraint.convalidated));

    const schemaCounts = await freshClient.query<{
      table_count: string;
      shopniro_function_count: string;
    }>(`
      SELECT
        (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
           AND table_name <> 'schema_migrations') AS table_count,
        (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND left(p.proname, 9) = 'shopniro_') AS shopniro_function_count
    `);
    assert.equal(Number(schemaCounts.rows[0]?.table_count), 34);
    assert.equal(Number(schemaCounts.rows[0]?.shopniro_function_count), 54);

    const recordedBeforeRerun = await freshClient.query<{ applied_at: string }>(
      'SELECT applied_at::text FROM public.schema_migrations WHERE version = $1',
      ['0001']
    );
    const secondRun = await runMigrations({ client: freshClient });
    assert.equal(secondRun.pending.length, 0);
    const recordedAfterRerun = await freshClient.query<{ applied_at: string }>(
      'SELECT applied_at::text FROM public.schema_migrations WHERE version = $1',
      ['0001']
    );
    assert.equal(recordedAfterRerun.rows[0]?.applied_at, recordedBeforeRerun.rows[0]?.applied_at);

    await cp(path.join(migrationDirectory, '0001_baseline.sql'), path.join(tempMigrations, '0001_baseline.sql'));
    await appendFile(path.join(tempMigrations, '0001_baseline.sql'), '\n-- changed after apply\n');
    await assert.rejects(
      runMigrations({ client: freshClient, mode: 'status', directory: tempMigrations }),
      /Checksum mismatch for applied migration 0001/
    );

    const baselineClient = await createScratchDatabase(scratchDatabaseNames[1]);
    const baselineRun = await runMigrations({
      client: baselineClient,
      mode: 'baseline',
      baselineVersion: '0001',
    });
    assert.deepEqual(baselineRun.applied, ['0001_baseline']);
    const baselineObjects = await baselineClient.query<{ users: string | null }>(
      "SELECT to_regclass('public.users') AS users"
    );
    assert.equal(baselineObjects.rows[0]?.users, null);
  } finally {
    for (const client of connectedClients) await client.end();
    if (adminConnected) {
      for (const name of scratchDatabaseNames) {
        await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
      }
      await admin.end();
    }
    await rm(tempMigrations, { recursive: true, force: true });
    await rm(baselineMigrations, { recursive: true, force: true });
    await rm(reconciledMigrations, { recursive: true, force: true });
  }
});
