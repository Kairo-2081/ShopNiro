import assert from 'node:assert/strict';
import { after, test, type TestContext } from 'node:test';
import express from 'express';
import { request as httpRequest, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pool, query } from '../server/db/index.ts';

// Route-level checks for the forms and callbacks that were the last to get schemas: the schema layer must
// reject bad input with the same messages as before, and must never change who gets a 401 or a redirect.
process.env.JWT_SECRET ??= 'test-validation-routes-secret-at-least-32-characters';
process.env.CRON_SECRET ??= 'test-cron-secret-at-least-32-characters-long';
process.env.SSLCOMMERZ_IPN_TOKEN ??= 'test-ipn-token-1234567890abcdef';
if (process.env.CI && !process.env.DATABASE_URL) throw new Error('DATABASE_URL required in CI');
const dbTest = (name: string, fn: (context: TestContext) => void | Promise<void>) =>
  process.env.DATABASE_URL ? test(name, { timeout: 30_000 }, fn) : test.skip(name, fn);

const { default: authRoutes } = await import('../server/routes/auth.routes.ts');
const { default: customersRoutes } = await import('../server/routes/customers.routes.ts');
const { default: sellersRoutes } = await import('../server/routes/sellers.routes.ts');
const { default: ridersRoutes } = await import('../server/routes/riders.routes.ts');
const { default: paymentRoutes } = await import('../server/routes/payment.routes.ts');
const { default: cronRoutes } = await import('../server/routes/cron.routes.ts');

const app = express();
app.use((req, _res, next) => {
  (req as any).log = { error: () => {}, warn: () => {}, info: () => {} };
  next();
});
app.use(express.json({ limit: '8mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/sellers', sellersRoutes);
app.use('/api/riders', ridersRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/cron', cronRoutes);

const server: Server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});

const send = (path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: any; location?: string }> =>
  new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') return reject(new Error('no address'));
    const req = httpRequest({
      hostname: '127.0.0.1', port: address.port, path, method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(Buffer.from(c)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed: any = null;
        try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
        resolve({ status: res.statusCode || 0, body: parsed, location: res.headers.location });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });

const email = `route-test-${randomUUID()}@example.invalid`;
after(async () => {
  await query('DELETE FROM users WHERE email = $1', [email]).catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

const customer = { Name: 'Route Test', Email: email, Password: 'longenough1', Number: '01700000000', Address: { Street: 'Road 5', City: 'Dhaka' } };

dbTest('customer registration: bad input is rejected with the old messages, then a good one succeeds', async () => {
  const noPhone = await send('/api/customers', { ...customer, Number: '' });
  assert.equal(noPhone.status, 400);
  assert.equal(noPhone.body.error, 'A phone number is required');

  const shortPassword = await send('/api/customers', { ...customer, Password: 'short' });
  assert.equal(shortPassword.status, 400);
  assert.equal(shortPassword.body.error, 'Password must be at least 8 characters.');

  const created = await send('/api/customers', customer);
  assert.equal(created.status, 201);
  assert.equal(created.body.Email, email);

  const duplicate = await send('/api/customers', customer);
  assert.equal(duplicate.status, 409);
});

dbTest('seller and rider applications: schema errors keep the messages the forms show', async () => {
  const seller = await send('/api/sellers', { Name: 'Shop', Email: `s-${email}`, Password: 'longenough1', Number: '017', Address: customer.Address, Payout_Method: 'cash', Payout_Account: '123456', Identity_Document: 'data:application/pdf;base64,JVBERi0x' });
  assert.equal(seller.status, 400);
  assert.equal(seller.body.error, 'Choose bKash or bank payout and provide a valid payout account.');

  const rider = await send('/api/riders/apply', { Username: 'r1', Name: 'Rider', Email: `r-${email}`, Password: 'longenough1', Number: '017', Has_CV: 'no' });
  assert.equal(rider.status, 400);
  assert.equal(rider.body.error, 'Choose whether you have a CV.');

  const oversized = await send('/api/riders/apply', { Username: 'r1', Name: 'Rider', Email: `r-${email}`, Password: 'longenough1', Number: '017', Has_CV: false, Experience: 'ten years' });
  assert.equal(oversized.status, 400);
  assert.ok(Array.isArray(oversized.body.issues));
});

dbTest('IPN: authentication comes before validation, and a bad transaction id is a 400', async () => {
  const noToken = await send('/api/payment/sslcommerz/ipn', { tran_id: ['not', 'a', 'string'] });
  assert.equal(noToken.status, 401, 'an unauthenticated caller never sees a schema error');

  const wrongToken = await send('/api/payment/sslcommerz/ipn?token=wrong', { tran_id: 'SSLCZ-ABC' });
  assert.equal(wrongToken.status, 401);

  const token = process.env.SSLCOMMERZ_IPN_TOKEN;
  const badTran = await send(`/api/payment/sslcommerz/ipn?token=${token}`, { tran_id: "x'; DROP TABLE payments;--", status: 'VALID' });
  assert.equal(badTran.status, 400);
  assert.equal(badTran.body.error, 'A valid SSLCommerz transaction ID is required');

  const ignored = await send(`/api/payment/sslcommerz/ipn?token=${token}`, { tran_id: 'SSLCZ-ABC-1', status: 'FAILED' });
  assert.equal(ignored.status, 202);
});

dbTest('gateway return pages always redirect, even with a garbage body', async () => {
  for (const path of ['success', 'fail', 'cancel']) {
    const res = await send(`/api/payment/sslcommerz/${path}`, { tran_id: { x: 1 }, val_id: 'v'.repeat(500) });
    assert.equal(res.status, 303, path);
    assert.ok(res.location, path);
  }
});

dbTest('bodyless routes ignore any body: logout and cron triggers', async () => {
  const logout = await send('/api/auth/logout', { junk: { nested: true } });
  assert.equal(logout.status, 200);

  const secret = process.env.CRON_SECRET!;
  const denied = await send('/api/cron/expire-orders', { junk: 1 });
  assert.equal(denied.status, 401);
  const allowed = await send('/api/cron/expire-orders', { junk: 1 }, { authorization: `Bearer ${secret}` });
  assert.equal(allowed.status, 200);
  assert.equal(typeof allowed.body.expired, 'number');
});
