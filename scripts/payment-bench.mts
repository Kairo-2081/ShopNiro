// Benchmark for payment init and the refund queue.
//
//   npm run bench:payments -- <mode>
//
// Modes:
//   load         p95 latency of POST /api/payment/init with N distinct customers checking out at once
//   init         5 identical init requests per order: gateway sessions, payment rows, transaction IDs
//   refund       4 refund workers racing on one refund: gateway refund calls
//   dupvalidate  4 simultaneous confirmations of a duplicate payment: refund rows, net charge
//   starve       old 'submitted' refunds queued ahead of new 'requested' ones: how many new ones get initiated
//
// Environment:
//   DATABASE_URL     required. Must be a disposable local PostgreSQL database initialised with schema.sql.
//   REPO_ROOT        optional. Benchmark another checkout (for example a git worktree of an older commit).
//   TRIALS           trials for init/refund/dupvalidate (default 100)
//   REPS, SIZES      load: repetitions per size (default 5) and checkout counts (default 10,20,40,80)
//   GATEWAY_MS       stubbed SSLCommerz init latency in ms (default 120)
//   BENCH_OUT        optional. Also write the JSON result to this file.
//
// The SSLCommerz gateway is stubbed, so nothing here reaches a real payment provider. The script inserts
// test customers, orders, payments and refunds; never point it at shared or production data.
import { createRequire } from 'node:module';
import { mock } from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { request as httpRequest, type Server } from 'node:http';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-test-test-test-test-test-test-test';
process.env.CRON_SECRET ??= 'test-test-test-test-test-test-test-test';
process.env.SSLCOMMERZ_IPN_TOKEN ??= 'test-payment-integrity-ipn-token';
process.env.SSLCOMMERZ_STORE_ID ??= 'test-store-id';
process.env.SSLCOMMERZ_STORE_PASSWORD ??= 'test-store-password';

const MODES = ['load', 'init', 'refund', 'dupvalidate', 'starve'] as const;
type Mode = (typeof MODES)[number];
const BENCH = (process.argv[2] ?? process.env.BENCH) as Mode;
if (!MODES.includes(BENCH)) {
  console.error(`Usage: npm run bench:payments -- <${MODES.join('|')}>`);
  process.exit(2);
}

// Refuse to run against anything but a local database: this script writes test rows.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (a disposable local PostgreSQL database initialised with schema.sql).');
  process.exit(2);
}
const databaseHost = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseHost) && process.env.BENCH_ALLOW_NON_LOCAL_DB !== '1') {
  console.error(`Refusing to benchmark against non-local database host "${databaseHost}". Set BENCH_ALLOW_NON_LOCAL_DB=1 only for a disposable database.`);
  process.exit(2);
}
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
  console.error('NODE_ENV must be "test" or "development" so the payment simulator defaults apply.');
  process.exit(2);
}

const ROOT = process.env.REPO_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const TRIALS = Number(process.env.TRIALS || 100);
const GATEWAY_MS = Number(process.env.GATEWAY_MS || 120);
const require = createRequire(`${ROOT}/package.json`);
const express = require('express');
const imp = (path: string) => import(pathToFileURL(`${ROOT}/${path}`).href);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const { pool, query } = await imp('server/db/index.ts');
const { generateToken, verifyToken } = await imp('server/middleware/auth.ts');
const { default: ordersRoutes } = await imp('server/routes/orders.routes.ts');
const { default: paymentRoutes, processRefundQueue } = await imp('server/routes/payment.routes.ts');
const { sslcommerz } = await imp('server/services/sslcommerz.service.ts');

const app = express();
app.use(express.json());
app.use('/api/orders', ordersRoutes);
app.use('/api/payment', paymentRoutes);
const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const port = (server.address() as { port: number }).port;

const request = (path: string, body: unknown, cookie: string): Promise<{ status: number; body: any }> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const req = httpRequest({
      hostname: '127.0.0.1', port, path, method: 'POST', agent: false,
      headers: { origin: 'http://localhost', 'content-type': 'application/json', cookie },
    }, (response) => {
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
        resolve({ status: response.statusCode || 0, body: parsed });
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });

const makeUser = (role: string, id: string) => query(
  `INSERT INTO users (id, username, password, email, role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
  [id, id, '!bench-no-login', `${id}@example.invalid`, role]);

const makeSession = async (role: string, id: string) => {
  const token = generateToken({ userId: id, email: `${id}@example.invalid`, username: id, role, entityId: id });
  const decoded = verifyToken(token);
  await makeUser(role, id);
  await query('SELECT shopniro_session_create($1,$2,$3)', [decoded.jti, id, new Date(Date.now() + 3600_000).toISOString()]);
  return `shopniro_session=${encodeURIComponent(token)}`;
};

// A customer with a seller, a product and a cart, plus a placed online order for that cart.
const makeCheckout = async () => {
  const customerId = `CUSTOMER-${randomUUID()}`, sellerId = `SELLER-${randomUUID()}`;
  const categoryId = `CATEGORY-${randomUUID()}`, productId = `PRODUCT-${randomUUID()}`;
  await makeUser('customer', customerId);
  await query('INSERT INTO customers (id, name) VALUES ($1,$2)', [customerId, 'Bench Customer']);
  await makeUser('seller', sellerId);
  await query('INSERT INTO sellers (id, name, status) VALUES ($1,$2,$3)', [sellerId, 'Bench Seller', 'approved']);
  await query('INSERT INTO categories (id, name) VALUES ($1,$2)', [categoryId, `Bench ${categoryId}`]);
  await query(`INSERT INTO products (id,name,image,description,price,stock,product_status,category_id,seller_id)
               VALUES ($1,'Bench Product','','',100,1000,'active',$2,$3)`, [productId, categoryId, sellerId]);
  await query('INSERT INTO cart (id,customer_id,product_id,quantity,size) VALUES ($1,$2,$3,2,$4)', [`CART-${randomUUID()}`, customerId, productId, '']);
  const cookie = await makeSession('customer', customerId);
  const address = { Street: 'Bench street', City: 'Dhaka', Postal_Code: '1200' };
  const placed = await request('/api/orders', {
    Customer_ID: customerId, Items: [{ Product_ID: productId, Quantity: 2 }],
    Shipping_Address: address, Billing_Address: address, paymentMethod: 'online',
  }, cookie);
  if (placed.status !== 201) throw new Error(`order create failed ${placed.status} ${JSON.stringify(placed.body)}`);
  return { customerId, cookie, orderId: placed.body.Order_ID as string };
};

const makeOrderRow = (customerId: string, orderId: string, paymentStatus = 'pending', method = 'cash_on_delivery', transactionId = '') =>
  query(`INSERT INTO orders (id,tracking_id,customer_id,items_json,subtotal,shipping_fee,status,shipping_address_json,billing_address_json,payment_status,payment_method,transaction_id,applied_voucher,order_placed_at)
         VALUES ($1,$2,$3,'[]',100,0,'placed','{}','{}',$4,$5,$6,'',$7)`,
    [orderId, `TRK-${randomUUID().slice(0, 10)}`, customerId, paymentStatus, method, transactionId, new Date().toISOString()]);

const makeValidatedPayment = (paymentId: string, orderId: string, customerId: string) =>
  query(`INSERT INTO payments (id,order_id,customer_id,amount,currency,gateway,payment_method,transaction_id,bank_tran_id,status)
         VALUES ($1,$2,$3,100,'BDT','sslcommerz','bkash',$4,$5,'VALIDATED')`,
    [paymentId, orderId, customerId, `SSLCZ-${randomUUID().replaceAll('-', '').toUpperCase()}`, `BANK-${randomUUID()}`]);

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const summarize = (values: number[]) => ({
  n: values.length,
  min: +Math.min(...values).toFixed(1),
  p50: +percentile(values, 50).toFixed(1),
  p95: +percentile(values, 95).toFixed(1),
  p99: +percentile(values, 99).toFixed(1),
  max: +Math.max(...values).toFixed(1),
  mean: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1),
});
const histogram = (values: number[]) => values.reduce((counts: Record<string, number>, v) => { counts[v] = (counts[v] || 0) + 1; return counts; }, {});
// With zero failures in n independent trials, the true failure rate is below this at 95% confidence.
const ruleOfThree = (n: number) => +(100 * (1 - Math.pow(0.05, 1 / n))).toFixed(2);

const out: Record<string, unknown> = {
  bench: BENCH, root: ROOT.split('/').pop(), trials: TRIALS, gatewayStubMs: GATEWAY_MS, poolMax: 10,
};

if (BENCH === 'init') {
  const CONCURRENT = 5; // the route's rate limiter allows exactly 5 requests per minute per user
  let gatewayCalls = 0;
  mock.method(sslcommerz, 'initPayment', async () => { gatewayCalls++; await sleep(GATEWAY_MS); return { status: 'SUCCESS', GatewayPageURL: 'https://gateway.example.test/s' }; });
  const calls: number[] = [], rows: number[] = [], tranIds: number[] = [], latencies: number[] = [], walls: number[] = [];
  const codes: Record<string, number> = {};
  let violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const checkout = await makeCheckout(); gatewayCalls = 0;
    const started = performance.now();
    const responses = await Promise.all(Array.from({ length: CONCURRENT }, async () => {
      const s = performance.now();
      const response = await request('/api/payment/init', { orderId: checkout.orderId }, checkout.cookie);
      return { response, ms: performance.now() - s };
    }));
    walls.push(performance.now() - started);
    responses.forEach(({ response, ms }) => { latencies.push(ms); codes[response.status] = (codes[response.status] || 0) + 1; });
    const ids = new Set(responses.map(({ response }) => response.body?.tran_id).filter(Boolean));
    const sessions = new Set(responses.map(({ response }) => JSON.stringify(response.body?.session)));
    const pending = (await query("SELECT COUNT(*)::int c FROM payments WHERE order_id=$1 AND status='PENDING'", [checkout.orderId])).rows[0].c;
    calls.push(gatewayCalls); rows.push(pending); tranIds.push(ids.size);
    if (gatewayCalls !== 1 || pending !== 1 || ids.size !== 1 || sessions.size !== 1 || responses.some(({ response }) => response.status !== 200)) violations++;
  }
  Object.assign(out, {
    concurrentRequestsPerOrder: CONCURRENT, gatewayCallsPerOrder: histogram(calls), pendingPaymentRowsPerOrder: histogram(rows),
    distinctTranIdsPerOrder: histogram(tranIds), httpStatusCodes: codes, trialsViolatingOneSessionInvariant: violations,
    perRequestLatencyMs: summarize(latencies), perOrderWallMs: summarize(walls),
    ruleOfThreeUpperBoundPct: violations === 0 ? ruleOfThree(TRIALS) : null,
  });
}

if (BENCH === 'refund') {
  const WORKERS = 4;
  let gatewayCalls = 0;
  mock.method(sslcommerz, 'initiateRefund', async (params: any) => { gatewayCalls++; await sleep(50); return { APIConnect: 'DONE', status: 'success', refund_ref_id: `G-${params.refundTransId}` }; });
  mock.method(sslcommerz, 'getRefundStatus', async (ref: string) => ({ APIConnect: 'DONE', status: 'processing', refund_ref_id: ref }));
  const perTrial: number[] = [], latencies: number[] = [];
  let violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const customerId = `CUSTOMER-${randomUUID()}`, orderId = `ORD-${randomUUID()}`, paymentId = `PAY-${randomUUID()}`, refundId = `REF-${randomUUID()}`;
    await makeUser('customer', customerId);
    await query('INSERT INTO customers (id,name) VALUES ($1,$2)', [customerId, 'Bench']);
    await makeOrderRow(customerId, orderId);
    await makeValidatedPayment(paymentId, orderId, customerId);
    await query(`INSERT INTO refunds (id,order_id,payment_id,amount,method,status) VALUES ($1,$2,$3,100,'sslcommerz','requested')`, [refundId, orderId, paymentId]);
    gatewayCalls = 0;
    await Promise.all(Array.from({ length: WORKERS }, async () => { const s = performance.now(); await processRefundQueue(); latencies.push(performance.now() - s); }));
    perTrial.push(gatewayCalls);
    if (gatewayCalls !== 1) violations++;
    await query('DELETE FROM refunds WHERE id=$1', [refundId]);
  }
  Object.assign(out, {
    concurrentWorkers: WORKERS, gatewayRefundCallsPerRefund: histogram(perTrial), trialsViolatingExactlyOnce: violations,
    workerLatencyMs: summarize(latencies), ruleOfThreeUpperBoundPct: violations === 0 ? ruleOfThree(TRIALS) : null,
  });
}

if (BENCH === 'dupvalidate') {
  const CONCURRENT = 4;
  let refundCalls = 0;
  mock.method(sslcommerz, 'initiateRefund', async (params: any) => { refundCalls++; await sleep(20); return { APIConnect: 'DONE', status: 'success', refund_ref_id: `G-${params.refundTransId}` }; });
  mock.method(sslcommerz, 'getRefundStatus', async (ref: string) => ({ APIConnect: 'DONE', status: 'refunded', refund_ref_id: ref }));
  const realFetch = globalThis.fetch;
  const transactionByValId = new Map<string, string>();
  mock.method(globalThis, 'fetch', async (url: any, init: any) => {
    const text = String(url);
    if (text.includes('validationserverAPI')) {
      const valId = new URL(text).searchParams.get('val_id')!;
      return new Response(JSON.stringify({ status: 'VALID', tran_id: transactionByValId.get(valId), val_id: valId, amount: '100.00', currency: 'BDT', bank_tran_id: `BANK-${valId}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  });
  const refunds: number[] = [], gatewayRefunds: number[] = [], latencies: number[] = [];
  const responseKinds: Record<string, number> = {};
  let violations = 0;
  for (let i = 0; i < TRIALS; i++) {
    const customerId = `CUSTOMER-${randomUUID()}`, orderId = `ORD-${randomUUID()}`;
    const upper = () => randomUUID().replaceAll('-', '').toUpperCase();
    const primary = `SSLCZ-${upper()}`, duplicate = `SSLCZ-${upper()}`, valId = `VAL-${upper()}`;
    transactionByValId.set(valId, duplicate);
    await makeUser('customer', customerId);
    await query('INSERT INTO customers (id,name) VALUES ($1,$2)', [customerId, 'Bench']);
    await makeOrderRow(customerId, orderId, 'paid', 'bkash', primary);
    await query(`INSERT INTO payments (id,order_id,customer_id,amount,currency,gateway,payment_method,transaction_id,bank_tran_id,status) VALUES
                 ($1,$2,$3,100,'BDT','sslcommerz','bkash',$4,$5,'VALIDATED'), ($6,$2,$3,100,'BDT','sslcommerz','nagad',$7,NULL,'PENDING')`,
      [`PAY-${randomUUID()}`, orderId, customerId, primary, `BANK-${randomUUID()}`, `PAY-${randomUUID()}`, duplicate]);
    const cookie = await makeSession('customer', customerId);
    refundCalls = 0;
    const responses = await Promise.all(Array.from({ length: CONCURRENT }, async () => {
      const s = performance.now();
      const response = await request('/api/payment/sslcommerz/validate', { tran_id: duplicate, val_id: valId }, cookie);
      latencies.push(performance.now() - s);
      return response;
    }));
    responses.forEach((r) => { const kind = `${r.status}:${r.body?.status ?? r.body?.error ?? ''}`; responseKinds[kind] = (responseKinds[kind] || 0) + 1; });
    await sleep(400); // let the background refund workers settle
    const refundRows = (await query('SELECT COUNT(*)::int c FROM refunds WHERE order_id=$1', [orderId])).rows[0].c;
    const net = (await query(`SELECT (SELECT COALESCE(SUM(amount),0) FROM payments WHERE order_id=$1 AND status IN ('VALIDATED','REFUNDED')) -
                                     (SELECT COALESCE(SUM(amount),0) FROM refunds WHERE order_id=$1) AS net`, [orderId])).rows[0].net;
    const order = (await query('SELECT payment_status, transaction_id FROM orders WHERE id=$1', [orderId])).rows[0];
    refunds.push(refundRows); gatewayRefunds.push(refundCalls);
    if (refundRows !== 1 || refundCalls !== 1 || Number(net) !== 100 || order.payment_status !== 'paid' || order.transaction_id !== primary) violations++;
    await query('DELETE FROM refunds WHERE order_id=$1', [orderId]);
  }
  Object.assign(out, {
    concurrentValidateCallsPerDuplicate: CONCURRENT, httpResponses: responseKinds, refundRowsPerDuplicate: histogram(refunds),
    gatewayRefundCallsPerDuplicate: histogram(gatewayRefunds), trialsViolatingInvariants: violations,
    invariant: 'exactly 1 refund row, exactly 1 gateway refund call, net charged == order total (100), order stays paid on the primary transaction',
    validateLatencyMs: summarize(latencies), ruleOfThreeUpperBoundPct: violations === 0 ? ruleOfThree(TRIALS) : null,
  });
}

if (BENCH === 'load') {
  // N distinct customers each initialise one payment at the same moment; the stubbed gateway takes GATEWAY_MS.
  const sizes = (process.env.SIZES || '10,20,40,80').split(',').map(Number);
  const reps = Number(process.env.REPS || 5);
  mock.method(sslcommerz, 'initPayment', async () => { await sleep(GATEWAY_MS); return { status: 'SUCCESS', GatewayPageURL: 'https://gateway.example.test/s' }; });
  const bySize: Record<string, unknown> = {};
  for (const n of sizes) {
    const latencies: number[] = [], walls: number[] = [];
    const codes: Record<string, number> = {};
    for (let rep = 0; rep < reps; rep++) {
      const checkouts = [];
      for (let i = 0; i < n; i++) checkouts.push(await makeCheckout());
      const started = performance.now();
      await Promise.all(checkouts.map(async (checkout) => {
        const s = performance.now();
        const response = await request('/api/payment/init', { orderId: checkout.orderId }, checkout.cookie);
        latencies.push(performance.now() - s);
        codes[response.status] = (codes[response.status] || 0) + 1;
      }));
      walls.push(performance.now() - started);
    }
    bySize[n] = {
      latencyMs: summarize(latencies), httpStatusCodes: codes,
      meanWallMs: +(walls.reduce((a, b) => a + b, 0) / walls.length).toFixed(0),
      // What you would expect if each init held one of the 10 pooled connections for the whole gateway call.
      modelConnectionHeldMs: Math.ceil(n / 10) * GATEWAY_MS,
    };
  }
  Object.assign(out, { reps, byConcurrency: bySize });
}

if (BENCH === 'starve') {
  // OLD 'submitted' refunds that the gateway never confirms, then NEW 'requested' refunds, then one queue pass.
  const OLD = 55, NEW = 20;
  const initiated: string[] = [];
  mock.method(sslcommerz, 'getRefundStatus', async (ref: string) => ({ APIConnect: 'DONE', status: 'processing', refund_ref_id: ref }));
  mock.method(sslcommerz, 'initiateRefund', async (params: any) => { initiated.push(params.refundTransId); return { APIConnect: 'DONE', status: 'success', refund_ref_id: `G-${params.refundTransId}` }; });
  const customerId = `CUSTOMER-${randomUUID()}`, orderId = `ORD-${randomUUID()}`, prefix = `REF-OLD-${randomUUID()}-`;
  await makeUser('customer', customerId);
  await query('INSERT INTO customers (id,name) VALUES ($1,$2)', [customerId, 'Bench']);
  await makeOrderRow(customerId, orderId);
  await query(`INSERT INTO refunds (id,order_id,amount,method,status,gateway_ref,created_at,updated_at)
               SELECT $1::text || g::text,$2,10,'sslcommerz','submitted','GREF-' || $1::text || g::text, now() - interval '1 day', now() - interval '1 day'
               FROM generate_series(1,$3) g`, [prefix, orderId, OLD]);
  const newIds: string[] = [];
  for (let i = 0; i < NEW; i++) {
    const paymentId = `PAY-${randomUUID()}`, refundId = `REF-NEW-${randomUUID()}`;
    await makeValidatedPayment(paymentId, orderId, customerId);
    await query(`INSERT INTO refunds (id,order_id,payment_id,amount,method,status) VALUES ($1,$2,$3,100,'sslcommerz','requested')`, [refundId, orderId, paymentId]);
    newIds.push(refundId);
  }
  const started = performance.now();
  const summary = await processRefundQueue();
  const passMs = performance.now() - started;
  const states = (await query('SELECT status, COUNT(*)::int c FROM refunds WHERE id = ANY($1) GROUP BY status', [newIds])).rows;
  Object.assign(out, {
    oldSubmittedBacklog: OLD, newRequestedRefunds: NEW, summaryAfterOnePass: summary,
    newRefundStatusesAfterOnePass: Object.fromEntries(states.map((row: any) => [row.status, row.c])),
    gatewayInitiationsInOnePass: initiated.length, onePassMs: +passMs.toFixed(0),
  });
  await query('DELETE FROM refunds WHERE order_id=$1', [orderId]);
}

const json = JSON.stringify(out, null, 2);
if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, json + '\n');
console.log(json);
server.close();
await pool.end().catch(() => {});
process.exit(0);
