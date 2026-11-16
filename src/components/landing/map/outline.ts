import { BANGLADESH_RINGS } from './bangladeshOutline.ts';

/** Even-odd test of one ring written as a flat [lon, lat, lon, lat, ...] list. */
function insideRing(lon: number, lat: number, ring: readonly number[]): boolean {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when a place is on Bangladeshi land (mainland or one of the larger islands). */
export function isInsideBangladesh(lon: number, lat: number): boolean {
  return BANGLADESH_RINGS.some((ring) => insideRing(lon, lat, ring));
}

/** The smallest box around the mainland, as [west, south, east, north]. */
export function outlineBounds(): [number, number, number, number] {
  const ring = BANGLADESH_RINGS[0];
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    west = Math.min(west, ring[i]);
    east = Math.max(east, ring[i]);
    south = Math.min(south, ring[i + 1]);
    north = Math.max(north, ring[i + 1]);
  }
  return [west, south, east, north];
}
