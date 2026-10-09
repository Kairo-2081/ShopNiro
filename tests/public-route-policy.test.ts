import test from 'node:test';
import assert from 'node:assert/strict';

import { isPublicApiRoute } from '../server/middleware/publicRoutes.ts';

test('public API routes are allowed without session auth', () => {
  assert.equal(isPublicApiRoute('/api/auth/login'), true);
  assert.equal(isPublicApiRoute('/api/auth/register'), true);
  assert.equal(isPublicApiRoute('/api/products'), true);
  assert.equal(isPublicApiRoute('/api/products/123'), true);
  assert.equal(isPublicApiRoute('/api/payment/methods'), true);
  assert.equal(isPublicApiRoute('/api/payment/sslcommerz/success'), true);
});

test('protected API routes default to authenticated access', () => {
  assert.equal(isPublicApiRoute('/api/orders'), false);
  assert.equal(isPublicApiRoute('/api/cart'), false);
  assert.equal(isPublicApiRoute('/api/admin/users'), false);
  assert.equal(isPublicApiRoute('/api/support/requests'), false);
});
