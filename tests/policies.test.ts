import { FREE_SHIPPING_THRESHOLD_CENTS } from '../src/lib/checkoutPricing.ts';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { BUSINESS } from '../src/components/legal/business.ts';
import { POLICIES, policyByPath } from '../src/components/legal/policies.ts';

test('all four policy pages exist with unique paths', () => {
  assert.deepEqual(POLICIES.map((policy) => policy.path).sort(), ['/delivery', '/privacy', '/refunds', '/terms']);
  for (const policy of POLICIES) {
    assert.ok(policy.sections.length >= 4, `${policy.id} has substantive sections`);
    assert.equal(policyByPath(policy.path)?.id, policy.id);
    assert.equal(policyByPath(`${policy.path}/`)?.id, policy.id, 'trailing slash resolves');
  }
  assert.equal(policyByPath('/'), undefined);
  assert.equal(policyByPath('/api/orders'), undefined);
});

test('policy text quotes the same numbers the code enforces', () => {
  assert.equal(FREE_SHIPPING_THRESHOLD_CENTS, BUSINESS.freeShippingThresholdBDT * 100, 'free-shipping threshold');

  const schema = readdirSync('db/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(`db/migrations/${name}`, 'utf8'))
    .join('\n');
  assert.match(
    schema,
    new RegExp(`expire_pending_online_orders\\(p_minutes INT DEFAULT ${BUSINESS.unpaidOnlineOrderMinutes}\\)`),
    'unpaid-order expiry'
  );

  const text = JSON.stringify(POLICIES);
  assert.ok(text.includes(`${BUSINESS.freeShippingThresholdBDT}`));
  assert.ok(text.includes(`${BUSINESS.unpaidOnlineOrderMinutes} minutes`));
  assert.ok(text.includes(`${BUSINESS.sellerCommissionPercent}%`));
});

test('the policy pages promise a contact address', () => {
  assert.match(BUSINESS.supportEmail, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  for (const policy of POLICIES) {
    assert.ok(JSON.stringify(policy).includes(BUSINESS.supportEmail), `${policy.id} lists the support email`);
  }
});
