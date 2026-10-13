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

  test('sandbox payment initialization sends required shipping fields', () => {
    const script = `
      const { sslcommerz } = await import('./server/services/sslcommerz.service.ts');
      let requestUrl = '';
      let requestBody;
      globalThis.fetch = async (url, options) => {
        requestUrl = String(url);
        requestBody = new URLSearchParams(String(options.body));
        return new Response(JSON.stringify({ status: 'SUCCESS', GatewayPageURL: 'https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=demo' }), { status: 200 });
      };
      await sslcommerz.initPayment({
        tran_id: 'SSLCZ-TEST-1000', total_amount: 100, currency: 'BDT',
        cus_name: 'Sandbox Customer', cus_email: 'customer@example.com', cus_phone: '01700000000',
        cus_add1: '10 Test Street', cus_city: 'Dhaka', cus_postcode: '1200',
        ship_name: 'Sandbox Customer', ship_add1: '10 Test Street', ship_city: 'Dhaka',
        ship_postcode: '1200', ship_country: 'Bangladesh', product_name: 'Test order',
      }, 'http://localhost:3000');
      if (requestUrl !== 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php') throw new Error('Sandbox endpoint was not used.');
      for (const [key, expected] of Object.entries({ ship_name: 'Sandbox Customer', ship_add1: '10 Test Street', ship_city: 'Dhaka', ship_postcode: '1200', ship_country: 'Bangladesh' })) {
        if (requestBody.get(key) !== expected) throw new Error('Missing or incorrect ' + key + '.');
      }
    `;
    const result = spawnSync(process.execPath, [
      '--import', 'dotenv/config',
      '--import', 'tsx',
      '--input-type=module',
      '-e', script,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PAYMENT_SIMULATOR: 'false',
        SSLCOMMERZ_IS_SANDBOX: 'true',
        SSLCOMMERZ_STORE_ID: 'sandbox-store',
        SSLCOMMERZ_STORE_PASSWORD: 'sandbox-password',
      },
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
} finally {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;

  if (originalIpnToken === undefined) delete process.env.SSLCOMMERZ_IPN_TOKEN;
  else process.env.SSLCOMMERZ_IPN_TOKEN = originalIpnToken;
}
