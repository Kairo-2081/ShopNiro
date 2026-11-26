/**
 * A small pre-rendered picture of the map (see scripts/generate-map-poster.mts), shown until the live canvas is drawn.
 * The files live in public/ so /theme-init.js can start downloading the right one before the app's code has loaded.
 */
export const mapPosterFor = (locale: string): string => (locale === 'bn' ? '/map-poster-bn.webp' : '/map-poster-en.webp');
