import { DESTINATION_HUBS, GLOBE_VIEW, HOME_HUB } from './network';
import { GLOBE_PALETTE, rgba } from './palette';
import { landCells } from './landMask';
import { isVisible, project, routePoints } from './projection';

/** Where the globe sits on the canvas, in CSS pixels. */
export interface GlobeFrame {
  width: number;
  height: number;
  cx: number;
  cy: number;
  radius: number;
}

/** A soft tan haze around the globe. It fades out well inside the canvas so it never meets an edge. */
function drawAtmosphere(ctx: CanvasRenderingContext2D, { cx, cy, radius }: GlobeFrame) {
  const haze = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.3);
  haze.addColorStop(0, rgba(GLOBE_PALETTE.tan, 0.3));
  haze.addColorStop(0.35, rgba(GLOBE_PALETTE.tan, 0.1));
  haze.addColorStop(1, rgba(GLOBE_PALETTE.tan, 0));
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
  ctx.fill();
}

/** The sphere itself: lit from the upper left, falling to deep olive at the lower right rim. */
function drawSphereBody(ctx: CanvasRenderingContext2D, { cx, cy, radius }: GlobeFrame) {
  const body = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.42, radius * 0.05, cx, cy, radius * 1.02);
  body.addColorStop(0, GLOBE_PALETTE.sphereLit);
  body.addColorStop(0.55, GLOBE_PALETTE.sphereMid);
  body.addColorStop(1, GLOBE_PALETTE.sphereShadow);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Faint latitude and longitude lines every 15 degrees. Each line is broken where it passes behind the globe. */
function drawGraticule(ctx: CanvasRenderingContext2D, { cx, cy, radius }: GlobeFrame) {
  ctx.save();
  ctx.strokeStyle = rgba(GLOBE_PALETTE.tan, 0.09);
  ctx.lineWidth = 0.6;
  const trace = (place: (t: number) => { lon: number; lat: number }, steps: number) => {
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= steps; i += 1) {
      const { lon, lat } = place(i / steps);
      const p = project(lon, lat, GLOBE_VIEW);
      if (p.z < 0) {
        drawing = false;
        continue;
      }
      const x = cx + p.x * radius;
      const y = cy - p.y * radius;
      if (drawing) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      drawing = true;
    }
    ctx.stroke();
  };
  for (let lat = -60; lat <= 60; lat += 15) trace((t) => ({ lon: -180 + 360 * t, lat }), 120);
  for (let lon = -180; lon < 180; lon += 15) trace((t) => ({ lon, lat: -80 + 160 * t }), 60);
  ctx.restore();
}

// Direction the light comes from (upper left, towards the viewer), as a unit vector.
const LIGHT = (() => {
  const x = -0.45;
  const y = 0.5;
  const z = 0.74;
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
})();

/**
 * Land as a field of tan dots. Dots shrink and fade towards the rim, where the surface turns away, and catch the light on
 * the upper left, so the map curves with the sphere.
 */
function drawLand(ctx: CanvasRenderingContext2D, { cx, cy, radius }: GlobeFrame) {
  for (const cell of landCells()) {
    const p = project(cell.lon, cell.lat, GLOBE_VIEW);
    if (p.z <= 0.04) continue;
    const lit = Math.max(0, p.x * LIGHT.x + p.y * LIGHT.y + p.z * LIGHT.z);
    // Dots fade to nothing at the rim and brighten smoothly towards the light. No hard switch, so no visible band.
    const alpha = 0.14 + 0.62 * Math.pow(p.z, 0.8) * (0.45 + 0.55 * lit);
    const size = 0.3 + 0.32 * p.z;
    ctx.fillStyle = rgba(GLOBE_PALETTE.tan, Math.min(0.8, alpha));
    ctx.beginPath();
    ctx.arc(cx + p.x * radius, cy - p.y * radius, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface GlobeOptions {
  /** 0 for the resting look, 1 when the routes are called out. */
  emphasis?: number;
}

/**
 * Delivery routes from the home hub: lifted great-circle arcs, faint at Dhaka and bright at the far end, with a soft glow
 * underneath. They are drawn over the sphere and not clipped to it, since a lifted arc can rise above the rim.
 */
function drawRoutes(ctx: CanvasRenderingContext2D, { cx, cy, radius }: GlobeFrame, emphasis: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const hub of DESTINATION_HUBS) {
    const points = routePoints(HOME_HUB, hub, GLOBE_VIEW, 0.2, 72).map((p) => ({
      visible: isVisible(p),
      x: cx + p.x * radius,
      y: cy - p.y * radius,
    }));
    const first = points[0];
    const last = points[points.length - 1];
    const trail = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
    trail.addColorStop(0, rgba(GLOBE_PALETTE.gold, 0.18 + 0.2 * emphasis));
    trail.addColorStop(1, rgba(GLOBE_PALETTE.gold, 0.9));
    const glow = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
    glow.addColorStop(0, rgba(GLOBE_PALETTE.gold, 0.03 + 0.05 * emphasis));
    glow.addColorStop(1, rgba(GLOBE_PALETTE.gold, 0.2 + 0.2 * emphasis));
    for (const [style, width] of [[glow, 3.4], [trail, 1.1 + 0.4 * emphasis]] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      let drawing = false;
      for (const point of points) {
        if (!point.visible) {
          drawing = false;
          continue;
        }
        if (drawing) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
        drawing = true;
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A thin lit edge on the upper left, and a faint glow just inside the whole limb. */
function drawRim(ctx: CanvasRenderingContext2D, { cx, cy, radius }: GlobeFrame) {
  const inner = ctx.createRadialGradient(cx, cy, radius * 0.84, cx, cy, radius);
  inner.addColorStop(0, rgba(GLOBE_PALETTE.tan, 0));
  inner.addColorStop(1, rgba(GLOBE_PALETTE.tan, 0.2));
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const edge = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  edge.addColorStop(0, rgba(GLOBE_PALETTE.ivory, 0.7));
  edge.addColorStop(0.5, rgba(GLOBE_PALETTE.tan, 0.12));
  edge.addColorStop(1, rgba(GLOBE_PALETTE.tan, 0));
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawGlobe(ctx: CanvasRenderingContext2D, frame: GlobeFrame, { emphasis = 0 }: GlobeOptions = {}) {
  ctx.clearRect(0, 0, frame.width, frame.height);
  drawAtmosphere(ctx, frame);
  drawSphereBody(ctx, frame);
  drawGraticule(ctx, frame);
  drawLand(ctx, frame);
  drawRim(ctx, frame);
  drawRoutes(ctx, frame, emphasis);
}
