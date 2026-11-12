import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRuntimeConfiguration } from '../server/config/runtimeAssertions.ts';

const deployed = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(32),
  CRON_SECRET: 'b'.repeat(32),
  FRONTEND_URL: 'https://shopniro.example',
  PAYMENT_SIMULATOR: 'false',
};

test('requires NODE_ENV explicitly', () => {
  assert.throws(() => assertRuntimeConfiguration({}), /NODE_ENV must be set explicitly/);
});

test('allows explicit development and test defaults', () => {
  assert.doesNotThrow(() => assertRuntimeConfiguration({ NODE_ENV: 'development' }));
  assert.doesNotThrow(() => assertRuntimeConfiguration({ NODE_ENV: 'test' }));
});

test('requires a distinct deployed environment and production runtime mode', () => {
  assert.throws(() => assertRuntimeConfiguration({ ...deployed }), /SHOPNIRO_ENV must be set/);
  assert.throws(() => assertRuntimeConfiguration({ ...deployed, SHOPNIRO_ENV: 'production', NODE_ENV: 'staging' }), /NODE_ENV must be development, test, or production/);
});

test('requires strong app and cron secrets plus an HTTPS frontend origin', () => {
  assert.throws(() => assertRuntimeConfiguration({ ...deployed, SHOPNIRO_ENV: 'production', JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => assertRuntimeConfiguration({ ...deployed, SHOPNIRO_ENV: 'production', CRON_SECRET: 'short' }), /CRON_SECRET/);
  assert.throws(() => assertRuntimeConfiguration({ ...deployed, SHOPNIRO_ENV: 'production', FRONTEND_URL: 'http://shopniro.example' }), /HTTPS origin/);
});

test('production refuses sandbox gateway mode and the payment simulator', () => {
  assert.throws(() => assertRuntimeConfiguration({
    ...deployed,
    SHOPNIRO_ENV: 'production',
    SSLCOMMERZ_IS_SANDBOX: 'true',
  }), /sandbox payments are prohibited/);
  assert.throws(() => assertRuntimeConfiguration({
    ...deployed,
    SHOPNIRO_ENV: 'production',
    SSLCOMMERZ_IS_SANDBOX: 'false',
    PAYMENT_SIMULATOR: 'true',
  }), /PAYMENT_SIMULATOR/);
  assert.doesNotThrow(() => assertRuntimeConfiguration({
    ...deployed,
    SHOPNIRO_ENV: 'production',
    SSLCOMMERZ_IS_SANDBOX: 'false',
  }));
});

test('staging requires sandbox-demo mode and rejects the simulator', () => {
  assert.doesNotThrow(() => assertRuntimeConfiguration({
    ...deployed,
    SHOPNIRO_ENV: 'staging',
    SSLCOMMERZ_IS_SANDBOX: 'true',
    PAYMENT_MODE: 'sandbox-demo',
  }));
  assert.throws(() => assertRuntimeConfiguration({
    ...deployed,
    SHOPNIRO_ENV: 'staging',
    SSLCOMMERZ_IS_SANDBOX: 'false',
    PAYMENT_MODE: 'sandbox-demo',
  }), /isolated SSLCommerz sandbox credentials/);
  assert.throws(() => assertRuntimeConfiguration({
    ...deployed,
    SHOPNIRO_ENV: 'staging',
    SSLCOMMERZ_IS_SANDBOX: 'true',
    PAYMENT_MODE: 'sandbox-demo',
    PAYMENT_SIMULATOR: 'true',
  }), /PAYMENT_SIMULATOR/);
});
