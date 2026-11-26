import React, { useEffect, useRef, useState } from 'react';
import { drawMap } from './drawMap';
import { CITIES, HOME_CITY_ID, cityById } from './network';
import { MAP_FRAME, project } from './projection';
import { useLocale } from '../../../lib/i18n';
import { runWhenIdle } from '../../../lib/idleTask';
import { mapPosterFor } from './posters';

interface BangladeshMapProps {
  /** Called when someone asks to trace the delivery routes. */
  onGreet?: () => void;
}

const TRACE_MS = 3200;

// Dhaka's position on the canvas as a share of its width and height, for the pulse ring laid over it.
const HOME_POINT = (() => {
  const home = cityById(HOME_CITY_ID);
  const p = project(home.lon, home.lat);
  return { left: `${(p.x / MAP_FRAME.width) * 100}%`, top: `${(p.y / MAP_FRAME.height) * 100}%` };
})();

export const BangladeshMap: React.FC<BangladeshMapProps> = ({ onGreet }) => {
  const { t, locale } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const hasDrawn = useRef(false);
  // The poster stands in until the first real draw, then goes in the same frame so the two never blend.
  const [isDrawn, setIsDrawn] = useState(false);

  const names = (locale === 'bn' ? CITIES.map((city) => city.nameBn) : CITIES.map((city) => city.name)).join(', ');
  const description = t('mapNetworkDescription', {
    home: locale === 'bn' ? cityById(HOME_CITY_ID).nameBn : cityById(HOME_CITY_ID).name,
    cities: names,
  });

  // Draw the map. It is a still picture: it is drawn again only to call out the routes or to change the language of the
  // names, never on a timer. The first draw waits for an idle moment: on a slow phone it holds the main thread long enough
  // to delay the Explore button and everything after it, and a visitor who taps through at once never needed it.
  // Redrawing for a tap or a language change answers the visitor, so that happens straight away.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const draw = () => {
      // Draw in CSS pixels but back the canvas with real device pixels, so dots and lines stay sharp on dense screens.
      // The picture can be shown up to 1.3 times its drawn size on wide screens, so back it with extra pixels.
      const pixelRatio = Math.min((window.devicePixelRatio || 1) * 1.5, 4);
      canvas.width = Math.round(MAP_FRAME.width * pixelRatio);
      canvas.height = Math.round(MAP_FRAME.height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawMap(ctx, MAP_FRAME, { emphasis: isTracing ? 1 : 0, locale: locale === 'bn' ? 'bn' : 'en' });
      hasDrawn.current = true;
      canvas.style.opacity = '1';
      setIsDrawn(true);
    };
    if (hasDrawn.current) {
      draw();
      return undefined;
    }
    return runWhenIdle(draw);
  }, [isTracing, locale]);

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
    <div className="relative flex h-[344px] select-none flex-col items-center justify-center py-2 md:h-[452px]">
      <div className="relative w-[320px] max-w-full md:w-[440px]" style={{ aspectRatio: `${MAP_FRAME.width} / ${MAP_FRAME.height}` }}>
        {!isDrawn && <img src={mapPosterFor(locale)} alt="" aria-hidden="true" decoding="async" className="absolute inset-0 block h-full w-full" />}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          width={MAP_FRAME.width}
          height={MAP_FRAME.height}
          className="block h-full w-full"
          style={{ opacity: 0 }}
        />
        {/* A slow ping on the capital says the network is live. It is a plain fade, and stops under reduced motion. */}
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
