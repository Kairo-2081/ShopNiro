// Flat map maths. The map never moves, so one fixed view is enough, but keeping the maths here makes it testable.

export interface MapFrame {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
}

/** The canvas the map is drawn on. It is taller than the country is wide, with room either side for the city names. */
export const MAP_FRAME: MapFrame = { width: 340, height: 300 };

/** Longitude and latitude at the centre of the canvas, and how many pixels one degree of latitude covers. */
export const MAP_VIEW = { lon0: 90.345, lat0: 23.61, pixelsPerDegree: 46 };

const RAD = Math.PI / 180;

export interface MapPoint {
  x: number;
  y: number;
}

/**
 * Longitude is scaled by the cosine of the middle latitude so the country keeps its real proportions. At Bangladesh's
 * size a flat projection like this is indistinguishable from a more elaborate one.
 */
export function project(lon: number, lat: number, frame: MapFrame = MAP_FRAME): MapPoint {
  const { lon0, lat0, pixelsPerDegree } = MAP_VIEW;
  return {
    x: frame.width / 2 + (lon - lon0) * Math.cos(lat0 * RAD) * pixelsPerDegree,
    y: frame.height / 2 - (lat - lat0) * pixelsPerDegree,
  };
}

/** The control point of the curve a route follows: the midpoint pushed sideways by `bend` times the route's length. */
export function routeControl(from: MapPoint, to: MapPoint, bend: number): MapPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend };
}

/** A point a fraction `t` (0 to 1) of the way along a route's quadratic curve. */
export function pointOnRoute(from: MapPoint, to: MapPoint, bend: number, t: number): MapPoint {
  const c = routeControl(from, to, bend);
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
  };
}
