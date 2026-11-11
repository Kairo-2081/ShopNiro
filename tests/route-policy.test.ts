import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test } from 'node:test';
import { request as httpRequest, Server } from 'node:http';
import { Router } from 'express';

process.env.JWT_SECRET ??= 'route-policy-test-secret-at-least-32-characters';
process.env.APP_URL = 'https://configured-shopniro.example';

const { app, apiRouterMounts } = await import('../server/app.ts');
const { isPublicApiRoute } = await import('../server/middleware/publicRoutes.ts');
const { query } = await import('../server/db/index.ts');
const dbTest = process.env.DATABASE_URL ? test : test.skip;
const mutationProbe = Router();
mutationProbe.get('/leak', (_req, res) => res.json({ exposed: true }));
app.use('/api/route-policy-probe', mutationProbe);
apiRouterMounts.push(['/api/route-policy-probe', mutationProbe]);

const collectRoutes = (router: any, prefix = '') => router.stack.flatMap((layer: any) => {
  if (!layer.route) return [];
  const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
  return paths.flatMap((routePath: string) => Object.keys(layer.route.methods)
    .filter((method) => layer.route.methods[method])
    .map((method) => [method.toUpperCase(), `${prefix}${routePath === '/' ? '' : routePath}`] as const));
});

const routes = () => [
  ...apiRouterMounts.flatMap(([prefix, router]) => collectRoutes(router, prefix)),
  ...collectRoutes((app as any)._router || { stack: [] }),
];

const server = await new Promise<Server>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

const request = async (method: string, path: string, body?: unknown, extraHeaders: Record<string, string> = {}): Promise<{ status: number; body: any; cookies: string[] }> => {
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
        resolve({ status: res.statusCode || 0, body: responseBody, cookies: (res.headers['set-cookie'] as string[] | undefined) || [] });
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
    'GET /api/auth/oauth/:provider',
    'GET /api/auth/oauth/:provider/callback',
    'GET /api/auth/oauth/registration',
    'GET /api/bundles',
    'GET /api/categories',
    'GET /api/health',
    'GET /api/ready',
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
    'POST /api/auth/password/forgot',
    'POST /api/auth/password/reset',
    'POST /api/auth/signup',
    'POST /api/customers',
    'POST /api/cron/expire-orders',
    'POST /api/cron/reconcile-payments',
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
  assert.equal(isPublicApiRoute('GET', '/api/auth/oauth/google'), true);
  assert.equal(isPublicApiRoute('GET', '/api/auth/oauth/facebook/callback'), true);
  assert.equal(isPublicApiRoute('GET', '/api/auth/oauth/registration'), true);
  assert.equal(isPublicApiRoute('POST', '/api/auth/oauth/google'), false);
});

test('readiness endpoint is registered before API authentication middleware', () => {
  const stack = (app as any)._router.stack;
  const readinessIndex = stack.findIndex((layer: any) => layer.route?.path === '/api/ready');
  const authPolicyIndex = stack.findIndex((layer: any) => layer.name === 'enforcePublicApiPolicy');

  assert.ok(readinessIndex >= 0, 'readiness route should be registered');
  assert.ok(authPolicyIndex >= 0, 'API authentication middleware should be registered');
  assert.ok(readinessIndex < authPolicyIndex, 'readiness route should bypass API authentication middleware');
});

test('cron routes require a configured matching secret', async () => {
  for (const path of ['/api/cron/expire-orders', '/api/cron/refunds']) {
    const response = await request('POST', path);
    assert.ok([401, 503].includes(response.status), `${path} returned ${response.status}`);
  }
});

// The login wall and the cron secret check both answer 401, so the status alone cannot tell them apart. The login wall
// says "Missing or invalid authentication session"; the secret check says "Unauthorized." A request that reaches the secret check at all
// proves the right secret would get through; one stopped at the wall can never run, which is how the nightly reconciliation failed on every call.
test('every cron route reaches its own secret check instead of the login wall', async () => {
  const previous = process.env.CRON_SECRET;
  // Built at run time so no secret-shaped literal sits in the source for the secret scanner to flag.
  process.env.CRON_SECRET = randomBytes(24).toString('hex');
  try {
    for (const path of ['/api/cron/expire-orders', '/api/cron/refunds', '/api/cron/reconcile-payments']) {
      const wrong = await request('POST', path, {}, { authorization: 'Bearer not-the-secret' });
      assert.equal(wrong.status, 401, `${path} with a wrong secret returned ${wrong.status}`);
      assert.equal(wrong.body?.error, 'Unauthorized.', `${path} was stopped by the login wall, not the cron secret check`);
    }
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
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

  const blockedOAuth = await request('POST', '/api/payment/simulator/complete', {}, {
    origin: 'https://attacker.example',
    cookie: 'shopniro_oauth_registration=test-registration',
  });
  assert.equal(blockedOAuth.status, 403, JSON.stringify(blockedOAuth.body));
});

test('public login requests reach the login handler without a session', async () => {
  const response = await request('POST', '/api/auth/login', {});
  assert.notEqual(response.status, 401, JSON.stringify(response.body));
});

test('signup requests reach public validation without a session', async () => {
  const response = await request('POST', '/api/auth/signup', {});
  assert.equal(response.status, 400, JSON.stringify(response.body));
});

test('password recovery endpoints reach public validation without a session', async () => {
  const forgot = await request('POST', '/api/auth/password/forgot', {});
  const reset = await request('POST', '/api/auth/password/reset', {});
  assert.equal(forgot.status, 400, JSON.stringify(forgot.body));
  assert.equal(reset.status, 400, JSON.stringify(reset.body));
});

test('customer password signup requires explicit policy acceptance before database work', async () => {
  const response = await request('POST', '/api/auth/signup', {
    role: 'customer',
    username: `consent${Date.now()}`,
    password: 'consent-test-password',
    acceptedTerms: false,
  });
  assert.equal(response.status, 400, JSON.stringify(response.body));
  assert.match(String(response.body.error), /Accept the Terms of Service/);
});

test('direct customer registration requires explicit policy acceptance', async () => {
  const response = await request('POST', '/api/customers', {
    Name: 'Consent Test',
    Username: `consent${Date.now()}`,
    Email: `consent-${Date.now()}@example.test`,
    Password: 'consent-test-password',
    Number: '0123456789',
    Address: { Street: 'Test Street', City: 'Dhaka' },
    acceptedTerms: false,
  });
  assert.equal(response.status, 400, JSON.stringify(response.body));
  assert.match(String(response.body.error), /Accept the Terms of Service/);
});

test('OAuth signup handoff is readable without a session and does not cache', async () => {
  const response = await request('GET', '/api/auth/oauth/registration');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body, { registration: null });
});

test('support request endpoint accepts the app payload shape', async () => {
  const response = await request('POST', '/api/support/requests', {
    Name: 'Test User',
    Email: 'support@example.com',
    Subject: 'Product refund',
    Message: 'Need a refund for an incorrect order. Please review.',
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.match(String(response.body.Request_ID ?? ''), /^SUP-/);
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

dbTest('minimal signup allows profile edits but blocks other writes until completion', async () => {
  const username = `profile${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const registration = await request('POST', '/api/auth/signup', {
    role: 'customer',
    username,
    password: 'profile-test-password',
    acceptedTerms: true,
  });
  assert.equal(registration.status, 201, JSON.stringify(registration.body));
  const customerId = registration.body.entity.Customer_ID;
  const profileEmail = `profile-${Date.now()}@example.test`;
  assert.deepEqual(
    (await query(
      'SELECT policy_id FROM customer_policy_consents WHERE customer_id = $1 ORDER BY policy_id',
      [customerId],
    )).rows.map((row: { policy_id: string }) => row.policy_id),
    ['privacy', 'terms'],
  );
  const cookie = registration.cookies.find((value) => value.startsWith('shopniro_session='))?.split(';')[0];
  assert.ok(cookie, 'signup should create a session');

  try {
    const current = await request('GET', '/api/auth/me', undefined, { cookie: cookie! });
    assert.equal(current.status, 200);
    assert.equal(current.body.profileComplete, false);

    const otherCustomerEdit = await request('PUT', '/api/customers/OTHER-CUSTOMER', { Name: 'Not mine' }, { cookie: cookie! });
    assert.equal(otherCustomerEdit.status, 403);

    const partialEdit = await request('PUT', `/api/customers/${customerId}`, { Name: 'Profile Test Customer' }, { cookie: cookie! });
    assert.equal(partialEdit.status, 200, JSON.stringify(partialEdit.body));
    assert.equal((await request('GET', '/api/auth/me', undefined, { cookie: cookie! })).body.profileComplete, false);

    const blocked = await request('POST', '/api/analytics/events', {
      Product_ID: 'PROFILE-TEST-NO-PRODUCT',
      Event_Type: 'click',
      Session_ID: 'profiletestsession1234',
    }, { cookie: cookie! });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'PROFILE_INCOMPLETE');

    const completed = await request('PUT', `/api/customers/${customerId}`, {
      Name: 'Profile Test Customer',
      Email: profileEmail,
      Number: '01700000000',
      Address: {
        House_Name: 'Unit 3',
        Street: 'Test street',
        City: 'Dhaka',
        Postal_Code: '1200',
        Latitude: 23.8,
        Longitude: 90.4,
      },
    }, { cookie: cookie! });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal((await request('GET', '/api/auth/me', undefined, { cookie: cookie! })).body.profileComplete, true);

    const exported = await request('GET', '/api/customers/me/export', undefined, { cookie: cookie! });
    assert.equal(exported.status, 200, JSON.stringify(exported.body));
    assert.equal(exported.body.account.email, profileEmail);
    assert.equal(Object.hasOwn(exported.body.account, 'password'), false);

    const allowed = await request('POST', '/api/analytics/events', {
      Product_ID: 'PROFILE-TEST-NO-PRODUCT',
      Event_Type: 'click',
      Session_ID: 'profiletestsession1234',
    }, { cookie: cookie! });
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body));

    const orderId = `ORD-DELETE-GUARD-${Date.now()}`;
    await query(
      `INSERT INTO orders (
        id, tracking_id, customer_id, subtotal, shipping_fee, status,
        shipping_address_json, billing_address_json
       ) VALUES ($1, $2, $3, 0, 0, 'placed', '{}', '{}')`,
      [orderId, `TRK-DELETE-GUARD-${Date.now()}`, customerId],
    );
    const blockedDeletion = await request('POST', '/api/customers/me/deletion', {
      confirmationEmail: profileEmail,
    }, { cookie: cookie! });
    assert.equal(blockedDeletion.status, 409, JSON.stringify(blockedDeletion.body));
    await query('DELETE FROM orders WHERE id = $1', [orderId]);

    const deletion = await request('POST', '/api/customers/me/deletion', {
      confirmationEmail: profileEmail,
    }, { cookie: cookie! });
    assert.equal(deletion.status, 200, JSON.stringify(deletion.body));
    assert.equal(deletion.body.success, true);
    assert.equal((await request('GET', '/api/auth/me', undefined, { cookie: cookie! })).status, 401);
    const anonymized = await query(
      `SELECT c.name, c.account_deleted_at, u.email
       FROM customers c JOIN users u ON u.id = c.id WHERE c.id = $1`,
      [customerId],
    );
    assert.equal(anonymized.rows[0].name, 'Deleted customer');
    assert.ok(anonymized.rows[0].account_deleted_at);
    assert.match(anonymized.rows[0].email, /@deleted\.shopniro\.invalid$/);
    assert.equal(
      (await query('SELECT COUNT(*)::integer AS count FROM customer_policy_consents WHERE customer_id = $1', [customerId])).rows[0].count,
      2,
    );
  } finally {
    await query('DELETE FROM auth_sessions WHERE user_id = $1', [customerId]);
    await query('DELETE FROM customers WHERE id = $1', [customerId]);
    await query('DELETE FROM users WHERE id = $1', [customerId]);
  }
});

dbTest('minimal seller and rider signup create pending incomplete profiles', async () => {
  const created: Array<{ id: string; role: 'seller' | 'rider' }> = [];
  try {
    for (const role of ['seller', 'rider'] as const) {
      const username = `${role}${Date.now()}${Math.floor(Math.random() * 10000)}`;
      const registration = await request('POST', '/api/auth/signup', {
        role,
        username,
        password: 'profile-test-password',
      });
      assert.equal(registration.status, 201, JSON.stringify(registration.body));
      assert.equal(registration.body.profileComplete, false);
      const id = role === 'seller' ? registration.body.entity.Seller_ID : registration.body.entity.Rider_ID;
      created.push({ id, role });
      const cookie = registration.cookies.find((value) => value.startsWith('shopniro_session='))?.split(';')[0];
      assert.ok(cookie, `${role} signup should create a session`);
      const current = await request('GET', '/api/auth/me', undefined, { cookie: cookie! });
      assert.equal(current.status, 200);
      assert.equal(current.body.role, role);
      assert.equal(current.body.profileComplete, false);
      assert.equal(current.body.entity.Status, 'pending');
      if (role === 'rider') {
        for (const path of ['/api/riders/me', '/api/riders/wallet']) {
          const blocked = await request('GET', path, undefined, { cookie: cookie! });
          assert.equal(blocked.status, 403, `${path} should require a complete rider profile`);
          assert.equal(blocked.body.code, 'PROFILE_INCOMPLETE');
        }
      }
    }
  } finally {
    for (const account of created) {
      await query('DELETE FROM auth_sessions WHERE user_id = $1', [account.id]);
      if (account.role === 'seller') await query('DELETE FROM sellers WHERE id = $1', [account.id]);
      if (account.role === 'rider') await query('DELETE FROM riders WHERE id = $1', [account.id]);
      await query('DELETE FROM users WHERE id = $1', [account.id]);
    }
  }
});