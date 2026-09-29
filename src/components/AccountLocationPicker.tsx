import React from 'react';
import { APIProvider, AdvancedMarker, Map, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Address } from '../types';
import { MapPin } from 'lucide-react';

interface AccountLocationPickerProps {
  onAddressSelected: (address: Address | null) => void;
}

const defaultCenter = { lat: 23.8103, lng: 90.4125 };

function LocationMap({ onAddressSelected }: AccountLocationPickerProps) {
  const geocodingLibrary = useMapsLibrary('geocoding');
  const [marker, setMarker] = React.useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = React.useState('Select a point on the map.');
  const [isResolving, setIsResolving] = React.useState(false);

  const handleMapClick = async (event: any) => {
    const clickedPoint = event.detail?.latLng;
    if (!clickedPoint || !geocodingLibrary) return;

    const coordinates = { lat: clickedPoint.lat, lng: clickedPoint.lng };
    setMarker(coordinates);
    setStatus('Finding the address...');
    setIsResolving(true);
    onAddressSelected(null);

    try {
      const geocoder = new geocodingLibrary.Geocoder();
      const { results } = await geocoder.geocode({ location: coordinates });
      const result = results[0];
      if (!result) {
        setStatus('No address found at this point. Choose another location.');
        return;
      }

      const getPart = (type: string) =>
        result.address_components.find((component) => component.types.includes(type))?.long_name || '';
      const street = [getPart('street_number'), getPart('route')].filter(Boolean).join(' ') || result.formatted_address;
      const city =
        getPart('locality') ||
        getPart('postal_town') ||
        getPart('administrative_area_level_2') ||
        getPart('administrative_area_level_1');

      if (!street || !city) {
        setStatus('A complete address was not found. Choose another location.');
        return;
      }

      onAddressSelected({
        House_Name: getPart('subpremise') || getPart('premise'),
        Street: street,
        City: city,
        Postal_Code: getPart('postal_code'),
        Additional_Info: '',
      });
      setStatus('Location selected. Review the address below.');
    } catch {
      setStatus('Could not find this address. Check the map connection and try again.');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-[#181F2A]">
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={defaultCenter}
          defaultZoom={11}
          gestureHandling="greedy"
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >
          {marker && <AdvancedMarker position={marker} title="Selected account location" />}
        </Map>
        {isResolving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-semibold" role="status">
            Finding address...
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
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">
        Map selection is unavailable because Google Maps is not configured.
      </p>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <LocationMap onAddressSelected={onAddressSelected} />
    </APIProvider>
  );
};