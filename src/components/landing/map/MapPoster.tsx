import React from 'react';
import { MAP_FRAME } from './projection';
import { mapPosterFor } from './posters';
import { useLocale } from '../../../lib/i18n';

/**
 * The map's place on the page before it has loaded: the same box the live map uses, holding a small picture of it.
 * The picture appears with the first paint, so the hero is never an empty hole while the map's code loads and draws.
 */
export const MapPoster: React.FC = () => {
  const { locale } = useLocale();
  return (
    <div aria-hidden="true" className="relative flex h-[344px] w-full max-w-[420px] flex-col items-center justify-center py-2 md:h-[452px]">
      <div className="relative w-[320px] max-w-full md:w-[440px]" style={{ aspectRatio: `${MAP_FRAME.width} / ${MAP_FRAME.height}` }}>
        <img src={mapPosterFor(locale)} alt="" decoding="async" className="block h-full w-full" />
      </div>
    </div>
  );
};
