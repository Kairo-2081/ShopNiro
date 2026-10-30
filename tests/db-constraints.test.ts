import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import { pool } from '../server/db/index.ts';

if (process.env.CI && !process.env.DATABASE_URL) throw new Error('DATABASE_URL required in CI');
const dbTest = (name: string, fn: (context: TestContext) => void | Promise<void>) =>
  process.env.DATABASE_URL ? test(name, { timeout: 30_000 }, fn) : test.skip(name, fn);

/** Runs `work` inside a transaction that is always rolled back, so nothing is left behind. */
const sandbox = async (work: (client: import('pg').PoolClient, ids: { customer: string; order: string }) => Promise<void>) => {
  const client = await pool.connect();
  const customer = `CUST-${randomUUID()}`;
  const order = `ORD-${randomUUID()}`;
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $1, '!x', $2, 'customer')`, [customer, `${customer}@example.invalid`]);
    await client.query('INSERT INTO customers (id, name) VALUES ($1, $2)', [customer, 'Constraint Test']);
    await client.query(
      `INSERT INTO orders (id, tracking_id, customer_id, subtotal, shipping_fee, shipping_address_json, billing_address_json)
       VALUES ($1, $2, $3, 100, 5, '{}', '{}')`,
      [order, `TRK-${randomUUID()}`, customer]
    );
    await work(client, { customer, order });
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
};

const insertPayment = (client: import('pg').PoolClient, fields: { order: string | null; customer: string | null; amount?: number; status?: string }) =>
  client.query(
    `INSERT INTO payments (id, order_id, customer_id, amount, payment_method, transaction_id, status)
     VALUES ($1, $2, $3, $4, 'bkash', $5, $6)`,
    [`PAY-${randomUUID()}`, fields.order, fields.customer, fields.amount ?? 100, `SSLCZ-${randomUUID()}`, fields.status ?? 'PENDING']
  );

/** Each attempt runs in a savepoint so one rejected insert does not abort the next assertion. */
const rejects = async (client: import('pg').PoolClient, code: string, attempt: () => Promise<unknown>) => {
  await client.query('SAVEPOINT attempt');
  try {
    await attempt();
  } catch (error: any) {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
    assert.equal(error.code, code, `expected SQLSTATE ${code}, got ${error.code}: ${error.message}`);
    return;
  }
  assert.fail(`expected the database to reject this write with ${code}`);
};

dbTest('payments must point at a real order and a real customer', async () => {
  await sandbox(async (client, { customer, order }) => {
    await insertPayment(client, { order, customer });
    await rejects(client, '23503', () => insertPayment(client, { order: 'ORD-does-not-exist', customer }));
    await rejects(client, '23503', () => insertPayment(client, { order, customer: 'CUST-does-not-exist' }));
    await rejects(client, '23514', () => insertPayment(client, { order: null, customer }));
  });
});

dbTest('payments reject unknown statuses and non-positive amounts', async () => {
  await sandbox(async (client, { customer, order }) => {
    for (const status of ['PENDING', 'VALIDATED', 'EXPIRED', 'REFUNDED']) {
      await insertPayment(client, { order, customer, status });
    }
    await rejects(client, '23514', () => insertPayment(client, { order, customer, status: 'PAID' }));
    await rejects(client, '23514', () => insertPayment(client, { order, customer, status: 'validated' }));
    await rejects(client, '23514', () => insertPayment(client, { order, customer, amount: 0 }));
    await rejects(client, '23514', () => insertPayment(client, { order, customer, amount: -50 }));
  });
});

dbTest('a paid order cannot be deleted while a payment still references it', async () => {
  await sandbox(async (client, { customer, order }) => {
    await insertPayment(client, { order, customer, status: 'VALIDATED' });
    await rejects(client, '23503', () => client.query('DELETE FROM orders WHERE id = $1', [order]));
    // The failed-payment revert flow deletes payments first, then the order. That order must still work.
    await client.query('DELETE FROM payments WHERE order_id = $1', [order]);
    await client.query('DELETE FROM orders WHERE id = $1', [order]);
  });
});

dbTest('orders only accept known payment statuses', async () => {
  await sandbox(async (client, { order }) => {
    for (const status of ['pending', 'paid', 'refunded', 'expired']) {
      await client.query('UPDATE orders SET payment_status = $2 WHERE id = $1', [order, status]);
    }
    await rejects(client, '23514', () => client.query(`UPDATE orders SET payment_status = 'complete' WHERE id = $1`, [order]));
    await rejects(client, '23514', () => client.query(`UPDATE orders SET status = 'teleported' WHERE id = $1`, [order]));
    await rejects(client, '23514', () => client.query('UPDATE orders SET subtotal = -1 WHERE id = $1', [order]));
  });
});

dbTest('a duplicate validated payment for one order is still recordable (refund flow depends on it)', async () => {
  await sandbox(async (client, { customer, order }) => {
    await insertPayment(client, { order, customer, status: 'VALIDATED' });
    await insertPayment(client, { order, customer, status: 'VALIDATED' });
  });
});

test.after(async () => {
  await pool.end().catch(() => {});
});
