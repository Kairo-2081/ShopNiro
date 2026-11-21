// Concurrent checkout load test: does stock hold, and do order identifiers stay unique, when many customers
// check out at the same moment?
//
//   npm run bench:checkout
//
// Scenarios (each repeated ROUNDS times on fresh data):
//   oversell      CHECKOUTS customers each cart 1 unit of ONE product that has STOCK units. Exactly STOCK orders may succeed.
//   oversell-qty  every cart holds 2 units and stock is odd, so the last unit must stay unsold.
//   same-cart     one customer sends 5 identical requests at once, without and with an Idempotency-Key: one order each.
//   throughput    CHECKOUTS customers, plenty of stock: every checkout should succeed; latency percentiles are reported.
//
// Environment: DATABASE_URL (required, disposable local PostgreSQL built with npm run migrate), CHECKOUTS (50),
// STOCK (20), ROUNDS (10), BENCH_OUT (also write the JSON there).
//
// It inserts customers, products and orders, and refuses to run against a non-local database. Cash on delivery is used so
// no payment gateway is involved. The Express app mounts only the orders routes, over real HTTP on a random local port,
// using the application's own connection pool (10 connections).
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { request as httpRequest, type Server } from 'node:http';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-test-test-test-test-test-test-test';
process.env.CRON_SECRET ??= 'test-test-test-test-test-test-test-test';

const host = (() => { try { return new URL(process.env.DATABASE_URL || '').hostname; } catch { return ''; } })();
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error('DATABASE_URL must point at a disposable local PostgreSQL database.');
  process.exit(2);
}
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
  console.error('NODE_ENV must be "test" or "development".');
  process.exit(2);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHECKOUTS = Number(process.env.CHECKOUTS || 50);
const STOCK = Number(process.env.STOCK || 20);
const ROUNDS = Number(process.env.ROUNDS || 10);
const require = createRequire(`${ROOT}/package.json`);
const express = require('express');
const imp = (path: string) => import(pathToFileURL(`${ROOT}/${path}`).href);

const { query } = await imp('server/db/index.ts');
const { generateToken, verifyToken } = await imp('server/middleware/auth.ts');
const { default: ordersRoutes } = await imp('server/routes/orders.routes.ts');

const app = express();
app.use(express.json());
// The real app attaches a request logger; the routes call req.log, so give them one that keeps the first few errors.
const serverErrors: string[] = [];
app.use((req: any, _res: unknown, next: () => void) => {
  const note = (...args: any[]) => { const message = String(args[0]?.err?.message ?? args[1] ?? args[0]);
    // A refused checkout (not enough stock) is logged by the route as an error but is the correct answer; keep the rest.
    if (!message.includes('Insufficient stock') && serverErrors.length < 5) serverErrors.push(message); };
  req.log = { error: note, warn: () => {}, info: () => {}, debug: () => {} };
  next();
});
app.use('/api/orders', ordersRoutes);
const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const port = (server.address() as { port: number }).port;

type Res = { status: number; body: any; ms: number };
const post = (body: unknown, cookie: string, extra: Record<string, string> = {}): Promise<Res> =>
  new Promise((resolve, reject) => {
    const started = performance.now();
    const chunks: Buffer[] = [];
    const req = httpRequest({
      hostname: '127.0.0.1', port, path: '/api/orders', method: 'POST', agent: false,
      headers: { origin: 'http://localhost', 'content-type': 'application/json', cookie, ...extra },
    }, (response) => {
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
        resolve({ status: response.statusCode || 0, body: parsed, ms: performance.now() - started });
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

const address = { Street: 'Load test street', City: 'Dhaka', Postal_Code: '1200' };
const makeProduct = async (stock: number) => {
  const sellerId = `SELLER-${randomUUID()}`, categoryId = `CATEGORY-${randomUUID()}`, productId = `PRODUCT-${randomUUID()}`;
  await makeUser('seller', sellerId);
  await query('INSERT INTO sellers (id, name, status) VALUES ($1,$2,$3)', [sellerId, 'Load Seller', 'approved']);
  await query('INSERT INTO categories (id, name) VALUES ($1,$2)', [categoryId, `Load ${categoryId}`]);
  await query(`INSERT INTO products (id,name,image,description,price,stock,product_status,category_id,seller_id)
               VALUES ($1,'Load Product','','',100,$2,'active',$3,$4)`, [productId, stock, categoryId, sellerId]);
  return productId;
};
const makeCustomer = async (productId: string, quantity: number) => {
  const customerId = `CUSTOMER-${randomUUID()}`;
  await makeUser('customer', customerId);
  await query('INSERT INTO customers (id, name) VALUES ($1,$2)', [customerId, 'Load Customer']);
  await query('INSERT INTO cart (id,customer_id,product_id,quantity,size) VALUES ($1,$2,$3,$4,$5)', [`CART-${randomUUID()}`, customerId, productId, quantity, '']);
  return { customerId, cookie: await makeSession('customer', customerId) };
};
const orderBody = (customerId: string, productId: string, quantity: number) => ({
  Customer_ID: customerId, acceptedTerms: true, Items: [{ Product_ID: productId, Quantity: quantity }],
  Shipping_Address: address, Billing_Address: address, paymentMethod: 'cash_on_delivery',
});

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const summarize = (values: number[]) => values.length ? ({
  n: values.length, p50: +percentile(values, 50).toFixed(1), p95: +percentile(values, 95).toFixed(1),
  p99: +percentile(values, 99).toFixed(1), max: +Math.max(...values).toFixed(1),
}) : null;
const histogram = (values: number[]) => values.reduce((c: Record<string, number>, v) => { c[v] = (c[v] || 0) + 1; return c; }, {});
const stockOf = async (productId: string) => Number((await query('SELECT stock FROM products WHERE id=$1', [productId])).rows[0].stock);
const orderRowsFor = (customerIds: string[]) => query('SELECT id, tracking_id FROM orders WHERE customer_id = ANY($1::varchar[])', [customerIds]);

type Violation = string;
const violations: Violation[] = [];
const check = (condition: boolean, message: string) => { if (!condition) violations.push(message); };

const results: Record<string, any> = {};

const raceOnStock = async (name: string, stock: number, quantity: number, expectedOrders: number, expectedLeft: number) => {
  const statuses: number[] = [], latencies: number[] = [], walls: number[] = [];
  let totalOrders = 0, totalIds = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const productId = await makeProduct(stock);
    const customers = await Promise.all(Array.from({ length: CHECKOUTS }, () => makeCustomer(productId, quantity)));
    const started = performance.now();
    const responses = await Promise.all(customers.map((c) => post(orderBody(c.customerId, productId, quantity), c.cookie)));
    walls.push(performance.now() - started);
    responses.forEach((r) => { statuses.push(r.status); if (r.status === 201) latencies.push(r.ms); });
    const created = responses.filter((r) => r.status === 201);
    const left = await stockOf(productId);
    const rows = (await orderRowsFor(customers.map((c) => c.customerId))).rows;
    const ids = new Set(created.map((r) => r.body.Order_ID));
    const ordersAndTracking = new Set([...rows.map((r: any) => r.id), ...rows.map((r: any) => r.tracking_id)]);
    totalOrders += rows.length; totalIds += ids.size;
    check(created.length === expectedOrders, `${name} round ${round}: ${created.length} orders succeeded, expected ${expectedOrders}`);
    check(rows.length === expectedOrders, `${name} round ${round}: ${rows.length} order rows, expected ${expectedOrders}`);
    check(left === expectedLeft, `${name} round ${round}: stock left ${left}, expected ${expectedLeft}`);
    check(left >= 0, `${name} round ${round}: stock went negative (${left})`);
    check(ids.size === created.length, `${name} round ${round}: duplicate Order_ID in responses`);
    check(ordersAndTracking.size === rows.length * 2, `${name} round ${round}: duplicate order id or tracking id in the database`);
    check(responses.every((r) => r.status === 201 || (r.status >= 400 && r.status < 500)), `${name} round ${round}: a checkout returned a server error`);
  }
  results[name] = {
    rounds: ROUNDS, checkoutsPerRound: CHECKOUTS, stock, quantityPerCart: quantity,
    expectedOrdersPerRound: expectedOrders, expectedStockLeft: expectedLeft,
    totalChecks: ROUNDS * CHECKOUTS, ordersCreated: totalOrders, distinctOrderIds: totalIds,
    statusCounts: histogram(statuses), successLatencyMs: summarize(latencies),
    roundWallMs: summarize(walls),
  };
};

await raceOnStock('oversell', STOCK, 1, STOCK, 0);
await raceOnStock('oversell-qty', 2 * Math.floor(STOCK / 2) + 1, 2, Math.floor(STOCK / 2), 1);

{
  const statuses: number[] = [];
  let orders = 0;
  for (const keyed of [false, true]) {
    for (let round = 0; round < ROUNDS; round++) {
      const productId = await makeProduct(1000);
      const { customerId, cookie } = await makeCustomer(productId, 2);
      const key = keyed ? `load-${randomUUID()}` : null;
      const responses = await Promise.all(Array.from({ length: 5 }, () =>
        post(orderBody(customerId, productId, 2), cookie, key ? { 'Idempotency-Key': key } : {})));
      responses.forEach((r) => statuses.push(r.status));
      const rows = (await orderRowsFor([customerId])).rows;
      orders += rows.length;
      check(rows.length === 1, `same-cart${keyed ? ' (keyed)' : ''} round ${round}: ${rows.length} orders for one cart, expected 1`);
      check((await stockOf(productId)) === 998, `same-cart${keyed ? ' (keyed)' : ''} round ${round}: stock not reduced exactly once`);
      if (keyed) {
        const ok = responses.filter((r) => r.status === 201 || r.status === 200);
        check(new Set(ok.map((r) => r.body?.Order_ID)).size <= 1, `same-cart keyed round ${round}: replies carried different order ids`);
      }
    }
  }
  results['same-cart'] = { roundsEach: ROUNDS, requestsPerRound: 5, variants: ['no key', 'Idempotency-Key'], ordersCreated: orders, expectedOrders: ROUNDS * 2, statusCounts: histogram(statuses) };
}

{
  const latencies: number[] = [], walls: number[] = [];
  let created = 0, ids = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const productId = await makeProduct(100000);
    const customers = await Promise.all(Array.from({ length: CHECKOUTS }, () => makeCustomer(productId, 1)));
    const started = performance.now();
    const responses = await Promise.all(customers.map((c) => post(orderBody(c.customerId, productId, 1), c.cookie)));
    walls.push(performance.now() - started);
    const ok = responses.filter((r) => r.status === 201);
    ok.forEach((r) => latencies.push(r.ms));
    created += ok.length; ids += new Set(ok.map((r) => r.body.Order_ID)).size;
    check(ok.length === CHECKOUTS, `throughput round ${round}: ${ok.length} of ${CHECKOUTS} checkouts succeeded`);
    check((await stockOf(productId)) === 100000 - CHECKOUTS, `throughput round ${round}: stock did not drop by exactly ${CHECKOUTS}`);
  }
  results.throughput = { rounds: ROUNDS, checkoutsPerRound: CHECKOUTS, ordersCreated: created, distinctOrderIds: ids, latencyMs: summarize(latencies), roundWallMs: summarize(walls) };
}

const out = {
  bench: 'checkout-load', date: new Date().toISOString().slice(0, 10), node: process.version, poolMax: 10,
  note: 'Local PostgreSQL, one Node process, cash on delivery, real HTTP on loopback. Not a production figure.',
  pass: violations.length === 0, serverErrors, violations: violations.slice(0, 20), violationCount: violations.length, results,
};
console.log(JSON.stringify(out, null, 2));
if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(out, null, 2));
await new Promise((resolve) => server.close(resolve));
process.exit(violations.length ? 1 : 0);
