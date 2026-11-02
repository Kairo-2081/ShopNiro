import assert from 'node:assert/strict';
import { test } from 'node:test';
import { money } from '../src/lib/format.ts';

test('money consistently formats BDT with two decimal places and locale rounding', () => {
  const cases: Array<[number, string]> = [
    [0, 'BDT\u00a00.00'],
    [129.5, 'BDT\u00a0129.50'],
    [3947.97, 'BDT\u00a03,947.97'],
    [1.005, 'BDT\u00a01.01'],
    [-5.2, '-BDT\u00a05.20'],
  ];

  for (const [amount, expected] of cases) {
    assert.equal(money(amount), expected);
  }
});
