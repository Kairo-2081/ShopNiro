import React from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { Address } from '../types';
import { api } from '../lib/api';
import { LocateFixed, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface AccountLocationPickerProps {
  onAddressSelected: (address: Address | null) => void;
}

const defaultCenter = { lat: 23.8103, lng: 90.4125 };
const selectedLocationIcon = L.divIcon({
  className: 'shopniro-location-icon',
  html: '<span class="shopniro-location-pin" aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
});

interface LocationMapEventsProps {
  onSelectLocation: (coordinates: { lat: number; lng: number }) => void;
}

function LocationMapEvents({ onSelectLocation }: LocationMapEventsProps) {
  useMapEvents({
    click: (event) => onSelectLocation({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

function MapViewport({ center }: { center: [number, number] | null }) {
  const map = useMap();

  React.useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    map.invalidateSize({ pan: false });
    return () => observer.disconnect();
  }, [map]);

  React.useEffect(() => {
    if (center) map.flyTo(center, 16, { duration: 0.35 });
  }, [center, map]);

  return null;
}

function LocationMap({ onAddressSelected }: AccountLocationPickerProps) {
  const [marker, setMarker] = React.useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = React.useState('Select a point on the map or use your current location.');
  const [isResolving, setIsResolving] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);
  const [mapCenter, setMapCenter] = React.useState<[number, number] | null>(null);

  const selectLocation = async (coordinates: { lat: number; lng: number }) => {
    setMarker(coordinates);
    setStatus('Finding the address...');
    setIsResolving(true);
    onAddressSelected(null);

    try {
      const address = await api.reverseGeocode(coordinates.lat, coordinates.lng);
      onAddressSelected({ ...address, Latitude: coordinates.lat, Longitude: coordinates.lng });
      setStatus('Location selected. Review the address below.');
    } catch (error: any) {
      setMarker(null);
      setStatus('Could not find this address. Check the map connection and try again.');
      console.error('OpenStreetMap reverse geocoding failed:', error.message);
    } finally {
      setIsResolving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location access is unavailable. Select your location on the map instead.');
      return;
    }

    setIsLocating(true);
    setStatus('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = { lat: coords.latitude, lng: coords.longitude };
        setMapCenter([coords.latitude, coords.longitude]);
        setIsLocating(false);
        void selectLocation(coordinates);
      },
      (error) => {
        setIsLocating(false);
        setStatus(error.code === 1
          ? 'Location permission was denied. Allow access in your browser or select a point on the map.'
          : error.code === 3
            ? 'Location request timed out. Try again or select a point on the map.'
            : 'Could not get your location. Select a point on the map instead.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500 dark:text-zinc-400">Tap the map or use GPS. Your browser will ask before sharing location.</p>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating || isResolving}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-[#12161D] dark:text-emerald-300 dark:hover:bg-emerald-950/30"
        >
          <LocateFixed className="h-4 w-4" />
          {isLocating ? 'Finding you...' : 'Use current location'}
        </button>
      </div>
      <div className="relative h-56 w-full touch-pan-x touch-pan-y overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-zinc-700 dark:bg-[#181F2A] sm:h-72">
        <MapContainer center={defaultCenter} zoom={11} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <MapViewport center={mapCenter} />
          <LocationMapEvents onSelectLocation={selectLocation} />
          {marker && (
            <Marker position={marker} icon={selectedLocationIcon}>
              <Tooltip permanent>Selected location</Tooltip>
            </Marker>
          )}
        </MapContainer>
        {(isResolving || isLocating) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-semibold" role="status">
            {isLocating ? 'Finding your location...' : 'Finding address...'}
          </div>
        )}
      </div>
      <p
        className={`flex items-center gap-1.5 text-[11px] ${status.startsWith('Location selected') ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-zinc-400'}`}
        role="status"
        aria-live="polite"
      >
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        {status}
      </p>
    </div>
  );
}

export const AccountLocationPicker: React.FC<AccountLocationPickerProps> = ({ onAddressSelected }) => {
  return <LocationMap onAddressSelected={onAddressSelected} />;
};