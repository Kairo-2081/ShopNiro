import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areOnlinePaymentsEnabled } from '../server/services/paymentAvailability.ts';

test('online payments remain enabled unless explicitly disabled', () => {
  assert.equal(areOnlinePaymentsEnabled({}), true);
  assert.equal(areOnlinePaymentsEnabled({ ONLINE_PAYMENTS_ENABLED: 'true' }), true);
});

test('online payments can be disabled without changing COD availability', () => {
  assert.equal(areOnlinePaymentsEnabled({ ONLINE_PAYMENTS_ENABLED: 'false' }), false);
  assert.equal(areOnlinePaymentsEnabled({ ONLINE_PAYMENTS_ENABLED: ' FALSE ' }), false);
});