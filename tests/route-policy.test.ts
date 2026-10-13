import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { request as httpRequest, Server } from 'node:http';
import { Router } from 'express';

process.env.JWT_SECRET ??= 'route-policy-test-secret-at-least-32-characters';
process.env.APP_URL = 'https://configured-shopniro.example';

const { app, apiRouterMounts } = await import('../server/app.ts');
const { isPublicApiRoute } = await import('../server/middleware/publicRoutes.ts');
const dbTest = process.env.DATABASE_URL ? test : test.skip;
const mutationProbe = Router();
mutationProbe.get('/leak', (_req, res) => res.json({ exposed: true }));
app.use('/api/route-policy-probe', mutationProbe);
apiRouterMounts.push(['/api/route-policy-probe', mutationProbe]);

const routes = () => apiRouterMounts.flatMap(([prefix, router]) =>
  router.stack.flatMap((layer: any) => {
    if (!layer.route) return [];
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    return paths.flatMap((routePath: string) => Object.keys(layer.route.methods)
      .filter((method) => layer.route.methods[method])
      .map((method) => [method.toUpperCase(), `${prefix}${routePath === '/' ? '' : routePath}`] as const));
  })
);

const server = await new Promise<Server>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

const request = async (method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: any }> => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.');
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        origin: 'http://localhost',
        'content-type': 'application/json',
        connection: 'close',
        ...extraHeaders,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let responseBody: any = text || null;
        try {
          if (text) responseBody = JSON.parse(text);
        } catch {
          // Keep non-JSON responses available to assertions.
        }
        resolve({ status: res.statusCode || 0, body: responseBody });
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
};

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
});

test('every registered non-public API route rejects anonymous requests', async () => {
  for (const [method, routePath] of routes()) {
    if (isPublicApiRoute(method, routePath)) continue;
    const path = routePath.replace(/:([A-Za-z0-9_]+)/g, 'route-test-id');
    const response = await request(method, path);
    assert.equal(response.status, 401, `${method} ${routePath} returned ${response.status}`);
  }
});

test('public API routes are exactly the reviewed list', () => {
  const actual = routes()
    .filter(([method, path]) => isPublicApiRoute(method, path))
    .map(([method, path]) => `${method} ${path}`)
    .sort();
  assert.deepEqual(actual, [
    'GET /api/analytics/related-products',
    'GET /api/analytics/top-rated-products',
    'GET /api/analytics/top-rated-sellers',
    'GET /api/analytics/trending-products',
    'GET /api/auth/me',
    'GET /api/bundles',
    'GET /api/categories',
    'GET /api/maps/reverse',
    'GET /api/payment/bkash/direct',
    'GET /api/payment/methods',
    'GET /api/payment/simulator',
    'GET /api/payment/sslcommerz/cancel',
    'GET /api/payment/sslcommerz/fail',
    'GET /api/payment/sslcommerz/success',
    'GET /api/products',
    'GET /api/products/:id',
    'GET /api/reviews',
    'GET /api/riders/payroll/settle',
    'GET /api/sellers',
    'POST /api/ai/chat',
    'POST /api/analytics/events',
    'POST /api/auth/login',
    'POST /api/auth/logout',
    'POST /api/customers',
    'POST /api/cron/expire-orders',
    'POST /api/cron/refunds',
    'POST /api/payment/simulator/complete',
    'POST /api/payment/sslcommerz/cancel',
    'POST /api/payment/sslcommerz/fail',
    'POST /api/payment/sslcommerz/ipn',
    'POST /api/payment/sslcommerz/success',
    'POST /api/riders/apply',
    'POST /api/riders/cv/format',
    'POST /api/riders/cv/parse',
    'POST /api/sellers',
    'POST /api/support/requests',
  ].sort());
  assert.equal(isPublicApiRoute('POST', '/api/payment/sslcommerz/validate'), false);
});

test('cron routes require a configured matching secret', async () => {
  for (const path of ['/api/cron/expire-orders', '/api/cron/refunds']) {
    const response = await request('POST', path);
    assert.ok([401, 503].includes(response.status), `${path} returned ${response.status}`);
  }
});

test('configured app origin is allowed for cookie-authenticated mutations only', async () => {
  const allowed = await request('POST', '/api/payment/simulator/complete', {}, {
    origin: new URL(process.env.APP_URL!).origin,
    cookie: 'shopniro_session=test-session',
  });
  assert.notEqual(allowed.status, 403, JSON.stringify(allowed.body));

  const blocked = await request('POST', '/api/payment/simulator/complete', {}, {
    origin: 'https://attacker.example',
    cookie: 'shopniro_session=test-session',
  });
  assert.equal(blocked.status, 403, JSON.stringify(blocked.body));
});

test('public login requests reach the login handler without a session', async () => {
  const response = await request('POST', '/api/auth/login', {});
  assert.notEqual(response.status, 401, JSON.stringify(response.body));
});

dbTest('guests can register and read the seller catalog without private seller fields', async () => {
  const registration = await request('POST', '/api/customers', {});
  assert.notEqual(registration.status, 401);

  const catalog = await request('GET', '/api/sellers');
  assert.equal(catalog.status, 200, JSON.stringify(catalog.body));
  for (const seller of catalog.body) {
    for (const field of ['Email', 'Number', 'Payout_Method', 'Payout_Account', 'email', 'number', 'payout_account']) {
      assert.equal(Object.hasOwn(seller, field), false, `guest seller response includes ${field}`);
    }
  }
});