import assert from 'node:assert/strict';
import test from 'node:test';
import { isLand, landCells, LAND_COLUMNS, LAND_ROWS } from '../src/components/landing/globe/landMask.ts';

test('places that are plainly land are land', () => {
  assert.equal(isLand(90.4, 23.8), true, 'Dhaka');
  assert.equal(isLand(2.35, 48.85), true, 'Paris');
  assert.equal(isLand(10, 20), true, 'the Sahara');
  assert.equal(isLand(-100, 40), true, 'the American Midwest');
  assert.equal(isLand(135, -25), true, 'central Australia');
});

test('places that are plainly sea are sea', () => {
  assert.equal(isLand(-150, 0), false, 'the Pacific');
  assert.equal(isLand(88, 12), false, 'the Bay of Bengal');
  assert.equal(isLand(70, -20), false, 'the Indian Ocean');
  assert.equal(isLand(-30, 30), false, 'the Atlantic');
});

test('the bitmap has a believable share of land and none south of the cut-off', () => {
  const cells = landCells();
  const share = cells.length / (LAND_COLUMNS * LAND_ROWS);
  assert.ok(share > 0.18 && share < 0.3, `land share ${share.toFixed(3)} should be about a quarter of the cells`);
  assert.equal(cells.some((cell) => cell.lat < -58), false);
});
