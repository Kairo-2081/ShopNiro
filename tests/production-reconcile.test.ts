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

      const checkoutSuffix = randomUUID().replaceAll('-', '');
      const checkoutCustomerId = `CUST-CHECKOUT-${checkoutSuffix}`;
      const checkoutSellerId = `SELLER-CHECKOUT-${checkoutSuffix}`;
      const checkoutCategoryId = `CATEGORY-CHECKOUT-${checkoutSuffix}`;
      const checkoutProductId = `PRODUCT-CHECKOUT-${checkoutSuffix}`;
      const checkoutOrderId = `ORDER-CHECKOUT-${checkoutSuffix}`;
      try {
        await legacy.query(`
          INSERT INTO users (id, username, password, email, role)
          VALUES ($1, $2, 'test-password', $3, 'customer'),
                 ($4, $5, 'test-password', $6, 'seller')
        `, [
          checkoutCustomerId,
          `user-${checkoutCustomerId}`,
          `${checkoutCustomerId}@example.invalid`,
          checkoutSellerId,
          `user-${checkoutSellerId}`,
          `${checkoutSellerId}@example.invalid`,
        ]);
        await legacy.query('INSERT INTO customers (id, name) VALUES ($1, $2)', [
          checkoutCustomerId, 'Checkout test customer',
        ]);
        await legacy.query('INSERT INTO sellers (id, name, status) VALUES ($1, $2, $3)', [
          checkoutSellerId, 'Checkout test seller', 'approved',
        ]);
        await legacy.query('INSERT INTO categories (id, name) VALUES ($1, $1)', [checkoutCategoryId]);
        await legacy.query(`
          INSERT INTO products (id, name, price, stock, category_id, seller_id)
          VALUES ($1, 'Checkout test product', 15.50, 4, $2, $3)
        `, [
          checkoutProductId,
          checkoutCategoryId,
          checkoutSellerId,
        ]);
        await legacy.query(`
          INSERT INTO cart (id, customer_id, product_id, quantity, size)
          VALUES ($1, $2, $3, 2, 'M')
        `, [
          checkoutOrderId,
          checkoutCustomerId,
          checkoutProductId,
        ]);
        await legacy.query(
          `CALL process_checkout($1, $2, $3, $4, $5, $6, $7)`,
          [
            checkoutOrderId,
            `TRACK-${checkoutOrderId}`,
            checkoutCustomerId,
            5,
            '{}',
            '{}',
            '',
          ]
        );

        const checkoutOrder = await legacy.query<{ items_json: string | null }>(
          'SELECT items_json FROM orders WHERE id = $1',
          [checkoutOrderId]
        );
        assert.equal(checkoutOrder.rows[0]?.items_json, '[]', 'checkout leaves the compatibility column at its default');
        const checkoutItems = await legacy.query<{
          product_id_snapshot: string;
          seller_id_snapshot: string;
          product_name: string;
          unit_price: string;
          quantity: number;
          size: string;
        }>(`
          SELECT product_id_snapshot, seller_id_snapshot, product_name, unit_price::text, quantity, size
          FROM order_items WHERE order_id = $1 ORDER BY order_item_id
        `, [checkoutOrderId]);
        assert.deepEqual(checkoutItems.rows, [{
          product_id_snapshot: checkoutProductId,
          seller_id_snapshot: checkoutSellerId,
          product_name: 'Checkout test product',
          unit_price: '15.50',
          quantity: 2,
          size: 'M',
        }]);
        const fulfillmentItems = await legacy.query<{ items_json: unknown }>(
          'SELECT items_json FROM seller_fulfillments WHERE order_id = $1',
          [checkoutOrderId]
        );
        assert.deepEqual(fulfillmentItems.rows, [{ items_json: [] }]);

        const itemColumnReferences = await legacy.query<{ count: string }>(`
          SELECT count(*)::text AS count
          FROM pg_proc p
          WHERE p.pronamespace = 'public'::regnamespace
            AND p.prokind IN ('f', 'p')
            AND pg_get_functiondef(p.oid) ~* '\\.items_json'
        `);
        assert.equal(itemColumnReferences.rows[0]?.count, '0', 'no function reads or writes either items_json column');
        const viewReferences = await legacy.query<{ count: string }>(`
          SELECT count(*)::text AS count FROM pg_views
          WHERE schemaname = 'public'
            AND definition ~* '\\.items_json'
        `);
        assert.equal(viewReferences.rows[0]?.count, '0', 'no view reads either items_json column');
        const triggerReferences = await legacy.query<{ count: string }>(`
          SELECT count(*)::text AS count
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_proc p ON p.oid = t.tgfoid
          WHERE n.nspname = 'public'
            AND NOT t.tgisinternal
            AND pg_get_functiondef(p.oid) ~* '\\.items_json'
        `);
        assert.equal(triggerReferences.rows[0]?.count, '0', 'no trigger function reads either items_json column');
      } finally {
        await legacy.query('DELETE FROM orders WHERE id = $1', [checkoutOrderId]);
        await legacy.query('DELETE FROM products WHERE id = $1', [checkoutProductId]);
        await legacy.query('DELETE FROM categories WHERE id = $1', [checkoutCategoryId]);
        await legacy.query('DELETE FROM sellers WHERE id = $1', [checkoutSellerId]);
        await legacy.query('DELETE FROM customers WHERE id = $1', [checkoutCustomerId]);
        await legacy.query('DELETE FROM users WHERE id = ANY($1::varchar[])', [[checkoutCustomerId, checkoutSellerId]]);
      }

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
