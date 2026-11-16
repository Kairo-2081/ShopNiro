import assert from 'node:assert/strict';
import test from 'node:test';
import { CITIES, HOME_CITY_ID, ROUTES, cityById } from '../src/components/landing/map/network.ts';
import { isInsideBangladesh, outlineBounds } from '../src/components/landing/map/outline.ts';
import { MAP_FRAME, pointOnRoute, project, routeControl } from '../src/components/landing/map/projection.ts';
import { BANGLADESH_RINGS } from '../src/components/landing/map/bangladeshOutline.ts';

test('the outline covers Bangladesh and not its neighbours', () => {
  const [west, south, east, north] = outlineBounds();
  assert.ok(west > 87.9 && west < 88.3, `west edge ${west}`);
  assert.ok(east > 92.5 && east < 92.8, `east edge ${east}`);
  assert.ok(south > 20.5 && south < 21.2, `south edge ${south}`);
  assert.ok(north > 26.4 && north < 26.8, `north edge ${north}`);
  assert.equal(isInsideBangladesh(90.4, 23.8), true, 'Dhaka');
  assert.equal(isInsideBangladesh(91.8, 24.9), true, 'Sylhet');
  assert.equal(isInsideBangladesh(88.36, 22.57), false, 'Kolkata, India');
  assert.equal(isInsideBangladesh(91.28, 23.83), false, 'Agartala, India');
  assert.equal(isInsideBangladesh(90.5, 20.8), false, 'the Bay of Bengal');
  assert.equal(isInsideBangladesh(93.5, 22.5), false, 'Myanmar');
});

test('the outline keeps the mainland and a few islands, and stays small', () => {
  assert.ok(BANGLADESH_RINGS.length >= 5 && BANGLADESH_RINGS.length <= 40, `${BANGLADESH_RINGS.length} rings`);
  const points = BANGLADESH_RINGS.reduce((sum, ring) => sum + ring.length / 2, 0);
  assert.ok(points > 300 && points < 1500, `${points} points`);
  for (const ring of BANGLADESH_RINGS) assert.equal(ring.length % 2, 0, 'rings are lon/lat pairs');
});

test('there are ten distinct cities, each on Bangladeshi land or on its coast', () => {
  assert.equal(CITIES.length, 10);
  assert.equal(new Set(CITIES.map((city) => city.id)).size, 10);
  assert.equal(new Set(CITIES.map((city) => city.name)).size, 10);
  for (const city of CITIES) {
    assert.ok(city.nameBn.length > 0, `${city.name} has a Bangla name`);
    // The outline is thinned to about a kilometre, so a coastal city may sit a hair outside it. Allow a few kilometres.
    const near = [0, 0.03, -0.03].some((dx) => [0, 0.03, -0.03].some((dy) => isInsideBangladesh(city.lon + dx, city.lat + dy)));
    assert.equal(near, true, `${city.name} is in Bangladesh`);
  }
  assert.ok(cityById(HOME_CITY_ID));
});

test('every route joins two known cities, once, and every city is on a route', () => {
  const seen = new Set<string>();
  for (const route of ROUTES) {
    cityById(route.from);
    cityById(route.to);
    assert.notEqual(route.from, route.to);
    const key = [route.from, route.to].sort().join('-');
    assert.equal(seen.has(key), false, `${key} is listed twice`);
    seen.add(key);
    assert.ok(Math.abs(route.bend) > 0 && Math.abs(route.bend) < 0.3, `${key} bends a sensible amount`);
    if (route.parcel !== undefined) assert.ok(route.parcel > 0.2 && route.parcel < 0.8);
  }
  for (const city of CITIES) {
    assert.ok(ROUTES.some((route) => route.from === city.id || route.to === city.id), `${city.name} has a route`);
  }
  const fromHome = ROUTES.filter((route) => route.from === HOME_CITY_ID).length;
  assert.equal(fromHome, 9, 'the capital reaches every other city');
});

test('the projection keeps every city inside the canvas with room for its name', () => {
  for (const city of CITIES) {
    const p = project(city.lon, city.lat);
    assert.ok(p.x > 40 && p.x < MAP_FRAME.width - 40, `${city.name} x ${p.x.toFixed(0)}`);
    assert.ok(p.y > 10 && p.y < MAP_FRAME.height - 10, `${city.name} y ${p.y.toFixed(0)}`);
  }
  const [west, south, east, north] = outlineBounds();
  const nw = project(west, north);
  const se = project(east, south);
  assert.ok(nw.x >= 0 && nw.y >= 0 && se.x <= MAP_FRAME.width && se.y <= MAP_FRAME.height, 'the whole outline fits');
  // North is up and east is right.
  assert.ok(project(90, 25).y < project(90, 22).y);
  assert.ok(project(92, 23).x > project(89, 23).x);
});

test('a route curve starts and ends on its cities and bows to the side the sign says', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };
  assert.deepEqual(pointOnRoute(a, b, 0.2, 0), a);
  assert.deepEqual(pointOnRoute(a, b, 0.2, 1), b);
  assert.ok(routeControl(a, b, 0.2).y > 0 && routeControl(a, b, -0.2).y < 0);
  assert.ok(pointOnRoute(a, b, 0.2, 0.5).y > 0);
});

// Names are drawn in 8px spaced capitals, about 6.8 px a letter in English. The Bangla names are narrower, so the English
// ones are the worst case.
test('no city name runs into another name, another city or the edge of the canvas', () => {
  const boxes = CITIES.map((city) => {
    const p = project(city.lon, city.lat);
    const width = city.name.length * 6.8;
    const x0 = city.label === 'right' ? p.x + 7 : p.x - 7 - width;
    return { city, p, x0, x1: x0 + width, y0: p.y - 5, y1: p.y + 5 };
  });
  const overlap = (a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }) =>
    a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  for (const box of boxes) {
    assert.ok(box.x0 >= 0 && box.x1 <= MAP_FRAME.width, `${box.city.name} stays on the canvas`);
    for (const other of boxes) {
      if (other === box) continue;
      assert.equal(overlap(box, other), false, `${box.city.name} overlaps the name ${other.city.name}`);
      const ring = { x0: other.p.x - 7, x1: other.p.x + 7, y0: other.p.y - 7, y1: other.p.y + 7 };
      assert.equal(overlap(box, ring), false, `${box.city.name} covers the city ${other.city.name}`);
    }
  }
});
