import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESTINATION_HUBS, GLOBE_VIEW, HOME_HUB, PARCEL_POSITIONS } from '../src/components/landing/globe/network.ts';
import { greatCircleAt, isVisible, project } from '../src/components/landing/globe/projection.ts';
import { isLand, landCells } from '../src/components/landing/globe/landMask.ts';

const close = (actual: number, expected: number, message: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);

test('the centre of the view projects to the middle of the disc, facing the viewer', () => {
  const point = project(GLOBE_VIEW.lon0, GLOBE_VIEW.lat0, GLOBE_VIEW);
  close(point.x, 0, 'x');
  close(point.y, 0, 'y');
  close(point.z, 1, 'z');
  assert.equal(isVisible(point), true);
});

test('the opposite side of the world is hidden, and a point lifted far above it can show past the rim', () => {
  const far = project(GLOBE_VIEW.lon0 + 180, -GLOBE_VIEW.lat0, GLOBE_VIEW);
  assert.ok(far.z < 0);
  assert.equal(isVisible(far), false);
  const nearRim = project(GLOBE_VIEW.lon0 + 100, GLOBE_VIEW.lat0, GLOBE_VIEW, 1.6);
  assert.equal(isVisible(nearRim), true);
});

test('every point on the surface lies on the unit sphere', () => {
  for (const [lon, lat] of [[0, 0], [90, 45], [-120, -30], [179, 80]]) {
    const { x, y, z } = project(lon, lat, GLOBE_VIEW);
    close(Math.hypot(x, y, z), 1, `radius at ${lon},${lat}`);
  }
});

test('a great circle starts at one hub, ends at the other, and stays equally far from both ends at its midpoint', () => {
  const to = DESTINATION_HUBS[0];
  const start = greatCircleAt(HOME_HUB, to, 0);
  const end = greatCircleAt(HOME_HUB, to, 1);
  close(start.lon, HOME_HUB.lon, 'start lon');
  close(start.lat, HOME_HUB.lat, 'start lat');
  close(end.lon, to.lon, 'end lon');
  close(end.lat, to.lat, 'end lat');
  const middle = project(...(Object.values(greatCircleAt(HOME_HUB, to, 0.5)) as [number, number]), GLOBE_VIEW);
  const a = project(HOME_HUB.lon, HOME_HUB.lat, GLOBE_VIEW);
  const b = project(to.lon, to.lat, GLOBE_VIEW);
  const dot = (p: typeof a, q: typeof a) => p.x * q.x + p.y * q.y + p.z * q.z;
  close(dot(middle, a), dot(middle, b), 'midpoint is equidistant');
});

test('Dhaka and every destination sit on the visible face of the still globe', () => {
  for (const hub of [HOME_HUB, ...DESTINATION_HUBS]) {
    const point = project(hub.lon, hub.lat, GLOBE_VIEW);
    assert.ok(point.z > 0.1, `${hub.name} should face the viewer (z=${point.z})`);
  }
});

test('each destination has a parcel position strictly between its two ends', () => {
  assert.equal(PARCEL_POSITIONS.length >= DESTINATION_HUBS.length, true);
  for (const position of PARCEL_POSITIONS) assert.ok(position > 0 && position < 1);
});

test('the land mask puts land where land is and open ocean where it is not', () => {
  assert.equal(isLand(HOME_HUB.lon, HOME_HUB.lat), true, 'Dhaka');
  assert.equal(isLand(10, 25), true, 'Sahara');
  assert.equal(isLand(-150, 0), false, 'central Pacific');
  assert.equal(isLand(-30, -30), false, 'South Atlantic');
  assert.ok(landCells().length > 500);
});
