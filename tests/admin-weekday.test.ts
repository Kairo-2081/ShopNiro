import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ordersByWeekday } from '../src/components/admin/weekdayOrders.ts';
import type { Order } from '../src/types.ts';

const order = (iso: string) => ({ Order_Placed_At: iso }) as Order;

test('ordersByWeekday counts the last 90 days, Saturday first, and ignores older or future orders', () => {
  const now = new Date('2026-11-18T12:00:00Z'); // a Wednesday
  const counts = ordersByWeekday(
    [order('2026-11-14T10:00:00Z'), order('2026-11-14T11:00:00Z'), order('2026-11-18T09:00:00Z'), order('2026-01-01T00:00:00Z'), order('2026-12-01T00:00:00Z'), order('nonsense')],
    now,
  );
  assert.equal(counts.length, 7);
  assert.equal(counts[0], 2); // Saturday 14 Nov
  assert.equal(counts[4], 1); // Wednesday 18 Nov
  assert.equal(counts.reduce((a, b) => a + b, 0), 3);
});
