import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { request as httpRequest, Server } from 'node:http';

process.env.JWT_SECRET ??= 'oauth-signin-test-secret-at-least-32-characters';
process.env.APP_URL = 'https://api.shopniro.test';
process.env.SHOPNIRO_PUBLIC_URL = 'https://app.shopniro.test';
process.env.GOOGLE_CLIENT_ID = 'google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const { app } = await import('../server/app.ts');
const { pool } = await import('../server/db/index.ts');

const server = await new Promise<Server>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

const realFetch = globalThis.fetch;
let googleProfile: Record<string, unknown> = {};
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input instanceof URL ? input.href : input?.url ?? input);
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 });
  }
  if (url.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) {
    return new Response(JSON.stringify(googleProfile), { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;

const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const ids: string[] = [];
const email = (label: string) => `oauth-${label}-${run}@example.test`;

after(async () => {
  globalThis.fetch = realFetch;
  if (process.env.DATABASE_URL) {
    await pool.query(
      `DELETE FROM users WHERE lower(email) LIKE $1 OR id = ANY($2::text[])`,
      [`oauth-%-${run}@example.test`, ids],
    );
  }
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

interface RawResponse { status: number; location: string | null; cookies: string[]; body: any }

let nextClient = 1;
const rawRequest = (method: string, path: string, headers: Record<string, string> = {}): Promise<RawResponse> => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.');
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      // trust proxy is 1, so a distinct forwarded address gives each request its own rate-limit bucket.
      headers: { origin: 'http://localhost', connection: 'close', 'x-forwarded-for': `198.51.100.${nextClient++ % 250 + 1}`, ...headers },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body: any = text || null;
        try { if (text) body = JSON.parse(text); } catch { /* keep text */ }
        resolve({
          status: res.statusCode || 0,
          location: (res.headers.location as string | undefined) ?? null,
          cookies: (res.headers['set-cookie'] as string[] | undefined) ?? [],
          body,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
};

const callback = (role: 'customer' | 'seller' | 'rider', profile: Record<string, unknown>) => {
  googleProfile = { email_verified: true, name: 'Test Person', ...profile };
  const state = `state-${Math.random().toString(36).slice(2)}`;
  return rawRequest(
    'GET',
    `/api/auth/oauth/google/callback?state=${state}&code=auth-code`,
    { cookie: `shopniro_oauth_state_google=${encodeURIComponent(`${state}.${role}`)}` },
  );
};

const redirectParams = (response: RawResponse) => new URL(response.location!).searchParams;
const cookieValue = (response: RawResponse, name: string) =>
  response.cookies.find((cookie) => cookie.startsWith(`${name}=`))?.split(';')[0].slice(name.length + 1) ?? '';
const hasSession = (response: RawResponse) =>
  response.cookies.some((cookie) => cookie.startsWith('shopniro_session=') && !cookie.includes('Max-Age=0'));

test('OAuth start redirects to Google with a state cookie and requested role', async () => {
  const response = await rawRequest('GET', '/api/auth/oauth/google?role=seller');
  assert.equal(response.status, 302);
  const target = new URL(response.location!);
  assert.equal(target.origin, 'https://accounts.google.com');
  assert.equal(target.searchParams.get('client_id'), 'google-client-id');
  assert.equal(target.searchParams.get('redirect_uri'), 'https://api.shopniro.test/api/auth/oauth/google/callback');
  const state = target.searchParams.get('state');
  assert.ok(state && state.length >= 32);
  const stateCookie = decodeURIComponent(cookieValue(response, 'shopniro_oauth_state_google'));
  assert.equal(stateCookie, `${state}.seller`);
  assert.ok(response.cookies.find((cookie) => cookie.startsWith('shopniro_oauth_state_google='))?.includes('HttpOnly'));
});

test('OAuth start with an unknown role falls back to customer', async () => {
  const response = await rawRequest('GET', '/api/auth/oauth/google?role=admin');
  const stateCookie = decodeURIComponent(cookieValue(response, 'shopniro_oauth_state_google'));
  assert.ok(stateCookie.endsWith('.customer'));
});

test('OAuth routes for unknown providers are not public', async () => {
  const response = await rawRequest('GET', '/api/auth/oauth/github');
  assert.equal(response.status, 401);
  assert.equal(response.location, null);
});

test('OAuth start is rate limited per client address', async () => {
  const headers = { 'x-forwarded-for': '203.0.113.77' };
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) statuses.push((await rawRequest('GET', '/api/auth/oauth/google?role=customer', headers)).status);
  assert.equal(statuses.filter((status) => status === 302).length, 20);
  assert.ok(statuses.slice(20).every((status) => status === 429));
});

test('callback rejects a missing or mismatched state', async () => {
  const noCookie = await rawRequest('GET', '/api/auth/oauth/google/callback?state=abc&code=x');
  assert.equal(redirectParams(noCookie).get('oauth_error'), 'oauth_failed');
  assert.equal(hasSession(noCookie), false);

  const mismatch = await rawRequest('GET', '/api/auth/oauth/google/callback?state=other&code=x', {
    cookie: `shopniro_oauth_state_google=${encodeURIComponent('expected.customer')}`,
  });
  assert.equal(redirectParams(mismatch).get('oauth_error'), 'oauth_failed');
  assert.equal(hasSession(mismatch), false);
});

test('callback reports a cancelled sign-in', async () => {
  const response = await rawRequest('GET', '/api/auth/oauth/google/callback?state=s1&error=access_denied', {
    cookie: `shopniro_oauth_state_google=${encodeURIComponent('s1.customer')}`,
  });
  assert.equal(redirectParams(response).get('oauth_error'), 'oauth_cancelled');
});

dbTest('unverified provider emails never create a session or account', async () => {
  const address = email('unverified');
  const response = await callback('customer', { sub: `g-${run}-unverified`, email: address, email_verified: false });
  assert.equal(redirectParams(response).get('oauth_error'), 'email_unverified');
  assert.equal(hasSession(response), false);
  const users = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [address]);
  assert.equal(users.rowCount, 0);
});

dbTest('a new customer is created once and the same identity signs in again', async () => {
  const address = email('customer');
  const sub = `g-${run}-customer`;
  const first = await callback('customer', { sub, email: address });
  assert.equal(first.status, 302);
  assert.equal(redirectParams(first).get('oauth_error'), null);
  assert.equal(hasSession(first), true);

  const created = await pool.query('SELECT id, role FROM users WHERE lower(email) = $1', [address]);
  assert.equal(created.rowCount, 1);
  assert.equal(created.rows[0].role, 'customer');
  assert.equal((await pool.query('SELECT 1 FROM customers WHERE id = $1', [created.rows[0].id])).rowCount, 1);

  const second = await callback('customer', { sub, email: address });
  assert.equal(hasSession(second), true);
  assert.equal((await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [address])).rowCount, 1);
  assert.equal((await pool.query('SELECT 1 FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2', ['google', sub])).rowCount, 1);
});

dbTest('concurrent first sign-ins create exactly one account', async () => {
  const address = email('race');
  const sub = `g-${run}-race`;
  const results = await Promise.all(Array.from({ length: 6 }, () => callback('customer', { sub, email: address })));
  assert.ok(results.every((response) => response.status === 302));
  assert.equal((await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [address])).rowCount, 1);
  assert.equal((await pool.query('SELECT 1 FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2', ['google', sub])).rowCount, 1);
});

dbTest('an existing seller signs in from the login screen and keeps the seller role', async () => {
  const address = email('seller');
  const id = `SEL-${run}-a`;
  ids.push(id);
  await pool.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, 'x', $3, 'seller')`, [id, `seller${run}a`, address]);
  await pool.query(`INSERT INTO sellers (id, name, status) VALUES ($1, 'Test Seller', 'approved')`, [id]);

  const response = await callback('customer', { sub: `g-${run}-seller`, email: address });
  assert.equal(hasSession(response), true);
  assert.equal(redirectParams(response).get('oauth_error'), null);
  const identity = await pool.query('SELECT user_id FROM oauth_identities WHERE provider = $1 AND provider_user_id = $2', ['google', `g-${run}-seller`]);
  assert.equal(identity.rows[0].user_id, id);
});

dbTest('seller application sign-up with no account hands off a registration cookie', async () => {
  const address = email('newseller');
  const response = await callback('seller', { sub: `g-${run}-newseller`, email: address, name: 'New Seller' });
  assert.equal(hasSession(response), false);
  assert.equal(redirectParams(response).get('oauth_signup'), 'seller');
  const registration = cookieValue(response, 'shopniro_oauth_registration');
  assert.ok(registration);
  assert.ok(response.cookies.find((cookie) => cookie.startsWith('shopniro_oauth_registration='))?.includes('HttpOnly'));
  assert.equal((await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [address])).rowCount, 0);

  const handoff = await rawRequest('GET', '/api/auth/oauth/registration', { cookie: `shopniro_oauth_registration=${registration}` });
  assert.equal(handoff.status, 200);
  assert.deepEqual(handoff.body.registration, {
    role: 'seller', provider: 'google', providerUserId: `g-${run}-newseller`, email: address, name: 'New Seller',
  });
  assert.equal(handoff.cookies.length, 0);
});

dbTest('registration handoff ignores a tampered cookie', async () => {
  const response = await rawRequest('GET', '/api/auth/oauth/registration', { cookie: 'shopniro_oauth_registration=not-a-token' });
  assert.deepEqual(response.body, { registration: null });
});

dbTest('rider application sign-up with no account hands off a registration cookie', async () => {
  const response = await callback('rider', { sub: `g-${run}-newrider`, email: email('newrider') });
  assert.equal(hasSession(response), false);
  assert.equal(redirectParams(response).get('oauth_signup'), 'rider');
});

dbTest('asking for the seller application with a rider email is a conflict', async () => {
  const address = email('rider');
  const id = `RDR-${run}-a`;
  ids.push(id);
  await pool.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, 'x', $3, 'rider')`, [id, `rider${run}a`, address]);
  await pool.query(`INSERT INTO riders (id, name, number, status) VALUES ($1, 'Test Rider', '01700000000', 'approved')`, [id]);

  const response = await callback('seller', { sub: `g-${run}-rider`, email: address });
  assert.equal(redirectParams(response).get('oauth_error'), 'account_conflict');
  assert.equal(hasSession(response), false);
  assert.equal((await pool.query('SELECT 1 FROM oauth_identities WHERE provider_user_id = $1', [`g-${run}-rider`])).rowCount, 0);
});

dbTest('admin accounts can never be claimed through OAuth', async () => {
  const address = email('admin');
  const id = `ADM-${run}-a`;
  ids.push(id);
  await pool.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, 'x', $3, 'admin')`, [id, `admin${run}a`, address]);

  const response = await callback('customer', { sub: `g-${run}-admin`, email: address });
  assert.equal(redirectParams(response).get('oauth_error'), 'account_conflict');
  assert.equal(hasSession(response), false);
  assert.equal((await pool.query('SELECT 1 FROM oauth_identities WHERE user_id = $1', [id])).rowCount, 0);
});

dbTest('suspended and rejected riders are refused at OAuth sign-in', async () => {
  for (const status of ['suspended', 'rejected']) {
    const address = email(`rider-${status}`);
    const id = `RDR-${run}-${status}`;
    ids.push(id);
    await pool.query(`INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, 'x', $3, 'rider')`, [id, `rider${status}${run}`, address]);
    await pool.query(`INSERT INTO riders (id, name, number, status) VALUES ($1, 'Test Rider', '01700000001', $2)`, [id, status]);

    const response = await callback('rider', { sub: `g-${run}-${status}`, email: address });
    assert.equal(redirectParams(response).get('oauth_error'), 'account_conflict', status);
    assert.equal(hasSession(response), false, status);
  }
});

dbTest('an identity already linked to one account cannot sign in as another', async () => {
  const address = email('linked');
  const sub = `g-${run}-linked`;
  const first = await callback('customer', { sub, email: address });
  assert.equal(hasSession(first), true);

  // Same Google subject now reports a different email; the linked account still wins.
  const second = await callback('customer', { sub, email: email('linked-other') });
  assert.equal(hasSession(second), true);
  assert.equal((await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email('linked-other')])).rowCount, 0);
});
