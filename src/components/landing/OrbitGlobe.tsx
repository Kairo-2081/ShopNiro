import React, { useEffect, useRef, useState } from 'react';
import { drawGlobe, GLOBE_FRAME } from './globe/drawGlobe';
import { DESTINATION_HUBS, GLOBE_VIEW, HOME_HUB } from './globe/network';
import { project } from './globe/projection';
import { useLocale } from '../../lib/i18n';

interface OrbitGlobeProps {
  /** Called when someone asks to trace the delivery routes. */
  onGreet?: () => void;
}

const TRACE_MS = 3200;

// Dhaka's position on the canvas as a share of its width and height, for the pulse ring laid over it.
const HOME_POINT = (() => {
  const p = project(HOME_HUB.lon, HOME_HUB.lat, GLOBE_VIEW);
  return {
    left: `${((GLOBE_FRAME.cx + p.x * GLOBE_FRAME.radius) / GLOBE_FRAME.width) * 100}%`,
    top: `${((GLOBE_FRAME.cy - p.y * GLOBE_FRAME.radius) / GLOBE_FRAME.height) * 100}%`,
  };
})();

export const OrbitGlobe: React.FC<OrbitGlobeProps> = ({ onGreet }) => {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isTracing, setIsTracing] = useState(false);

  const description = t('globeNetworkDescription', {
    home: HOME_HUB.name,
    destinations: DESTINATION_HUBS.map((hub) => hub.name).join(', '),
  });

  // Draw the globe. It is a still picture: it is drawn again only to call out the routes, never on a timer.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Draw in CSS pixels but back the canvas with real device pixels, so dots and lines stay sharp on dense screens.
    // The picture can be shown up to 1.4 times its drawn size on wide screens, so back it with extra pixels to keep it sharp.
    const pixelRatio = Math.min((window.devicePixelRatio || 1) * 1.5, 4);
    canvas.width = Math.round(GLOBE_FRAME.width * pixelRatio);
    canvas.height = Math.round(GLOBE_FRAME.height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawGlobe(ctx, GLOBE_FRAME, { emphasis: isTracing ? 1 : 0 });
  }, [isTracing]);

  useEffect(() => {
    if (!isTracing) return undefined;
    const timer = window.setTimeout(() => setIsTracing(false), TRACE_MS);
    return () => window.clearTimeout(timer);
  }, [isTracing]);

  const traceRoutes = () => {
    setIsTracing(true);
    onGreet?.();
  };

  return (
    <div className="relative flex h-[284px] select-none md:h-[374px] flex-col items-center justify-center py-2">
      <div className="relative w-[320px] max-w-full md:w-[440px]" style={{ aspectRatio: `${GLOBE_FRAME.width} / ${GLOBE_FRAME.height}` }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          width={GLOBE_FRAME.width}
          height={GLOBE_FRAME.height}
          className="block h-full w-full"
        />
        {/* A slow ping on the home hub says the network is live. It is a plain fade, and stops under reduced motion. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f6efd2]/70 motion-safe:animate-ping"
          style={{ ...HOME_POINT, animationDuration: '2.8s' }}
        />
      </div>
      <p className="sr-only">{description}</p>

      <div role="status" className="h-0">
        {isTracing && <span className="sr-only">{t('deliveryRoutesHighlighted')}</span>}
      </div>

      <button
        type="button"
        onClick={traceRoutes}
        className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand-200/80 bg-brand-50 px-3.5 py-1 text-micro font-medium tracking-wide text-brand-700 shadow-2xs transition-colors hover:bg-brand-100 dark:border-brand-800/80 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/50"
      >
        <span>{t('traceDeliveryRoutes')}</span>
      </button>
    </div>
  );
};
