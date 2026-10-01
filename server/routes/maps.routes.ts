import { Router } from 'express';
import { Address } from '../../src/types.ts';

const router = Router();
const addressCache = new Map<string, { address: Address; expiresAt: number }>();
const cacheTtlMs = 24 * 60 * 60 * 1000;
let lastNominatimRequestAt = 0;
let nominatimRequestQueue: Promise<void> = Promise.resolve();

async function reverseGeocode(lat: number, lon: number) {
  const lookup = nominatimRequestQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastNominatimRequestAt = Date.now();

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lon),
      zoom: '18',
      addressdetails: '1',
    }).toString();

    const response = await fetch(url, {
      headers: {
        'User-Agent': `ShopNiro/1.0 (${process.env.MAPS_CONTACT_EMAIL || 'admin@shopniro.com'})`,
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) throw new Error(`Address lookup failed with status ${response.status}`);
    return response.json();
  });

  nominatimRequestQueue = lookup.then(() => undefined, () => undefined);
  return lookup;
}

router.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = addressCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.address);
  if (cached) addressCache.delete(cacheKey);

  try {
    const result = await reverseGeocode(lat, lon);
    const parts = result.address || {};
    const road = parts.road || parts.pedestrian || parts.footway || parts.path || parts.residential ||
      parts.neighbourhood || parts.suburb || parts.quarter || '';
    const street = [parts.house_number, road].filter(Boolean).join(' ') || result.name ||
      parts.neighbourhood || parts.suburb || parts.village || parts.town || parts.city || '';
    const city = parts.city || parts.town || parts.village || parts.municipality || parts.city_district ||
      parts.borough || parts.suburb || parts.county || parts.state_district || parts.state || '';

    if (!street || !city) return res.status(404).json({ error: 'No complete address found at this location' });

    const address: Address = {
      House_Name: parts.building || parts.house_name || '',
      Street: street,
      City: city,
      Postal_Code: parts.postcode || '',
      Additional_Info: '',
    };

    if (addressCache.size >= 500) addressCache.delete(addressCache.keys().next().value!);
    addressCache.set(cacheKey, { address, expiresAt: Date.now() + cacheTtlMs });
    res.set('Cache-Control', 'public, max-age=86400').json(address);
  } catch (error: any) {
    console.error('Address lookup failed:', error.message);
    res.status(502).json({ error: 'Address lookup is unavailable. Try again shortly.' });
  }
});

export default router;