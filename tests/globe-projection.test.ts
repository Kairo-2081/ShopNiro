import assert from 'node:assert/strict';
import test from 'node:test';
import { greatCircleAt, isVisible, project, routePoints } from '../src/components/landing/globe/projection.ts';

const view = { lon0: 82, lat0: 20 };

test('the point at the centre of the view projects to the middle of the disc, facing the viewer', () => {
  const p = project(82, 20, view);
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.ok(Math.abs(p.y) < 1e-9);
  assert.ok(Math.abs(p.z - 1) < 1e-9);
});

test('surface points always land on the unit circle', () => {
  for (const [lon, lat] of [[0, 0], [-120, 40], [170, -30], [90.4, 23.8]]) {
    const p = project(lon, lat, view);
    assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-9);
  }
});

test('east of the centre is to the right and north of it is up', () => {
  assert.ok(project(100, 20, view).x > 0);
  assert.ok(project(60, 20, view).x < 0);
  assert.ok(project(82, 40, view).y > 0);
  assert.ok(project(82, 0, view).y < 0);
});

test('the far side of the world is hidden, and the near side is visible', () => {
  assert.equal(isVisible(project(-98, -20, view)), false);
  assert.equal(isVisible(project(90.4, 23.8, view)), true);
});

test('a lifted point behind the horizon is still visible once it clears the outline', () => {
  assert.equal(isVisible({ x: 1.1, y: 0, z: -0.1 }), true);
  assert.equal(isVisible({ x: 0.3, y: 0.2, z: -0.5 }), false);
});

test('a great circle starts and ends where it should and bows towards the pole', () => {
  const dhaka = { lon: 90.4, lat: 23.8 };
  const tokyo = { lon: 139.7, lat: 35.7 };
  const start = greatCircleAt(dhaka, tokyo, 0);
  const end = greatCircleAt(dhaka, tokyo, 1);
  assert.ok(Math.abs(start.lon - dhaka.lon) < 1e-6 && Math.abs(start.lat - dhaka.lat) < 1e-6);
  assert.ok(Math.abs(end.lon - tokyo.lon) < 1e-6 && Math.abs(end.lat - tokyo.lat) < 1e-6);
  const middle = greatCircleAt(dhaka, tokyo, 0.5);
  assert.ok(middle.lat > (dhaka.lat + tokyo.lat) / 2, 'the shortest path arcs poleward of the straight latitude average');
});

test('route arcs rise in the middle and touch the surface at both ends', () => {
  const points = routePoints({ lon: 90.4, lat: 23.8 }, { lon: 55.3, lat: 25.2 }, view, 0.2, 20);
  assert.equal(points.length, 21);
  const radius = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z);
  assert.ok(Math.abs(radius(points[0]) - 1) < 1e-9);
  assert.ok(Math.abs(radius(points[20]) - 1) < 1e-9);
  assert.ok(radius(points[10]) > 1.19);
});
