import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactNumber, formatPercent, percentChange, shareOf, sum, trendOf } from '../src/components/charts/format.ts';

test('compactNumber keeps axis labels short', () => {
  assert.equal(compactNumber(0), '0');
  assert.equal(compactNumber(842), '842');
  assert.equal(compactNumber(1_250), '1.3k');
  assert.equal(compactNumber(2_000), '2k');
  assert.equal(compactNumber(48_400), '48k');
  assert.equal(compactNumber(2_400_000), '2.4m');
  assert.equal(compactNumber(Number.NaN), '0');
});

test('percentChange refuses to divide by zero', () => {
  assert.equal(percentChange(50, 0), null);
  assert.equal(percentChange(Number.NaN, 10), null);
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(75, 100), -25);
  assert.equal(percentChange(0, 100), -100);
});

test('formatPercent shows a sign and stays short', () => {
  assert.equal(formatPercent(12.44), '+12.4%');
  assert.equal(formatPercent(-3), '-3%');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(0.01), '0%');
  assert.equal(formatPercent(1234.5), '+1,235%');
});

test('trendOf treats tiny moves and missing data as flat', () => {
  assert.equal(trendOf(null), 'flat');
  assert.equal(trendOf(0.01), 'flat');
  assert.equal(trendOf(4), 'up');
  assert.equal(trendOf(-4), 'down');
});

test('sum ignores values that are not finite numbers', () => {
  assert.equal(sum([1, 2, Number.NaN, 3]), 6);
  assert.equal(sum([]), 0);
});

test('shareOf rounds to whole percent and handles an empty total', () => {
  assert.equal(shareOf(1, 3), 33);
  assert.equal(shareOf(2, 3), 67);
  assert.equal(shareOf(5, 0), 0);
});
