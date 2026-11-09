import { GLOBE_PALETTE, rgba } from './palette';

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

export function drawGlobe(ctx: CanvasRenderingContext2D, frame: GlobeFrame) {
  ctx.clearRect(0, 0, frame.width, frame.height);
  drawAtmosphere(ctx, frame);
  drawSphereBody(ctx, frame);
  drawRim(ctx, frame);
}
