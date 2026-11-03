import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { request as httpRequest, type Server } from 'node:http';
import { after, test, type TestContext } from 'node:test';
import { pool, query } from '../server/db/index.ts';
import { GatewayError, type SSLCommerzRefundResult, type SSLCommerzTransactionQueryResult } from '../server/services/sslcommerz.service.ts';
import { runPaymentReconciliation, type ReconciliationGateway } from '../server/services/paymentReconciliation.service.ts';
import { finalizeSslCommerzPayment } from '../server/routes/payment.routes.ts';

if (process.env.CI && !process.env.DATABASE_URL) throw new Error('DATABASE_URL required in CI');

const dbTest = (name: string, fn: (context: TestContext) => void | Promise<void>) =>
  process.env.DATABASE_URL
    ? test(name, { timeout: 30_000 }, fn)
    : test.skip(name, fn);

type OrderFixture = {
  userId: string;
  customerId: string;
  orderId: string;
  paymentIds: string[];
  refundIds: string[];
};

const createOrder = async (
  options: { paymentStatus?: string; orderStatus?: string; method?: string; subtotal?: number; shippingFee?: number } = {}
): Promise<OrderFixture> => {
  const suffix = randomUUID().replaceAll('-', '').toUpperCase();
  const customerId = `RCC-${suffix}`;
  const fixture = {
    userId: customerId,
    customerId,
    orderId: `RCO-${suffix}`,
    paymentIds: [] as string[],
    refundIds: [] as string[],
  };
  await query(
    `INSERT INTO users (id, username, password, email, role)
     VALUES ($1, $2, $3, $4, 'customer')`,
    [fixture.userId, fixture.userId, '!reconciliation-test', `${fixture.userId}@example.invalid`]
  );
  await query('INSERT INTO customers (id, name) VALUES ($1, $2)', [fixture.customerId, 'Reconciliation Test']);
  await query(`
    INSERT INTO orders (
      id, tracking_id, customer_id, subtotal, shipping_fee, status,
      shipping_address_json, billing_address_json, payment_status, payment_method, transaction_id
    ) VALUES ($1, $2, $3, $4, $5, $6, '{}', '{}', $7, $8, '')
  `, [
    fixture.orderId,
    `RCT-${suffix}`,
    fixture.customerId,
    options.subtotal ?? 100,
    options.shippingFee ?? 0,
    options.orderStatus ?? 'placed',
    options.paymentStatus ?? 'pending',
    options.method ?? 'bkash',
  ]);
  return fixture;
};

const createPayment = async (
  fixture: OrderFixture,
  options: { orderId?: string | null; amount?: number; status?: string; currency?: string } = {}
) => {
  const id = `RCP-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const transactionId = `RCT-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  await query(`
    INSERT INTO payments (
      id, order_id, customer_id, amount, currency, gateway, payment_method,
      transaction_id, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, 'sslcommerz', 'bkash', $6, $7,
      current_timestamp - INTERVAL '2 hours')
  `, [
    id,
    options.orderId === undefined ? fixture.orderId : options.orderId,
    fixture.customerId,
    options.amount ?? 100,
    options.currency ?? 'BDT',
    transactionId,
    options.status ?? 'PENDING',
  ]);
  fixture.paymentIds.push(id);
  return { id, transactionId, amount: options.amount ?? 100 };
};

const createUncheckedPayment = async (
  fixture: OrderFixture,
  orderId: string | null,
  constraints: ('fk_payments_order' | 'chk_payments_order_required')[]
) => {
  const id = `RCP-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const transactionId = `RCT-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const constraint of constraints) {
      await client.query(`ALTER TABLE payments DROP CONSTRAINT ${constraint}`);
    }
    await client.query(`
      INSERT INTO payments (
        id, order_id, customer_id, amount, currency, gateway, payment_method,
        transaction_id, status, created_at
      ) VALUES ($1, $2, $3, 100, 'BDT', 'sslcommerz', 'bkash', $4, 'VALIDATED',
        current_timestamp - INTERVAL '2 hours')
    `, [id, orderId, fixture.customerId, transactionId]);
    for (const constraint of constraints) {
      if (constraint === 'fk_payments_order') {
        await client.query(`
          ALTER TABLE payments ADD CONSTRAINT fk_payments_order
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT NOT VALID
        `);
      } else {
        await client.query(`
          ALTER TABLE payments ADD CONSTRAINT chk_payments_order_required
          CHECK (order_id IS NOT NULL) NOT VALID
        `);
      }
    }
    await client.query('COMMIT');
    fixture.paymentIds.push(id);
    return { id, transactionId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const createRefund = async (
  fixture: OrderFixture,
  paymentId: string | null,
  options: { status: string; gatewayRef?: string | null; amount?: number; stale?: boolean }
) => {
  const id = `RCR-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  await query(`
    INSERT INTO refunds (id, order_id, payment_id, amount, method, status, gateway_ref, created_at)
    VALUES ($1, $2, $3, $4, 'sslcommerz', $5, $6,
      CASE WHEN $7 THEN current_timestamp - INTERVAL '25 hours' ELSE current_timestamp END)
  `, [id, fixture.orderId, paymentId, options.amount ?? 100, options.status, options.gatewayRef ?? null, options.stale ?? false]);
  fixture.refundIds.push(id);
  return id;
};

const cleanup = async (
  fixture: OrderFixture,
  restoreConstraints: ('fk_payments_order' | 'chk_payments_order_required')[] = []
) => {
  await query(`
    DELETE FROM payment_reconciliation_findings
    WHERE order_id = $1
      OR payment_id = ANY($2::varchar[])
      OR refund_id = ANY($3::varchar[])
  `, [fixture.orderId, fixture.paymentIds, fixture.refundIds]);
  await query('DELETE FROM refunds WHERE order_id = $1 OR id = ANY($2::varchar[])', [fixture.orderId, fixture.refundIds]);
  await query('DELETE FROM payments WHERE id = ANY($1::varchar[])', [fixture.paymentIds]);
  for (const constraint of restoreConstraints) {
    await query(`ALTER TABLE payments VALIDATE CONSTRAINT ${constraint}`);
  }
  await query('DELETE FROM orders WHERE id = $1', [fixture.orderId]);
  await query('DELETE FROM customers WHERE id = $1', [fixture.customerId]);
  await query('DELETE FROM users WHERE id = $1', [fixture.userId]);
};

class FakeGateway implements ReconciliationGateway {
  readonly transactions = new Map<string, SSLCommerzTransactionQueryResult>();
  readonly refunds = new Map<string, SSLCommerzRefundResult>();
  readonly failedTransactions = new Set<string>();
  readonly failedRefunds = new Set<string>();
  readonly refundQueries: string[] = [];
  readonly transactionQueries: string[] = [];
  readonly transactionQueryTimes: number[] = [];

  async queryTransactionByTranId(tranId: string): Promise<SSLCommerzTransactionQueryResult> {
    this.transactionQueries.push(tranId);
    this.transactionQueryTimes.push(Date.now());
    if (this.failedTransactions.has(tranId)) throw new GatewayError('simulated gateway outage');
    return this.transactions.get(tranId) ?? {
      status: 'NOT_FOUND',
      tran_id: tranId,
      val_id: null,
      amount: null,
      currency: null,
      bank_tran_id: null,
    };
  }

  async getRefundStatus(refundRefId: string): Promise<SSLCommerzRefundResult> {
    this.refundQueries.push(refundRefId);
    if (this.failedRefunds.has(refundRefId)) throw new GatewayError('simulated refund outage');
    return this.refunds.get(refundRefId) ?? { APIConnect: 'DONE', status: 'pending', refund_ref_id: refundRefId };
  }

  setTransaction(
    transactionId: string,
    values: Partial<SSLCommerzTransactionQueryResult> = {}
  ) {
    this.transactions.set(transactionId, {
      status: 'VALID',
      tran_id: transactionId,
      val_id: `VAL-${transactionId}`,
      amount: '100.00',
      currency: 'BDT',
      bank_tran_id: `BANK-${transactionId}`,
      ...values,
    });
  }
}

const finalizer = (tranId: string, valId: string) => finalizeSslCommerzPayment(
  tranId,
  valId,
  {
    validatePayment: async (validationId, transactionId, amount) => ({
      ok: validationId === `VAL-${transactionId}`,
      raw: {
        status: 'VALID',
        tran_id: transactionId,
        val_id: validationId,
        amount,
        currency: 'BDT',
      },
    }),
  },
  async () => undefined
);

const run = (gateway: FakeGateway, autoRepair = false) => runPaymentReconciliation({
  gateway,
  autoRepair,
  finalizePayment: finalizer,
  sleep: async () => undefined,
});

const findingsFor = async (
  runId: string,
  identity: { orderId?: string; paymentIds?: string[]; refundIds?: string[] }
) => {
  const result = await query<{
    kind: string;
    severity: string;
    detail: Record<string, unknown>;
    order_id: string | null;
    payment_id: string | null;
    refund_id: string | null;
  }>(`
    SELECT kind, severity, detail, order_id, payment_id, refund_id
    FROM payment_reconciliation_findings
    WHERE run_id = $1
      AND ($2::varchar IS NULL OR order_id = $2)
      AND (cardinality($3::varchar[]) = 0 OR payment_id = ANY($3::varchar[]))
      AND (cardinality($4::varchar[]) = 0 OR refund_id = ANY($4::varchar[]))
    ORDER BY kind
  `, [
    runId,
    identity.orderId ?? null,
    identity.paymentIds ?? [],
    identity.refundIds ?? [],
  ]);
  return result.rows;
};

const assertFinding = async (
  runId: string,
  kind: string,
  severity: string,
  identity: { orderId?: string; paymentIds?: string[]; refundIds?: string[] }
) => {
  const rows = await findingsFor(runId, identity);
  assert.ok(rows.some((finding) => finding.kind === kind && finding.severity === severity), JSON.stringify(rows));
};

dbTest('reports a paid online order with no validated payment as high severity', async () => {
  const fixture = await createOrder({ paymentStatus: 'paid' });
  try {
    const summary = await run(new FakeGateway());
    await assertFinding(summary.runId, 'paid_online_order_without_validated_payment', 'high', { orderId: fixture.orderId });
  } finally {
    await cleanup(fixture);
  }
});

dbTest('reports multiple validated payments for one paid online order', async () => {
  const fixture = await createOrder({ paymentStatus: 'paid' });
  const first = await createPayment(fixture, { status: 'VALIDATED' });
  const second = await createPayment(fixture, { status: 'VALIDATED' });
  const gateway = new FakeGateway();
  gateway.setTransaction(first.transactionId);
  gateway.setTransaction(second.transactionId);
  try {
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'paid_online_order_multiple_validated_payments', 'high', { orderId: fixture.orderId });
  } finally {
    await cleanup(fixture);
  }
});

dbTest('reports a validated payment amount that differs from the order total', async () => {
  const fixture = await createOrder({ paymentStatus: 'paid' });
  const payment = await createPayment(fixture, { status: 'VALIDATED', amount: 99 });
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId, { amount: '99.00' });
  try {
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'paid_online_order_amount_mismatch', 'high', { orderId: fixture.orderId, paymentIds: [payment.id] });
  } finally {
    await cleanup(fixture);
  }
});

dbTest('reports a validated payment whose order is not paid', async () => {
  const fixture = await createOrder({ paymentStatus: 'pending' });
  const payment = await createPayment(fixture, { status: 'VALIDATED' });
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'validated_payment_order_not_paid', 'high', { orderId: fixture.orderId, paymentIds: [payment.id] });
  } finally {
    await cleanup(fixture);
  }
});

dbTest('reports a validated payment without an order id as medium severity', async () => {
  const fixture = await createOrder();
  const payment = await createUncheckedPayment(fixture, null, ['chk_payments_order_required']);
  try {
    const gateway = new FakeGateway();
    gateway.setTransaction(payment.transactionId);
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'validated_payment_without_order_id', 'medium', { paymentIds: [payment.id] });
  } finally {
    await cleanup(fixture, ['chk_payments_order_required']);
  }
});

dbTest('reports a validated payment whose referenced order is missing', async () => {
  const fixture = await createOrder();
  const missingOrderId = `MISSING-${randomUUID().replaceAll('-', '').toUpperCase()}`;
  const payment = await createUncheckedPayment(fixture, missingOrderId, ['fk_payments_order']);
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'validated_payment_order_missing', 'high', { paymentIds: [payment.id] });
  } finally {
    await cleanup(fixture, ['fk_payments_order']);
  }
});

dbTest('repairs a late gateway payment through the existing finalizer', async () => {
  const fixture = await createOrder();
  const payment = await createPayment(fixture, { status: 'EXPIRED' });
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const summary = await run(gateway, true);
    assert.equal(summary.repaired, 1);
    const rows = await query<{ payment_status: string; transaction_id: string }>(
      'SELECT payment_status, transaction_id FROM orders WHERE id = $1',
      [fixture.orderId]
    );
    assert.equal(rows.rows[0]?.payment_status, 'paid');
    assert.equal(rows.rows[0]?.transaction_id, payment.transactionId);
    const paymentRow = await query<{ status: string }>('SELECT status FROM payments WHERE id = $1', [payment.id]);
    assert.equal(paymentRow.rows[0]?.status, 'VALIDATED');
  } finally {
    await cleanup(fixture);
  }
});

dbTest('queues exactly one refund for a late gateway payment on a cancelled order', async () => {
  const fixture = await createOrder({ orderStatus: 'cancelled' });
  const payment = await createPayment(fixture, { status: 'EXPIRED' });
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const summary = await run(gateway, true);
    assert.equal(summary.repaired, 1);
    const paymentRow = await query<{ status: string }>('SELECT status FROM payments WHERE id = $1', [payment.id]);
    assert.equal(paymentRow.rows[0]?.status, 'VALIDATED');
    const refundRows = await query<{ count: string }>(
      'SELECT count(*)::text AS count FROM refunds WHERE payment_id = $1',
      [payment.id]
    );
    assert.equal(Number(refundRows.rows[0]?.count), 1);
  } finally {
    await cleanup(fixture);
  }
});

dbTest('report-only is the default and does not change payment or order rows', async () => {
  const previous = process.env.RECONCILE_AUTO_REPAIR;
  delete process.env.RECONCILE_AUTO_REPAIR;
  const fixture = await createOrder();
  const payment = await createPayment(fixture, { status: 'PENDING' });
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const summary = await runPaymentReconciliation({
      gateway,
      finalizePayment: finalizer,
      sleep: async () => undefined,
    });
    await assertFinding(summary.runId, 'paid_at_gateway_not_here', 'high', { orderId: fixture.orderId, paymentIds: [payment.id] });
    const rows = await query<{ status: string; payment_status: string }>(`
      SELECT payment.status, order_record.payment_status
      FROM payments payment JOIN orders order_record ON order_record.id = payment.order_id
      WHERE payment.id = $1
    `, [payment.id]);
    assert.deepEqual(rows.rows[0], { status: 'PENDING', payment_status: 'pending' });
  } finally {
    if (previous === undefined) delete process.env.RECONCILE_AUTO_REPAIR;
    else process.env.RECONCILE_AUTO_REPAIR = previous;
    await cleanup(fixture);
  }
});

dbTest('reports gateway failure, cancellation, and missing validated payments without mutation', async (context) => {
  for (const status of ['FAILED', 'CANCELLED', 'NOT_FOUND']) {
    await context.test(`gateway status ${status}`, async () => {
      const fixture = await createOrder({ paymentStatus: 'paid' });
      const payment = await createPayment(fixture, { status: 'VALIDATED' });
      const gateway = new FakeGateway();
      if (status === 'NOT_FOUND') {
        gateway.transactions.set(payment.transactionId, {
          status,
          tran_id: payment.transactionId,
          val_id: null,
          amount: null,
          currency: null,
          bank_tran_id: null,
        });
      } else {
        gateway.setTransaction(payment.transactionId, { status });
      }
      try {
        const summary = await run(gateway);
        const kind = status === 'NOT_FOUND'
          ? 'validated_payment_missing_at_gateway'
          : 'validated_payment_gateway_status_mismatch';
        await assertFinding(summary.runId, kind, 'high', { orderId: fixture.orderId, paymentIds: [payment.id] });
        const result = await query<{ status: string; payment_status: string }>(`
          SELECT payment.status, order_record.payment_status
          FROM payments payment JOIN orders order_record ON order_record.id = payment.order_id
          WHERE payment.id = $1
        `, [payment.id]);
        assert.deepEqual(result.rows[0], { status: 'VALIDATED', payment_status: 'paid' });
      } finally {
        await cleanup(fixture);
      }
    });
  }
});

dbTest('reports gateway amount and currency mismatches without repairing', async (context) => {
  for (const mismatch of [{ kind: 'amount' }, { kind: 'currency' }]) {
    await context.test(`${mismatch.kind} mismatch`, async () => {
      const fixture = await createOrder();
      const payment = await createPayment(fixture);
      const gateway = new FakeGateway();
      gateway.setTransaction(payment.transactionId, mismatch.kind === 'amount'
        ? { amount: '101.00' }
        : { currency: 'USD' });
      try {
        const summary = await run(gateway, true);
        await assertFinding(
          summary.runId,
          mismatch.kind === 'amount' ? 'gateway_payment_amount_mismatch' : 'gateway_payment_currency_mismatch',
          'high',
          { orderId: fixture.orderId, paymentIds: [payment.id] }
        );
        const result = await query<{ status: string; payment_status: string }>(`
          SELECT payment.status, order_record.payment_status
          FROM payments payment JOIN orders order_record ON order_record.id = payment.order_id
          WHERE payment.id = $1
        `, [payment.id]);
        assert.deepEqual(result.rows[0], { status: 'PENDING', payment_status: 'pending' });
      } finally {
        await cleanup(fixture);
      }
    });
  }
});

dbTest('counts an abandoned pending checkout without opening a finding', async () => {
  const fixture = await createOrder();
  await createPayment(fixture);
  try {
    const summary = await run(new FakeGateway());
    assert.deepEqual(await findingsFor(summary.runId, { orderId: fixture.orderId }), []);
  } finally {
    await cleanup(fixture);
  }
});

dbTest('marks a gateway outage partial and continues checking other payments', async () => {
  const fixture = await createOrder();
  const failed = await createPayment(fixture);
  const matched = await createPayment(fixture);
  const gateway = new FakeGateway();
  gateway.failedTransactions.add(failed.transactionId);
  gateway.setTransaction(matched.transactionId, { status: 'PENDING' });
  try {
    const summary = await run(gateway);
    assert.equal(summary.status, 'partial');
    assert.ok(summary.checked >= 2);
  } finally {
    await cleanup(fixture);
  }
});

dbTest('reports and queries refunds stuck for more than 24 hours', async () => {
  const fixture = await createOrder();
  await createRefund(fixture, null, { status: 'initiating', gatewayRef: 'REF-INITIATING', stale: true });
  await createRefund(fixture, null, { status: 'submitted', gatewayRef: 'REF-SUBMITTED', stale: true });
  const gateway = new FakeGateway();
  gateway.refunds.set('REF-INITIATING', { APIConnect: 'DONE', status: 'refunded', refund_ref_id: 'REF-INITIATING' });
  gateway.refunds.set('REF-SUBMITTED', { APIConnect: 'DONE', status: 'refunded', refund_ref_id: 'REF-SUBMITTED' });
  try {
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'refund_stuck', 'medium', { orderId: fixture.orderId, refundIds: fixture.refundIds });
    assert.equal(summary.status, 'ok');
    assert.equal((await findingsFor(summary.runId, { orderId: fixture.orderId, refundIds: fixture.refundIds })).filter((finding) => finding.kind === 'refund_stuck').length, 2);
    assert.ok(gateway.refundQueries.includes('REF-INITIATING'));
    assert.ok(gateway.refundQueries.includes('REF-SUBMITTED'));
  } finally {
    await cleanup(fixture);
  }
});

dbTest('reports completed refunds not shown as refunded by the gateway', async () => {
  const fixture = await createOrder();
  await createRefund(fixture, null, { status: 'completed', gatewayRef: 'REF-COMPLETED' });
  const gateway = new FakeGateway();
  gateway.refunds.set('REF-COMPLETED', { APIConnect: 'DONE', status: 'processing', refund_ref_id: 'REF-COMPLETED' });
  try {
    const summary = await run(gateway);
    await assertFinding(summary.runId, 'completed_refund_missing_at_gateway', 'high', { orderId: fixture.orderId, refundIds: fixture.refundIds });
    assert.ok(gateway.refundQueries.includes('REF-COMPLETED'));
  } finally {
    await cleanup(fixture);
  }
});

dbTest('updates an open finding on rerun instead of duplicating it', async () => {
  const fixture = await createOrder();
  const payment = await createPayment(fixture);
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const first = await run(gateway);
    const second = await run(gateway);
    assert.ok(first.findingsOpened >= 1);
    assert.equal(second.findingsOpened, 0);
    const count = await query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM payment_reconciliation_findings
      WHERE status = 'open' AND kind = 'paid_at_gateway_not_here' AND payment_id = $1
    `, [payment.id]);
    assert.equal(Number(count.rows[0]?.count), 1);
  } finally {
    await cleanup(fixture);
  }
});

dbTest('queries payments oldest-first and spaces gateway calls to at most five per second', async () => {
  const fixture = await createOrder();
  const older = await createPayment(fixture);
  const newer = await createPayment(fixture);
  await query(
    "UPDATE payments SET created_at = current_timestamp - INTERVAL '3 hours' WHERE id = $1",
    [older.id]
  );
  const gateway = new FakeGateway();
  gateway.setTransaction(older.transactionId, { status: 'PENDING' });
  gateway.setTransaction(newer.transactionId, { status: 'PENDING' });
  try {
    await runPaymentReconciliation({ gateway });
    const olderIndex = gateway.transactionQueries.indexOf(older.transactionId);
    const newerIndex = gateway.transactionQueries.indexOf(newer.transactionId);
    assert.ok(olderIndex >= 0 && newerIndex > olderIndex);
    assert.ok(gateway.transactionQueryTimes[newerIndex] - gateway.transactionQueryTimes[olderIndex] >= 190);
  } finally {
    await cleanup(fixture);
  }
});

dbTest('keeps an acknowledged finding acknowledged on later runs', async () => {
  const fixture = await createOrder();
  const payment = await createPayment(fixture);
  const gateway = new FakeGateway();
  gateway.setTransaction(payment.transactionId);
  try {
    const first = await run(gateway);
    await query(`
      UPDATE payment_reconciliation_findings
      SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = current_timestamp
      WHERE run_id = $1 AND kind = 'paid_at_gateway_not_here'
    `, [first.runId, fixture.userId]);
    const second = await run(gateway);
    const result = await query<{ status: string; last_seen_at: Date }>(`
      SELECT status, last_seen_at
      FROM payment_reconciliation_findings
      WHERE kind = 'paid_at_gateway_not_here' AND payment_id = $1
      ORDER BY first_seen_at DESC
      LIMIT 1
    `, [payment.id]);
    assert.equal(second.findingsOpened, 0);
    assert.equal(result.rows[0]?.status, 'acknowledged');
  } finally {
    await cleanup(fixture);
  }
});

const listen = (app: express.Express): Promise<Server> =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

dbTest('rejects overlapping reconciliation runs with HTTP 409', async () => {
  const previousSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-reconciliation-cron-secret';
  const { default: cronRoutes } = await import('../server/routes/cron.routes.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/cron', cronRoutes);
  const server = await listen(app);
  const lockClient = await pool.connect();
  try {
    await lockClient.query('SELECT pg_advisory_lock(1572902391, 901)');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const request = httpRequest({
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/cron/reconcile-payments',
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
          'content-type': 'application/json',
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
      });
      request.on('error', reject);
      request.end('{}');
    });
    assert.equal(response.status, 409);
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(1572902391, 901)').catch(() => undefined);
    lockClient.release();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

after(async () => {
  await pool.end();
});
