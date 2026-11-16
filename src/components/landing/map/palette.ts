// Colours for the map, taken from the site's olive and tan scale (see --color-brand-* in src/index.css) so it reads as part
// of the same brand. The hero it sits on is dark in both themes, so one palette serves both.

export const MAP_PALETTE = {
  /** Tan, as an rgb triplet so each use can set its own opacity. */
  tan: '208, 200, 165',
  /** Warm gold for routes and parcels. */
  gold: '232, 214, 150',
  /** Near white with a warm cast, for the brightest points. */
  ivory: '250, 246, 232',
  /** Marks the home city. */
  home: '#f6efd2',
  /** Delivered, borrowed from the success scale used by order tracking. */
  delivered: '#4cba79',
  /** The dark behind the names, so they stay legible over the land and the routes. */
  halo: 'rgba(14, 14, 9, 0.85)',
} as const;

export const rgba = (triplet: string, alpha: number): string => `rgba(${triplet}, ${alpha})`;
