import assert from 'node:assert/strict';
import { test } from 'node:test';

const originalNodeEnv = process.env.NODE_ENV;
const originalIpnToken = process.env.SSLCOMMERZ_IPN_TOKEN;

try {
  test('SSLCommerz falls back to a dev IPN token when no env var is set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SSLCOMMERZ_IPN_TOKEN;

    const { sslcommerz } = await import('../server/services/sslcommerz.service.ts');

    assert.equal(typeof sslcommerz.getIpnToken(), 'string');
    assert.ok(sslcommerz.getIpnToken().length > 0);
    assert.equal(sslcommerz.getIpnToken(), 'dev-local-sslcommerz-ipn-token');
  });
} finally {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;

  if (originalIpnToken === undefined) delete process.env.SSLCOMMERZ_IPN_TOKEN;
  else process.env.SSLCOMMERZ_IPN_TOKEN = originalIpnToken;
}
