import assert from 'node:assert/strict';
import test from 'node:test';
import { countUpValue, easeOutCubic } from '../src/components/motion/countUp.ts';

test('the easing runs from 0 to 1, fast at first and slower at the end', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
  assert.ok(easeOutCubic(0.9) - easeOutCubic(0.8) < easeOutCubic(0.2) - easeOutCubic(0.1));
  assert.equal(easeOutCubic(-3), 0);
  assert.equal(easeOutCubic(7), 1);
});

test('a count always ends exactly on its target and never overshoots', () => {
  assert.equal(countUpValue(0, 1234.5, 900, 900), 1234.5);
  assert.equal(countUpValue(0, 1234.5, 5000, 900), 1234.5);
  for (let elapsed = 0; elapsed <= 900; elapsed += 50) {
    const value = countUpValue(0, 1000, elapsed, 900);
    assert.ok(value >= 0 && value <= 1000);
  }
});

test('it can count down, start from the previous value and ignore bad input', () => {
  assert.ok(countUpValue(500, 100, 300, 900) < 500);
  assert.ok(countUpValue(500, 100, 300, 900) > 100);
  assert.equal(countUpValue(0, Number.NaN, 100, 900), 0);
  assert.equal(countUpValue(0, 50, 100, 0), 50);
});
