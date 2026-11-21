import assert from 'node:assert/strict';
import test from 'node:test';
import { monthBuckets, placedMonthKey } from '../src/components/charts/months.ts';

const now = new Date(2026, 10, 22); // 22 Nov 2026

test('a window ends on the current month and is oldest first', () => {
  const keys = monthBuckets(3, now).map((bucket) => bucket.key);
  assert.deepEqual(keys, ['2026-8', '2026-9', '2026-10']);
});

test('an offset of one year gives the same months a year earlier', () => {
  const keys = monthBuckets(3, now, 12).map((bucket) => bucket.key);
  assert.deepEqual(keys, ['2025-8', '2025-9', '2025-10']);
});

test('windows cross a year boundary and the preceding window does not overlap', () => {
  const current = monthBuckets(6, now).map((bucket) => bucket.key);
  const before = monthBuckets(6, now, 6).map((bucket) => bucket.key);
  assert.equal(current[0], '2026-5');
  assert.equal(before[5], '2026-4');
  assert.equal(before[0], '2025-11');
  assert.equal(new Set([...current, ...before]).size, 12);
});

test('invalid placed dates give no key', () => {
  assert.equal(placedMonthKey('not a date'), null);
  assert.equal(placedMonthKey('2026-11-05T10:00:00Z'), '2026-10');
});
