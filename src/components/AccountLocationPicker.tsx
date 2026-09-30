import React from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import { Address } from '../types';
import { api } from '../lib/api';
import { MapPin } from 'lucide-react';
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

function LocationMap({ onAddressSelected }: AccountLocationPickerProps) {
  const [marker, setMarker] = React.useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = React.useState('Select a point on the map.');
  const [isResolving, setIsResolving] = React.useState(false);

  const handleMapClick = async (coordinates: { lat: number; lng: number }) => {
    setMarker(coordinates);
    setStatus('Finding the address...');
    setIsResolving(true);
    onAddressSelected(null);

    try {
      const address = await api.reverseGeocode(coordinates.lat, coordinates.lng);
      onAddressSelected(address);
      setStatus('Location selected. Review the address below.');
    } catch (error: any) {
      setMarker(null);
      setStatus('Could not find this address. Check the map connection and try again.');
      console.error('OpenStreetMap reverse geocoding failed:', error.message);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-[#181F2A]">
        <MapContainer center={defaultCenter} zoom={11} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <LocationMapEvents onSelectLocation={handleMapClick} />
          {marker && (
            <Marker position={marker} icon={selectedLocationIcon}>
              <Tooltip permanent>Selected location</Tooltip>
            </Marker>
          )}
        </MapContainer>
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
  return <LocationMap onAddressSelected={onAddressSelected} />;
};