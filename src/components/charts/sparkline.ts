// Geometry for the small trend lines on stat tiles. Pure, so it can be tested without a browser.

export interface SparkPoint {
  x: number;
  y: number;
}

/** Spread values across the box. A flat series sits mid-height instead of hugging an edge. */
export function sparklinePoints(values: readonly number[], width: number, height: number, pad = 3): SparkPoint[] {
  const clean = values.map((value) => (Number.isFinite(value) ? value : 0));
  if (clean.length === 0) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min;
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  return clean.map((value, index) => ({
    x: pad + (clean.length === 1 ? innerWidth / 2 : (index / (clean.length - 1)) * innerWidth),
    y: span === 0 ? height / 2 : pad + (1 - (value - min) / span) * innerHeight,
  }));
}

/** A smooth line through the points (Catmull-Rom converted to cubic Beziers), kept inside the box vertically. */
export function smoothPath(points: readonly SparkPoint[], height: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const clampY = (y: number) => Math.min(height, Math.max(0, y));
  let path = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    path += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

/** The same line closed down to the baseline, for the soft fill under it. */
export function areaPath(points: readonly SparkPoint[], height: number): string {
  if (points.length < 2) return '';
  const line = smoothPath(points, height);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${last.x.toFixed(2)} ${height} L${first.x.toFixed(2)} ${height} Z`;
}
