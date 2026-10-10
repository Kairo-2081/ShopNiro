import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const originalNodeEnv = process.env.NODE_ENV;
const originalIpnToken = process.env.SSLCOMMERZ_IPN_TOKEN;

try {
  test('development uses the local IPN token only in an explicit development environment', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SSLCOMMERZ_IPN_TOKEN;

    const { sslcommerz } = await import('../server/services/sslcommerz.service.ts');

    assert.equal(typeof sslcommerz.getIpnToken(), 'string');
    assert.ok(sslcommerz.getIpnToken().length > 0);
    assert.equal(sslcommerz.getIpnToken(), 'dev-local-sslcommerz-ipn-token');
  });

  test('production-like startup refuses to run without an IPN token', () => {
    const result = spawnSync(process.execPath, [
      '--import', 'dotenv/config',
      '--import', 'tsx',
      '--input-type=module',
      '-e', "await import('./server/services/sslcommerz.service.ts')",
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SSLCOMMERZ_IS_SANDBOX: 'false',
        PAYMENT_SIMULATOR: 'false',
        SSLCOMMERZ_STORE_ID: 'test-production-store',
        SSLCOMMERZ_STORE_PASSWORD: 'test-production-password',
        SSLCOMMERZ_IPN_TOKEN: '',
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /SSLCOMMERZ_IPN_TOKEN/);
  });

  const runGuard = (extra: Record<string, string>) => spawnSync(process.execPath, [
    '--import', 'dotenv/config',
    '--import', 'tsx',
    '--input-type=module',
    '-e', "await import('./server/services/sslcommerz.service.ts'); process.exit(0)",
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PAYMENT_SIMULATOR: 'false',
      SSLCOMMERZ_STORE_ID: 'demo-store',
      SSLCOMMERZ_STORE_PASSWORD: 'demo-password',
      SSLCOMMERZ_IPN_TOKEN: 'demo-ipn-token-1234567890',
      ...extra,
    },
  });

  test('sandbox-demo mode refuses a live (non-sandbox) gateway', () => {
    const result = runGuard({ PAYMENT_MODE: 'sandbox-demo', SSLCOMMERZ_IS_SANDBOX: 'false' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /sandbox-demo requires/);
  });

  test('sandbox-demo mode boots only with sandbox credentials', () => {
    const result = runGuard({ PAYMENT_MODE: 'sandbox-demo', SSLCOMMERZ_IS_SANDBOX: 'true' });
    assert.equal(result.status, 0, result.stderr);
  });

  test('production without the demo flag still rejects sandbox mode', () => {
    const result = runGuard({ SSLCOMMERZ_IS_SANDBOX: 'true' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /SSLCOMMERZ_IS_SANDBOX=false/);
  });
} finally {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;

  if (originalIpnToken === undefined) delete process.env.SSLCOMMERZ_IPN_TOKEN;
  else process.env.SSLCOMMERZ_IPN_TOKEN = originalIpnToken;
}
