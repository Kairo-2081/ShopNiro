import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { request as httpRequest, Server } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';

process.env.JWT_SECRET ??= 'password-recovery-test-secret-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 'password-recovery-test-key';
process.env.SHOPNIRO_FROM_EMAIL = 'ShopNiro <test@example.test>';
process.env.SHOPNIRO_PUBLIC_URL = 'https://shopniro.example.test';

const dbTest = process.env.DATABASE_URL ? test : test.skip;
const { app } = await import('../server/app.ts');
const { pool } = await import('../server/db/index.ts');
const { comparePassword, hashPassword } = await import('../server/db/password.ts');
const { isPasswordResetEmailConfigured, sendPasswordResetEmail } = await import('../server/services/email.service.ts');

const server = await new Promise<Server>((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});

const realFetch = globalThis.fetch;
const sentEmails: Array<Record<string, any>> = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input instanceof URL ? input.href : input?.url ?? input);
  if (url === 'https://api.resend.com/emails') {
    sentEmails.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;

const run = randomUUID().replaceAll('-', '');
const userId = `PWD-${randomUUID()}`;
const accountEmail = `password-recovery-${run}@example.test`;
let nextClient = 1;

interface RawResponse {
  status: number;
  cookies: string[];
  body: any;
}

const rawRequest = (method: string, path: string, body?: unknown): Promise<RawResponse> => {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP address.');
  return new Promise((resolve, reject) => {
    const requestBody = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        origin: 'http://localhost',
        connection: 'close',
        'x-forwarded-for': `198.51.100.${nextClient++ % 250 + 1}`,
        ...(requestBody ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(requestBody) } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let responseBody: any = text || null;
        try { if (text) responseBody = JSON.parse(text); } catch { /* keep text */ }
        resolve({
          status: res.statusCode || 0,
          cookies: (res.headers['set-cookie'] as string[] | undefined) ?? [],
          body: responseBody,
        });
      });
    });
    req.on('error', reject);
    if (requestBody) req.write(requestBody);
    req.end();
  });
};

after(async () => {
  globalThis.fetch = realFetch;
  if (process.env.DATABASE_URL) {
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('password recovery emails include the configured site and a fragment-only reset token', async () => {
  const token = randomUUID().replaceAll('-', '').padEnd(43, 'x');
  const sent = await sendPasswordResetEmail({ email: 'person@example.test', token });
  assert.equal(sent, true);
  assert.equal(isPasswordResetEmailConfigured(), true);
  assert.deepEqual(sentEmails.at(-1)?.to, ['person@example.test']);
  const link = String(sentEmails.at(-1)?.text).match(/https:\/\/\S+/)?.[0];
  assert.ok(link);
  const resetUrl = new URL(link);
  assert.equal(resetUrl.origin, 'https://shopniro.example.test');
  assert.equal(new URLSearchParams(resetUrl.hash.slice(resetUrl.hash.indexOf('?') + 1)).get('token'), token);
});

dbTest('password recovery emails a generic single-use link and revokes sessions after reset', async () => {
  sentEmails.length = 0;
  const oldPasswordHash = await hashPassword('OldPassword123!');
  await pool.query(
    'INSERT INTO users (id, username, password, email, role) VALUES ($1, $2, $3, $4, $5)',
    [userId, `recovery_${run.slice(0, 20)}`, oldPasswordHash, accountEmail, 'customer'],
  );
  const sessionId = randomUUID();
  await pool.query(
    'INSERT INTO auth_sessions (jti, user_id, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'1 hour\')',
    [sessionId, userId],
  );

  const recovery = await rawRequest('POST', '/api/auth/password/forgot', { email: accountEmail });
  const unknownAccount = await rawRequest('POST', '/api/auth/password/forgot', { email: `missing-${run}@example.test` });
  assert.equal(recovery.status, 202);
  assert.deepEqual(recovery.body, unknownAccount.body);
  assert.equal(sentEmails.length, 1);
  assert.deepEqual(sentEmails[0].to, [accountEmail]);

  const tokenMatch = String(sentEmails[0].text).match(/#\/reset-password\?token=([A-Za-z0-9_-]+)/);
  assert.ok(tokenMatch, 'email contains a fragment-based reset link');
  const token = tokenMatch[1];
  assert.equal(new URL(String(sentEmails[0].text).match(/https:\/\/\S+/)?.[0] || '').origin, 'https://shopniro.example.test');

  const storedToken = await pool.query<{ token_hash: string }>(
    'SELECT token_hash FROM password_reset_tokens WHERE user_id = $1',
    [userId],
  );
  assert.equal(storedToken.rows[0]?.token_hash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(storedToken.rows[0]?.token_hash, token);

  const newPassword = 'NewPassword456!';
  const reset = await rawRequest('POST', '/api/auth/password/reset', { token, password: newPassword });
  assert.equal(reset.status, 200);
  assert.ok(reset.cookies.some((cookie) => cookie.startsWith('shopniro_session=') && cookie.includes('Max-Age=0')));

  const changedUser = await pool.query<{ password: string }>('SELECT password FROM users WHERE id = $1', [userId]);
  assert.equal(await comparePassword(newPassword, changedUser.rows[0].password), true);
  assert.equal(await comparePassword('OldPassword123!', changedUser.rows[0].password), false);
  const revokedSession = await pool.query<{ revoked_at: Date | null }>(
    'SELECT revoked_at FROM auth_sessions WHERE jti = $1',
    [sessionId],
  );
  assert.ok(revokedSession.rows[0]?.revoked_at);

  const replay = await rawRequest('POST', '/api/auth/password/reset', { token, password: 'AnotherPassword789!' });
  assert.equal(replay.status, 400);
});
