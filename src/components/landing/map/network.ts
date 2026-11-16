export interface City {
  id: string;
  name: string;
  /** The name in Bangla script, shown when the site is in Bangla. */
  nameBn: string;
  lon: number;
  lat: number;
  /** Which side of the city its name sits on. Chosen so no two names, and no name and city, collide. */
  label: 'left' | 'right';
}

/**
 * Ten cities spread across the country: the eight division headquarters plus Cumilla and Cox's Bazar. They are illustrative,
 * to show a delivery network, and not a list of where ShopNiro delivers.
 */
export const CITIES: readonly City[] = [
  { id: 'dhaka', name: 'Dhaka', nameBn: 'ঢাকা', lon: 90.4125, lat: 23.8103, label: 'left' },
  { id: 'chattogram', name: 'Chattogram', nameBn: 'চট্টগ্রাম', lon: 91.7832, lat: 22.3569, label: 'right' },
  { id: 'khulna', name: 'Khulna', nameBn: 'খুলনা', lon: 89.5403, lat: 22.8456, label: 'left' },
  { id: 'rajshahi', name: 'Rajshahi', nameBn: 'রাজশাহী', lon: 88.6042, lat: 24.3745, label: 'left' },
  { id: 'sylhet', name: 'Sylhet', nameBn: 'সিলেট', lon: 91.8687, lat: 24.8949, label: 'right' },
  { id: 'rangpur', name: 'Rangpur', nameBn: 'রংপুর', lon: 89.2752, lat: 25.7439, label: 'left' },
  { id: 'barishal', name: 'Barishal', nameBn: 'বরিশাল', lon: 90.3535, lat: 22.701, label: 'right' },
  { id: 'mymensingh', name: 'Mymensingh', nameBn: 'ময়মনসিংহ', lon: 90.4203, lat: 24.7471, label: 'left' },
  { id: 'cumilla', name: 'Cumilla', nameBn: 'কুমিল্লা', lon: 91.1809, lat: 23.4607, label: 'right' },
  { id: 'coxsbazar', name: "Cox's Bazar", nameBn: 'কক্সবাজার', lon: 92.0058, lat: 21.4272, label: 'right' },
];

/** Where the busiest routes start: the capital, drawn brighter than the rest. */
export const HOME_CITY_ID = 'dhaka';

export interface Route {
  from: string;
  to: string;
  /**
   * How far the route bows away from a straight line, as a share of its length. The sign picks the side. Routes that
   * would otherwise run on top of each other bow in opposite directions, so each one can be told apart.
   */
  bend: number;
  /** How far along the route its parcel sits (0 at `from`, 1 at `to`). The picture is still, so this is a fixed place. */
  parcel?: number;
}

/**
 * Who sends to whom. Dhaka reaches every other city, and the neighbouring cities reach one another, so the picture reads
 * as a web of connected places and not as a star.
 */
export const ROUTES: readonly Route[] = [
  { from: 'dhaka', to: 'chattogram', bend: 0.12, parcel: 0.55 },
  { from: 'dhaka', to: 'khulna', bend: -0.12, parcel: 0.45 },
  { from: 'dhaka', to: 'rajshahi', bend: 0.1, parcel: 0.6 },
  { from: 'dhaka', to: 'sylhet', bend: -0.1, parcel: 0.4 },
  { from: 'dhaka', to: 'rangpur', bend: -0.08 },
  { from: 'dhaka', to: 'barishal', bend: 0.12 },
  { from: 'dhaka', to: 'mymensingh', bend: 0.14 },
  { from: 'dhaka', to: 'cumilla', bend: -0.14 },
  { from: 'dhaka', to: 'coxsbazar', bend: 0.06, parcel: 0.7 },
  { from: 'chattogram', to: 'coxsbazar', bend: -0.18 },
  { from: 'chattogram', to: 'cumilla', bend: 0.16, parcel: 0.5 },
  { from: 'chattogram', to: 'barishal', bend: -0.1 },
  { from: 'khulna', to: 'barishal', bend: 0.18 },
  { from: 'khulna', to: 'rajshahi', bend: -0.16, parcel: 0.5 },
  { from: 'rajshahi', to: 'rangpur', bend: 0.16 },
  { from: 'rangpur', to: 'mymensingh', bend: -0.12 },
  { from: 'mymensingh', to: 'sylhet', bend: 0.14, parcel: 0.55 },
  { from: 'sylhet', to: 'cumilla', bend: -0.14 },
];

export const cityById = (id: string): City => {
  const city = CITIES.find((item) => item.id === id);
  if (!city) throw new Error(`Unknown city: ${id}`);
  return city;
};
