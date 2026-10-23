import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  addToCartBody,
  createOrderBody,
  loginBody,
  paymentInitBody,
  payoutPayBody,
  resourceIdParam,
  riderLocationBody,
  riderWithdrawalBody,
  sellerPayoutRequestBody,
  signupBody,
  sslcommerzValidateBody,
  withdrawalStatusBody,
} from '../server/validation/schemas.ts';
import { validateBody } from '../server/middleware/validate.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => assert.equal(schema.safeParse(value).success, true, JSON.stringify(value));
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => assert.equal(schema.safeParse(value).success, false, JSON.stringify(value));

test('signup: role, password length and types are enforced', () => {
  ok(signupBody, { role: 'customer', username: 'abc_12', password: 'longenough' });
  ok(signupBody, { role: 'seller', email: 'a@b.co', password: 'longenough' });
  bad(signupBody, { role: 'admin', username: 'abc', password: 'longenough' });
  bad(signupBody, { role: 'customer', username: 'abc', password: 'short' });
  bad(signupBody, { role: 'customer', username: 'abc', password: 'x'.repeat(129) });
  bad(signupBody, { role: 'customer', username: { $ne: '' }, password: 'longenough' });
  bad(signupBody, { role: 'customer', username: 'a'.repeat(500), password: 'longenough' });
});

test('login: requires two bounded strings', () => {
  ok(loginBody, { email: ' user ', password: 'x' });
  bad(loginBody, { email: '', password: 'x' });
  bad(loginBody, { email: 'u', password: '' });
  bad(loginBody, { email: ['a'], password: 'x' });
  bad(loginBody, { email: 'u', password: 'p'.repeat(1001) });
  bad(loginBody, {});
});

test('payment init: unsupported methods and bad ids fail, server-controlled keys survive for the handler to reject', () => {
  ok(paymentInitBody, { orderId: 'ORD-123', paymentMethod: 'nagad' });
  assert.equal(paymentInitBody.parse({ orderId: 'ORD-123' }).paymentMethod, 'bkash');
  bad(paymentInitBody, { orderId: 'ORD-123', paymentMethod: 'cash_on_delivery' });
  bad(paymentInitBody, { orderId: "ORD-1'; DROP TABLE orders;--" });
  bad(paymentInitBody, { orderId: 42 });
  assert.equal((paymentInitBody.parse({ orderId: 'ORD-1', amount: 1 }) as any).amount, 1, 'amount must reach the handler so it can be rejected by name');
});

test('sslcommerz validate: transaction id format and val_id', () => {
  ok(sslcommerzValidateBody, { tran_id: 'SSLCZ-AB12-9', val_id: 'v1' });
  bad(sslcommerzValidateBody, { tran_id: 'nope', val_id: 'v1' });
  bad(sslcommerzValidateBody, { tran_id: 'SSLCZ-AB12', val_id: '   ' });
  bad(sslcommerzValidateBody, { tran_id: 'SSLCZ-AB12', val_id: 'v1', order_id: { a: 1 } });
});

test('money amounts: positive, at most two decimals, bounded, numeric strings accepted', () => {
  ok(sellerPayoutRequestBody, { amount: 100 });
  ok(sellerPayoutRequestBody, { amount: '250.75' });
  bad(sellerPayoutRequestBody, { amount: 0 });
  bad(sellerPayoutRequestBody, { amount: -5 });
  bad(sellerPayoutRequestBody, { amount: 10.005 });
  bad(sellerPayoutRequestBody, { amount: 1e12 });
  bad(sellerPayoutRequestBody, { amount: 'NaN' });
  bad(sellerPayoutRequestBody, { amount: null });
  bad(sellerPayoutRequestBody, {});
});

test('payout and withdrawal bodies', () => {
  ok(payoutPayBody, { externalReference: 'TXN123' });
  bad(payoutPayBody, { externalReference: '   ' });
  bad(payoutPayBody, { externalReference: 'x'.repeat(101) });
  ok(riderWithdrawalBody, { amount: 500, payoutMethod: 'bkash', payoutAccount: '01700000000' });
  bad(riderWithdrawalBody, { amount: 500, payoutMethod: 'paypal', payoutAccount: '01700000000' });
  bad(riderWithdrawalBody, { amount: 500, payoutMethod: 'bank', payoutAccount: '' });
  ok(withdrawalStatusBody, { status: 'paid' });
  bad(withdrawalStatusBody, { status: 'pending' });
});

test('rider location: coordinates must be real numbers in range', () => {
  ok(riderLocationBody, { latitude: 23.8, longitude: 90.4 });
  ok(riderLocationBody, { latitude: '23.8', longitude: '90.4' });
  bad(riderLocationBody, { latitude: 91, longitude: 0 });
  bad(riderLocationBody, { latitude: 0, longitude: 181 });
  bad(riderLocationBody, { latitude: null, longitude: 0 });
  bad(riderLocationBody, {});
});

test('earlier schemas still behave: cart quantity, order items, id params', () => {
  assert.equal(addToCartBody.parse({ Product_ID: 'PROD-1', Quantity: '3' }).Quantity, 3);
  bad(addToCartBody, { Product_ID: 'PROD-1', Quantity: 0 });
  bad(createOrderBody, { Customer_ID: 'C1', Items: [], Shipping_Address: { Street: 's', City: 'c' } });
  ok(resourceIdParam, { id: 'PAYOUT-1' });
  bad(resourceIdParam, { id: '../etc/passwd' });
});

test('validateBody replies 400 with the first message and never calls the handler', () => {
  let status = 0;
  let payload: any;
  let called = false;
  const res: any = { status(code: number) { status = code; return this; }, json(body: unknown) { payload = body; return this; } };
  validateBody(loginBody)({ body: { email: '', password: '' } } as any, res, () => { called = true; });
  assert.equal(status, 400);
  assert.equal(called, false);
  assert.equal(payload.error, 'Username/Email and Password are required');
  assert.ok(Array.isArray(payload.issues));
});

// Ratchet: a write route must either validate its input or be on this list. The list may only shrink.
const STILL_UNVALIDATED: string[] = JSON.parse(readFileSync('tests/unvalidated-routes.json', 'utf8'));

const writeRoutes = () => {
  const found: Array<{ key: string; validated: boolean }> = [];
  for (const file of readdirSync('server/routes').filter((name) => name.endsWith('.routes.ts'))) {
    const source = readFileSync(`server/routes/${file}`, 'utf8');
    for (const match of source.matchAll(/router\.(post|put|patch|delete)\(\s*'([^']*)'/g)) {
      const start = match.index ?? 0;
      const rest = source.slice(start, start + 600);
      const cut = Math.min(...['async', '=>', 'handle'].map((word) => { const i = rest.indexOf(word, 20); return i < 0 ? rest.length : i; }));
      const head = rest.slice(0, cut);
      found.push({ key: `${file} ${match[1].toUpperCase()} ${match[2]}`, validated: /validateBody|validateParams/.test(head) });
    }
  }
  return found;
};

test('every write route validates its input or is on the shrinking allowlist', () => {
  const routes = writeRoutes();
  assert.ok(routes.length > 50, 'route scan found the routes');
  const unvalidated = routes.filter((route) => !route.validated).map((route) => route.key);
  const fresh = unvalidated.filter((key) => !STILL_UNVALIDATED.includes(key));
  assert.deepEqual(fresh, [], 'New write routes must use validateBody/validateParams.');
  const stale = STILL_UNVALIDATED.filter((key) => !unvalidated.includes(key));
  assert.deepEqual(stale, [], 'These routes are validated now: remove them from tests/unvalidated-routes.json.');
});
