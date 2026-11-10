// Orthographic globe maths. The globe never turns, so one fixed view is enough, but keeping the maths here makes it testable.

export interface GlobeView {
  /** Longitude, in degrees, at the centre of the visible disc. */
  lon0: number;
  /** Latitude, in degrees, at the centre of the visible disc. */
  lat0: number;
}

export interface ProjectedPoint {
  /** Right of centre, as a fraction of the globe radius (-1 to 1 on the surface). */
  x: number;
  /** Above centre, as a fraction of the globe radius (-1 to 1 on the surface). */
  y: number;
  /** Towards the viewer. Positive on the near side, negative on the far side. */
  z: number;
}

const RAD = Math.PI / 180;

/**
 * Projects a point at `lon`/`lat` onto the view. `height` is the distance from the centre as a multiple of the radius,
 * so 1 is the surface and a route arc lifted above the surface uses a value above 1.
 */
export function project(lon: number, lat: number, view: GlobeView, height = 1): ProjectedPoint {
  const phi = lat * RAD;
  const phi0 = view.lat0 * RAD;
  const lambda = (lon - view.lon0) * RAD;
  const cosPhi = Math.cos(phi);
  return {
    x: height * cosPhi * Math.sin(lambda),
    y: height * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * cosPhi * Math.cos(lambda)),
    z: height * (Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * cosPhi * Math.cos(lambda)),
  };
}

/**
 * True when the point can be seen. The near side always can. A lifted point on the far side can still be seen when it
 * sits outside the outline of the globe.
 */
export function isVisible(point: ProjectedPoint): boolean {
  return point.z >= 0 || point.x * point.x + point.y * point.y > 1;
}

export interface GeoPoint {
  lon: number;
  lat: number;
}

/** Point a fraction `t` (0 to 1) of the way along the shortest path between two places. */
export function greatCircleAt(from: GeoPoint, to: GeoPoint, t: number): GeoPoint {
  const a = toVector(from);
  const b = toVector(to);
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-9) return { lon: from.lon, lat: from.lat };
  const sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinOmega;
  const wb = Math.sin(t * omega) / sinOmega;
  const v: [number, number, number] = [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]];
  return { lon: Math.atan2(v[1], v[0]) / RAD, lat: Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD };
}

function toVector({ lon, lat }: GeoPoint): [number, number, number] {
  const phi = lat * RAD;
  const lambda = lon * RAD;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

/**
 * Samples a route as screen points. The arc rises above the surface in the middle (by `lift` times the radius) so it
 * reads as a flight path and not a line drawn on the ground.
 */
export function routePoints(from: GeoPoint, to: GeoPoint, view: GlobeView, lift: number, samples: number): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const place = greatCircleAt(from, to, t);
    points.push(project(place.lon, place.lat, view, 1 + lift * Math.sin(Math.PI * t)));
  }
  return points;
}
