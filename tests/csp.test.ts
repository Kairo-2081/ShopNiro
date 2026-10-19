import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContentSecurityPolicy } from '../server/middleware/csp.ts';

const asObject = (value: ReturnType<typeof buildContentSecurityPolicy>) => {
  assert.ok(value && typeof value === 'object');
  return value as { reportOnly?: boolean; directives: Record<string, string[]> };
};

test('CSP is disabled outside production', () => {
  assert.equal(buildContentSecurityPolicy(false, {}), false);
});

test('CSP is report-only by default in production', () => {
  assert.equal(asObject(buildContentSecurityPolicy(true, {})).reportOnly, true);
});

test('CSP_ENFORCE=true switches production CSP to enforcing', () => {
  const csp = asObject(buildContentSecurityPolicy(true, { CSP_ENFORCE: 'true' }));
  assert.equal(csp.reportOnly, false);
});

test('CSP never allows inline or eval scripts', () => {
  const { directives } = asObject(buildContentSecurityPolicy(true, {}));
  assert.deepEqual(directives.scriptSrc, ["'self'"]);
  assert.deepEqual(directives.objectSrc, ["'none'"]);
  assert.deepEqual(directives.frameAncestors, ["'none'"]);
});
