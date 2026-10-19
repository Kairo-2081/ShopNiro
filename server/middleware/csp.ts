import type { HelmetOptions } from 'helmet';

type CspOption = HelmetOptions['contentSecurityPolicy'];

/**
 * Content-Security-Policy for production.
 *
 * Ships in report-only mode by default so a bad directive cannot break the
 * storefront. Set CSP_ENFORCE=true on the host to enforce it; unset it to
 * roll back instantly without a deploy.
 */
export const buildContentSecurityPolicy = (
  isProduction: boolean,
  env: NodeJS.ProcessEnv = process.env,
): CspOption => {
  if (!isProduction) return false;
  return {
    reportOnly: env.CSP_ENFORCE !== 'true',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://*.tile.openstreetmap.org', 'https://*.supabase.co'],
      connectSrc: ["'self'", 'https://router.project-osrm.org'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  };
};
