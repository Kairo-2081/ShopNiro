// Colours for the globe, taken from the site's olive and tan scale (see --color-brand-* in src/index.css) so the globe reads
// as part of the same brand and not as a stock blue planet. The hero it sits on is dark in both themes, so one palette serves both.

export const GLOBE_PALETTE = {
  /** Sphere shading from the lit upper left to the shadowed rim. */
  sphereLit: '#5f5b41',
  sphereMid: '#302e20',
  sphereShadow: '#0e0e09',
  /** Tan, as an rgb triplet so each use can set its own opacity. */
  tan: '208, 200, 165',
  /** Warm gold for routes and parcels. */
  gold: '232, 214, 150',
  /** Near white with a warm cast, for the brightest points. */
  ivory: '250, 246, 232',
  /** Marks the home hub. */
  home: '#f6efd2',
  /** Delivered, borrowed from the success scale used by order tracking. */
  delivered: '#4cba79',
} as const;

export const rgba = (triplet: string, alpha: number): string => `rgba(${triplet}, ${alpha})`;
