import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareRows } from '../src/components/charts/breakdown.ts';

test('shareRows labels always add up to 100', () => {
  const rows = shareRows([1, 1, 1]);
  assert.deepEqual(rows.map((row) => row.label), [34, 33, 33]);
  assert.equal(rows.reduce((a, row) => a + row.label, 0), 100);
  const uneven = shareRows([5, 3, 2, 1, 1]);
  assert.equal(uneven.reduce((a, row) => a + row.label, 0), 100);
});

test('shareRows keeps exact percentages for the ribbon', () => {
  const [a, b] = shareRows([1, 3]);
  assert.equal(a.percent, 25);
  assert.equal(b.percent, 75);
});

test('shareRows treats empty, negative and invalid values as zero without NaN', () => {
  assert.deepEqual(shareRows([]), []);
  assert.deepEqual(shareRows([0, 0]), [{ percent: 0, label: 0 }, { percent: 0, label: 0 }]);
  const rows = shareRows([4, -2, Number.NaN, 4]);
  assert.deepEqual(rows.map((row) => row.label), [50, 0, 0, 50]);
});

test('a zero value never gains a label point from rounding', () => {
  assert.equal(shareRows([1, 0, 1, 1])[1].label, 0);
});
