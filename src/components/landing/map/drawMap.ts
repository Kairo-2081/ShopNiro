import { BANGLADESH_RINGS } from './bangladeshOutline.ts';
import { CITIES, HOME_CITY_ID, ROUTES, cityById, type City } from './network.ts';
import { MAP_PALETTE, rgba } from './palette.ts';
import { MAP_FRAME, pointOnRoute, project, routeControl, type MapFrame } from './projection.ts';

export type MapLocale = 'en' | 'bn';

export interface MapOptions {
  /** 0 for the resting look, 1 when the routes are called out. */
  emphasis?: number;
  locale?: MapLocale;
}

/** The land as one path, mainland and islands, in canvas pixels. */
function landPath(frame: MapFrame): Path2D {
  const path = new Path2D();
  for (const ring of BANGLADESH_RINGS) {
    for (let i = 0; i < ring.length; i += 2) {
      const p = project(ring[i], ring[i + 1], frame);
      if (i === 0) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
    }
    path.closePath();
  }
  return path;
}

/**
 * A soft tan glow behind the country. It is centred, fades to nothing well inside the canvas, and sits on a transparent
 * canvas, so the map takes on whatever background the page has and never shows an edge.
 */
function drawHaze(ctx: CanvasRenderingContext2D, { width, height }: MapFrame) {
  const reach = Math.min(width, height) / 2 - 1;
  const haze = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, reach);
  haze.addColorStop(0, rgba(MAP_PALETTE.tan, 0.2));
  haze.addColorStop(0.5, rgba(MAP_PALETTE.tan, 0.08));
  haze.addColorStop(1, rgba(MAP_PALETTE.tan, 0));
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, reach, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The country: a translucent tan fill, a field of fine dots that catch the light on the upper left, and a thin glowing
 * outline. The dot grid gives the land a soft texture without a heavy fill.
 */
function drawLand(ctx: CanvasRenderingContext2D, frame: MapFrame) {
  const land = landPath(frame);
  const fill = ctx.createLinearGradient(0, 0, frame.width * 0.6, frame.height);
  fill.addColorStop(0, rgba(MAP_PALETTE.tan, 0.2));
  fill.addColorStop(1, rgba(MAP_PALETTE.tan, 0.06));
  ctx.fillStyle = fill;
  ctx.fill(land, 'nonzero');

  ctx.save();
  ctx.clip(land, 'nonzero');
  const spacing = 3.4;
  for (let y = spacing / 2; y < frame.height; y += spacing) {
    const offset = Math.round(y / spacing) % 2 === 0 ? 0 : spacing / 2;
    for (let x = spacing / 2 + offset; x < frame.width; x += spacing) {
      const lit = 1 - (x / frame.width) * 0.45 - (y / frame.height) * 0.45;
      ctx.fillStyle = rgba(MAP_PALETTE.tan, 0.18 + 0.5 * lit);
      ctx.beginPath();
      ctx.arc(x, y, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(MAP_PALETTE.tan, 0.1);
  ctx.lineWidth = 5;
  ctx.stroke(land);
  ctx.strokeStyle = rgba(MAP_PALETTE.tan, 0.62);
  ctx.lineWidth = 0.9;
  ctx.stroke(land);
  ctx.restore();
}

/**
 * Delivery routes: gently bowed curves, faint at the sending city and bright at the receiving one, with a soft glow
 * underneath. Routes from the capital are a little brighter than the links between the other cities.
 */
function drawRoutes(ctx: CanvasRenderingContext2D, frame: MapFrame, emphasis: number) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const route of ROUTES) {
    const from = cityById(route.from);
    const to = cityById(route.to);
    const a = project(from.lon, from.lat, frame);
    const b = project(to.lon, to.lat, frame);
    const c = routeControl(a, b, route.bend);
    const strong = route.from === HOME_CITY_ID ? 1 : 0.72;
    const trail = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    trail.addColorStop(0, rgba(MAP_PALETTE.gold, (0.16 + 0.2 * emphasis) * strong));
    trail.addColorStop(1, rgba(MAP_PALETTE.gold, 0.9 * strong));
    const glow = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    glow.addColorStop(0, rgba(MAP_PALETTE.gold, (0.03 + 0.05 * emphasis) * strong));
    glow.addColorStop(1, rgba(MAP_PALETTE.gold, (0.18 + 0.2 * emphasis) * strong));
    for (const [style, width] of [[glow, 3.2], [trail, 0.9 + 0.4 * emphasis]] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A small parcel on some routes, drawn as a tilted square with a warm halo, to say something is on its way. */
function drawParcels(ctx: CanvasRenderingContext2D, frame: MapFrame, emphasis: number) {
  for (const route of ROUTES) {
    if (route.parcel === undefined) continue;
    const from = cityById(route.from);
    const to = cityById(route.to);
    const p = pointOnRoute(project(from.lon, from.lat, frame), project(to.lon, to.lat, frame), route.bend, route.parcel);
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8 + 3 * emphasis);
    halo.addColorStop(0, rgba(MAP_PALETTE.gold, 0.55 + 0.25 * emphasis));
    halo.addColorStop(1, rgba(MAP_PALETTE.gold, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + 3 * emphasis, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = rgba(MAP_PALETTE.ivory, 0.98);
    ctx.beginPath();
    ctx.roundRect(-1.9, -1.9, 3.8, 3.8, 0.8);
    ctx.fill();
    ctx.restore();
  }
}

/** A place name in small spaced capitals (English) or plain Bangla script, with a dark halo so it stays legible. */
function drawLabel(ctx: CanvasRenderingContext2D, city: City, x: number, y: number, locale: MapLocale, strength: number) {
  const right = city.label === 'right';
  ctx.save();
  ctx.textAlign = right ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  if (locale === 'bn') {
    // Letter spacing would break Bangla's joined letters apart, so the Bangla names are drawn plain and a touch larger.
    ctx.font = '600 9.5px "Noto Sans Bengali", "Hind Siliguri", "Nirmala UI", "Bangla Sangam MN", system-ui, sans-serif';
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  } else {
    ctx.font = '600 8px Inter, system-ui, -apple-system, sans-serif';
    // Not every browser supports letter spacing on canvas text. Where it is missing the label is simply a little tighter.
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '1.2px';
  }
  const text = locale === 'bn' ? city.nameBn : city.name.toUpperCase();
  const tx = x + (right ? 8 : -8);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = MAP_PALETTE.halo;
  ctx.strokeText(text, tx, y + 0.5);
  ctx.fillStyle = rgba(MAP_PALETTE.ivory, strength);
  ctx.fillText(text, tx, y + 0.5);
  ctx.restore();
}

/** Every city as a small ring with its name, and the capital as the brighter home city. */
function drawCities(ctx: CanvasRenderingContext2D, frame: MapFrame, locale: MapLocale) {
  for (const city of CITIES) {
    const p = project(city.lon, city.lat, frame);
    if (city.id === HOME_CITY_ID) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 15);
      glow.addColorStop(0, rgba(MAP_PALETTE.ivory, 0.85));
      glow.addColorStop(0.35, rgba(MAP_PALETTE.gold, 0.4));
      glow.addColorStop(1, rgba(MAP_PALETTE.gold, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MAP_PALETTE.home;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(MAP_PALETTE.ivory, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      drawLabel(ctx, city, p.x, p.y, locale, 1);
      continue;
    }
    ctx.strokeStyle = rgba(MAP_PALETTE.gold, 0.95);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = MAP_PALETTE.delivered;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(ctx, city, p.x, p.y, locale, 0.88);
  }
}

export function drawMap(ctx: CanvasRenderingContext2D, frame: MapFrame = MAP_FRAME, { emphasis = 0, locale = 'en' }: MapOptions = {}) {
  ctx.clearRect(0, 0, frame.width, frame.height);
  drawHaze(ctx, frame);
  drawLand(ctx, frame);
  drawRoutes(ctx, frame, emphasis);
  drawCities(ctx, frame, locale);
  drawParcels(ctx, frame, emphasis);
}
