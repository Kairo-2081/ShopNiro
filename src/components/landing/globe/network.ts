import type { GeoPoint, GlobeView } from './projection';

export interface Hub extends GeoPoint {
  name: string;
}

/** The globe faces South Asia, so Dhaka sits just right of centre with the routes fanning out around it. */
export const GLOBE_VIEW: GlobeView = { lon0: 82, lat0: 20 };

/** Where every route starts: the marketplace's home city. */
export const HOME_HUB: Hub = { name: 'Dhaka', lon: 90.41, lat: 23.81 };

/** Cities the routes run to. All are on the near side of the globe from GLOBE_VIEW. */
export const DESTINATION_HUBS: Hub[] = [
  { name: 'Dubai', lon: 55.27, lat: 25.2 },
  { name: 'Singapore', lon: 103.82, lat: 1.35 },
  { name: 'Tokyo', lon: 139.69, lat: 35.68 },
  { name: 'Mumbai', lon: 72.88, lat: 19.08 },
];

/**
 * How far along each route its parcel marker sits, from 0 at Dhaka to 1 at the destination. They differ on purpose so the
 * parcels do not line up in a row. The globe is still, so these are fixed positions and not an animation.
 */
export const PARCEL_POSITIONS = [0.58, 0.42, 0.64, 0.5];
