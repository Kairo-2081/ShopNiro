import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areaPath, smoothPath, sparklinePoints } from '../src/components/charts/sparkline.ts';

test('points span the box and the highest value is the highest point', () => {
  const points = sparklinePoints([1, 5, 3], 100, 40, 4);
  assert.equal(points.length, 3);
  assert.equal(points[0].x, 4);
  assert.equal(points[2].x, 96);
  assert.equal(points[1].y, 4); // the maximum touches the top padding
  assert.equal(points[0].y, 36); // the minimum touches the bottom padding
});

test('a flat or single-value series sits mid-height, never on an edge or NaN', () => {
  for (const values of [[7, 7, 7], [7]]) {
    for (const point of sparklinePoints(values, 100, 40)) {
      assert.equal(point.y, 20);
      assert.ok(Number.isFinite(point.x));
    }
  }
  assert.deepEqual(sparklinePoints([], 100, 40), []);
});

test('non-finite values are drawn as zero instead of breaking the path', () => {
  const points = sparklinePoints([Number.NaN, 4, Number.POSITIVE_INFINITY], 100, 40);
  assert.ok(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test('the smooth path never leaves the box vertically', () => {
  const height = 40;
  const points = sparklinePoints([0, 100, 0, 100, 0], 120, height);
  const numbers = smoothPath(points, height).match(/-?\d+(\.\d+)?/g)!.map(Number);
  // Every y value in "M x y" and "C x1 y1 x2 y2 x y" is at an odd position in the number list.
  const ys = numbers.filter((_, index) => index % 2 === 1);
  assert.ok(ys.every((y) => y >= 0 && y <= height), `y out of range: ${ys.join(',')}`);
});

test('the area path closes along the baseline and needs two points', () => {
  const points = sparklinePoints([1, 2, 3], 100, 40);
  const path = areaPath(points, 40);
  assert.ok(path.startsWith('M'));
  assert.ok(path.endsWith('Z'));
  assert.ok(path.includes('L97.00 40'), path);
  assert.equal(areaPath(sparklinePoints([1], 100, 40), 40), '');
});
