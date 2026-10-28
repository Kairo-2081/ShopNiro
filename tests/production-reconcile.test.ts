import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { runMigrations } from '../scripts/migrate.ts';
import { compareFingerprints, readFingerprint } from '../scripts/schema-drift.ts';
import { withScratchDatabases } from './helpers/scratchDatabase.ts';

const skip = !process.env.DATABASE_URL;

/**
 * Production was built before schema.sql had strict column types, NOT NULLs and most foreign keys, and
 * CREATE TABLE IF NOT EXISTS never upgraded it. tests/fixtures/production-shape.sql rewrites a database
 * built from 0001 into that shape, including the historical rows that exist in production (orders with no
 * payment method, a subtotal with floating point noise, a validated payment with no order, and the
 * UPDATE OF trigger that blocks column type changes). This is the rehearsal for adopting production.
 */
test('adopting a production-shaped database and applying every migration converges on the reference schema', {
  skip,
  timeout: 180_000,
}, async () => {
  const baseline = await readFile(path.resolve(process.cwd(), 'db/migrations/0001_baseline.sql'), 'utf8');
  const fixture = await readFile(path.resolve(process.cwd(), 'tests/fixtures/production-shape.sql'), 'utf8');
  const role = `shopniro_privilege_test_${randomUUID().replaceAll('-', '')}`;

  await withScratchDatabases(2, async ([reference, legacy]) => {
    await runMigrations({ client: reference });
    await legacy.query(baseline);
    await legacy.query(fixture);

    const before = compareFingerprints(await readFingerprint(legacy), await readFingerprint(reference));
    assert.ok(before.missing.includes('constraint cart.cart_customer_id_fkey'), 'the fixture really is drifted');
    assert.ok(before.different.some((entry) => entry.key === 'column users.id'));

    // Privileges that must survive the views and functions being dropped and recreated.
    await legacy.query(`CREATE ROLE "${role}" NOLOGIN`);
    try {
      await legacy.query(`
        REVOKE ALL ON admin_profiles FROM PUBLIC;
        GRANT SELECT ON admin_profiles TO "${role}";
        REVOKE ALL ON FUNCTION shopniro_admins_list() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION shopniro_admins_list() TO "${role}";
        REVOKE ALL ON FUNCTION shopniro_customers_list() FROM PUBLIC;
      `);
      const privilegeQuery = `
        SELECT 'view' AS kind, relacl::text AS acl FROM pg_class WHERE oid = 'public.admin_profiles'::regclass
        UNION ALL
        SELECT 'list', proacl::text FROM pg_proc WHERE oid = 'public.shopniro_admins_list()'::regprocedure
        UNION ALL
        SELECT 'customers', proacl::text FROM pg_proc WHERE oid = 'public.shopniro_customers_list()'::regprocedure
        ORDER BY 1`;
      const privilegesBefore = (await legacy.query(privilegeQuery)).rows;

      await runMigrations({ client: legacy, mode: 'adopt', baselineVersion: '0001' });
      const run = await runMigrations({ client: legacy });
      assert.deepEqual(run.pending, []);
      assert.deepEqual((await runMigrations({ client: legacy, mode: 'status' })).pending, []);
      assert.deepEqual((await legacy.query(privilegeQuery)).rows, privilegesBefore, 'privileges are unchanged');

      const after = compareFingerprints(await readFingerprint(legacy), await readFingerprint(reference));
      assert.deepEqual(after.missing, []);
      // The only differences left are the two payment constraints whose historical row needs a human decision.
      assert.deepEqual(
        after.different.map((entry) => entry.key),
        ['constraint payments.chk_payments_order_required', 'constraint payments.fk_payments_customer']
      );
      assert.deepEqual(after.extra, [
        'column orders.currency',
        'column orders.payment_id',
        'column payments.raw_response_json',
        'column payments.validated_at',
      ]);

      const orders = await legacy.query<{ id: string; payment_method: string; payment_status: string; subtotal: string }>(
        "SELECT id, payment_method, payment_status, subtotal::text FROM orders WHERE id LIKE 'ORD-LEGACY-%' ORDER BY id"
      );
      assert.deepEqual(orders.rows.map((row) => [row.id, row.payment_method, row.payment_status, row.subtotal]), [
        ['ORD-LEGACY-1', 'unknown', 'pending', '598.00'],
        ['ORD-LEGACY-2', 'unknown', 'pending', '68.00'],
        ['ORD-LEGACY-3', 'bkash', 'refunded', '183.59'],
      ]);

      const payment = await legacy.query("SELECT status, amount::text FROM payments WHERE id = 'PAY-LEGACY-1'");
      assert.deepEqual(payment.rows, [{ status: 'VALIDATED', amount: '3000.00' }], 'the unmatched payment is left alone');

      const trigger = await legacy.query(
        "SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgname = 'trigger_prevent_user_role_change'"
      );
      assert.match(trigger.rows[0]?.definition ?? '', /UPDATE OF role/, 'the column-bound trigger is back');

      await assert.rejects(
        legacy.query(
          `INSERT INTO reviews (id, product_id, customer_id, customer_name, rating, review_text)
           VALUES ('r1', 'NO-SUCH-PRODUCT', 'NO-SUCH-CUSTOMER', 'x', 5, 'x')`
        ),
        { code: '23503' },
        'the foreign keys that production lacked are enforced'
      );
    } finally {
      await legacy.query(`DROP OWNED BY "${role}"`);
      await legacy.query(`DROP ROLE IF EXISTS "${role}"`);
    }
  });
});
