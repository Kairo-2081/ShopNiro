import React, { useState, useEffect, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Order, Product, Customer } from '../../types';
import { formatCurrency, formatBDT, formatDate } from '../../lib/api';
import {
  Package,
  Truck,
  MapPin,
  Compass,
  Radio,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Search,
  RefreshCw,
  Phone,
  Layers,
  Sparkles,
  ArrowRight,
  Maximize2,
  X,
  ExternalLink,
  Navigation,
} from 'lucide-react';

interface TrackingCoordinates {
  lat: number;
  lng: number;
}

// Polyline route renderer for @vis.gl/react-google-maps
function DeliveryRoutePolyline({
  origin,
  courier,
  destination,
  isEco = false,
}: {
  origin: TrackingCoordinates;
  courier: TrackingCoordinates;
  destination: TrackingCoordinates;
  isEco?: boolean;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const polylineCompletedRef = useRef<google.maps.Polyline | null>(null);
  const polylineRemainingRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    // Completed segment (Origin to Courier)
    const completedPath = [origin, courier];
    // Remaining segment (Courier to Destination)
    const remainingPath = [courier, destination];

    const polyCompleted = new mapsLib.Polyline({
      path: completedPath,
      geodesic: true,
      strokeColor: isEco ? '#10B981' : '#3B82F6',
      strokeOpacity: 0.9,
      strokeWeight: 5,
      map,
    });

    const polyRemaining = new mapsLib.Polyline({
      path: remainingPath,
      geodesic: true,
      strokeColor: '#94A3B8',
      strokeOpacity: 0.6,
      strokeWeight: 4,
      map,
    });

    polylineCompletedRef.current = polyCompleted;
    polylineRemainingRef.current = polyRemaining;

    // Fit bounds to show origin, courier, and destination
    try {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(courier);
      bounds.extend(destination);
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    } catch (e) {
      // Map instance bounds fallback
    }

    return () => {
      polyCompleted.setMap(null);
      polyRemaining.setMap(null);
    };
  }, [map, mapsLib, origin, courier, destination, isEco]);

  return null;
}

interface LiveProductTrackingMapProps {
  order?: Order | null;
  orders?: Order[];
  onSelectOrder?: (order: Order) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const LiveProductTrackingMap: React.FC<LiveProductTrackingMapProps> = ({
  order: initialOrder,
  orders = [],
  onSelectOrder,
  onClose,
  isModal = false,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrder?.Order_ID || (orders.length > 0 ? orders[0].Order_ID : 'TRK-9021')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isSimulatingMovement, setIsSimulatingMovement] = useState(true);
  const [movementStep, setMovementStep] = useState(0.45); // 0 to 1 progress along route
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Derive current order from props or selected ID
  const activeOrder: Order =
    orders.find((o) => o.Order_ID === selectedOrderId || o.Tracking_ID === selectedOrderId) ||
    initialOrder || {
      Order_ID: 'ORD-9021',
      Customer_ID: 'CUST-DEMO',
      Tracking_ID: 'TRK-9021',
      Status: 'shipped',
      Order_Placed_At: new Date(Date.now() - 3600000 * 4).toISOString(),
      Subtotal: 349.99,
      Shipping_Fee: 0,
      Payment_Status: 'paid',
      Payment_Method: 'bkash',
      Transaction_ID: 'SSLCZ-BKASH-882190',
      Items: [
        {
          Product_ID: 'PROD-1',
          Name: 'Sony WH-1000XM5 Wireless Headphones',
          Price: 349.99,
          Quantity: 1,
          Image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
          Seller_ID: 'SEL-1',
        },
        {
          Product_ID: 'PROD-2',
          Name: 'Smart Noise Isolating Travel Case',
          Price: 29.99,
          Quantity: 1,
          Image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500',
          Seller_ID: 'SEL-1',
        },
      ],
      Shipping_Address: {
        House_Name: 'Plot 42, Green Heights',
        Street: 'Road 11, Banani',
        City: 'Dhaka',
        Postal_Code: '1213',
        Additional_Info: 'Deliver to 4th floor reception',
      },
      Billing_Address: {
        House_Name: 'Plot 42, Green Heights',
        Street: 'Road 11, Banani',
        City: 'Dhaka',
        Postal_Code: '1213',
      },
    };

  // Base coordinates centered in Dhaka commerce corridor
  const originWarehouse: TrackingCoordinates = {
    lat: 23.8223,
    lng: 90.3654, // Mirpur Fulfillment Center
  };

  const deliveryDestination: TrackingCoordinates = {
    lat: 23.7937,
    lng: 90.4066, // Banani / Gulshan Destination
  };

  // Courier position interpolated between origin and destination based on movementStep
  const courierLocation: TrackingCoordinates = {
    lat: originWarehouse.lat + (deliveryDestination.lat - originWarehouse.lat) * movementStep,
    lng: originWarehouse.lng + (deliveryDestination.lng - originWarehouse.lng) * movementStep + Math.sin(movementStep * Math.PI) * 0.008,
  };

  // Live simulation of delivery van driving towards customer
  useEffect(() => {
    if (!isSimulatingMovement) return;
    const interval = setInterval(() => {
      setMovementStep((prev) => {
        if (prev >= 0.95) return 0.2; // Loop back for continuous live radar demonstration
        return prev + 0.015;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isSimulatingMovement]);

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  const stopsRemaining = Math.max(1, Math.round((1 - movementStep) * 4));
  const etaMinutes = Math.max(5, Math.round((1 - movementStep) * 28));

  return (
    <div className={`flex flex-col bg-white dark:bg-[#0F141C] text-slate-900 dark:text-zinc-100 rounded-3xl border border-sky-100 dark:border-zinc-800 shadow-2xl overflow-hidden ${isModal ? 'max-h-[90vh]' : ''}`}>
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-[#141B24] border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Live Google Maps Product Tracking
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-300 dark:border-emerald-800/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Radar
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Tracking Waybill <strong className="font-mono text-blue-600 dark:text-sky-400">{activeOrder.Tracking_ID}</strong> • Order ID: {activeOrder.Order_ID}
            </p>
          </div>
        </div>

        {/* Right Controls & Search */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Simulation Toggle */}
          <button
            type="button"
            onClick={() => setIsSimulatingMovement(!isSimulatingMovement)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isSimulatingMovement
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-sky-300'
                : 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
            }`}
            title="Toggle Live GPS Telemetry Simulation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingMovement ? 'animate-spin' : ''}`} />
            <span>{isSimulatingMovement ? 'GPS Live: Active' : 'GPS Paused'}</span>
          </button>

          {/* Close Modal Button if in Modal mode */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Map + Telemetry Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left 8 Cols: Interactive Google Map */}
        <div className="lg:col-span-8 relative min-h-[420px] lg:min-h-[580px] bg-slate-900 overflow-hidden flex flex-col">
          {/* Quick HUD Overlay Controls */}
          <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-zinc-700 text-white text-xs flex items-center gap-2 shadow-lg">
              <Truck className="w-4 h-4 text-sky-400" />
              <span>Courier Transit: <strong>{stopsRemaining} stops away</strong></span>
              <span className="text-zinc-500">•</span>
              <span className="text-emerald-400 font-bold">ETA ~{etaMinutes} mins</span>
            </div>

            <button
              type="button"
              onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
              className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-zinc-700 text-white text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
              title="Toggle Satellite Imagery"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>{mapType === 'roadmap' ? 'Satellite' : 'Roadmap'}</span>
            </button>
          </div>

          {/* Interactive Google Map Instance */}
          <div className="flex-1 w-full h-full min-h-[420px]">
            <APIProvider apiKey={mapsApiKey}>
              <Map
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                defaultCenter={courierLocation}
                defaultZoom={13}
                mapTypeId={mapType}
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: '100%', height: '100%' }}
              >
                {/* 1. Origin Marker: Merchant Warehouse */}
                <AdvancedMarker position={originWarehouse} title="GoCart Merchant Warehouse">
                  <div className="flex flex-col items-center group cursor-pointer">
                    <div className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold shadow-md border border-zinc-700 mb-1 whitespace-nowrap">
                      Dispatch Warehouse
                    </div>
                    <Pin background="#475569" glyphColor="#FFFFFF" borderColor="#1E293B" scale={1.1} />
                  </div>
                </AdvancedMarker>

                {/* 2. Live Moving Courier / Product Shipment Marker */}
                <AdvancedMarker position={courierLocation} title="Live Product Location">
                  <div className="relative flex flex-col items-center cursor-pointer transform -translate-y-2">
                    {/* Floating Product Badge */}
                    <div className="px-2.5 py-1 rounded-xl bg-blue-600 text-white text-[11px] font-black shadow-xl border border-sky-300 flex items-center gap-1.5 mb-1.5 animate-bounce">
                      <Package className="w-3.5 h-3.5 text-amber-300" />
                      <span>{activeOrder.Items[0]?.Name?.slice(0, 18) || 'Product in Transit'}...</span>
                    </div>

                    {/* Vehicle Pulsing Circle */}
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-blue-500/30 animate-ping absolute inset-0" />
                      <div className="w-11 h-11 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white relative z-10">
                        <Truck className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                </AdvancedMarker>

                {/* 3. Destination Marker: Customer Doorstep */}
                <AdvancedMarker position={deliveryDestination} title="Customer Delivery Address">
                  <div className="flex flex-col items-center group cursor-pointer">
                    <div className="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold shadow-md border border-emerald-500 mb-1 whitespace-nowrap">
                      Destination ({activeOrder.Shipping_Address.City})
                    </div>
                    <Pin background="#059669" glyphColor="#FFFFFF" borderColor="#064E3B" scale={1.2} />
                  </div>
                </AdvancedMarker>

                {/* Dynamic Route Polyline */}
                <DeliveryRoutePolyline
                  origin={originWarehouse}
                  courier={courierLocation}
                  destination={deliveryDestination}
                />
              </Map>
            </APIProvider>
          </div>

          {/* Bottom Map Legend */}
          <div className="p-3 bg-slate-900/90 backdrop-blur-md border-t border-zinc-800 text-zinc-300 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Origin: Mirpur Hub
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" /> Live Product Location
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Destination: {activeOrder.Shipping_Address.Street}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              GPS Lat: {courierLocation.lat.toFixed(4)}, Lng: {courierLocation.lng.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Right 4 Cols: Live Telemetry, Product Specs, Courier Info */}
        <div className="lg:col-span-4 p-5 bg-white dark:bg-[#121822] space-y-5 overflow-y-auto">
          {/* Order Search / Quick Switcher */}
          {orders.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                Select Order to Track
              </label>
              <select
                value={activeOrder.Order_ID}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  const found = orders.find((o) => o.Order_ID === e.target.value);
                  if (found && onSelectOrder) onSelectOrder(found);
                }}
                className="w-full py-2 px-3 bg-slate-50 dark:bg-[#18202D] border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {orders.map((o) => (
                  <option key={o.Order_ID} value={o.Order_ID}>
                    {o.Tracking_ID} ({o.Items[0]?.Name || 'Order'} - {formatCurrency(o.Subtotal + o.Shipping_Fee)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Live Dispatch Progress Timeline */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161F2C] border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                Delivery Milestones
              </span>
              <span className="text-[10px] text-blue-600 dark:text-sky-400 font-bold bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                {Math.round(movementStep * 100)}% Completed
              </span>
            </div>

            {/* Stepper */}
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block">Dispatched from Hub</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Mirpur Logistics Hub • Package Inspected</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                  <Truck className="w-3 h-3" />
                </div>
                <div>
                  <span className="font-bold text-blue-600 dark:text-sky-300 block">Out for Delivery (In Transit)</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    On Mohakhali / Banani Expressway • Courier en route
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 opacity-60">
                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-zinc-400 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-3 h-3" />
                </div>
                <div>
                  <span className="font-bold text-slate-700 dark:text-zinc-400 block">Customer Destination</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {activeOrder.Shipping_Address.Street}, {activeOrder.Shipping_Address.City}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Products Inside Package Being Tracked */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center justify-between">
              <span>Products in this Shipment ({activeOrder.Items.length})</span>
              <span className="text-[10px] text-sky-500 font-semibold">Live GPS Tagged</span>
            </h3>

            <div className="space-y-2">
              {activeOrder.Items.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedProduct(item)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                    selectedProduct?.Product_ID === item.Product_ID
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700'
                      : 'bg-slate-50/60 dark:bg-[#161F2C] border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={item.Image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100'}
                      alt={item.Name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#0C1014]"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block line-clamp-1">{item.Name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Qty: {item.Quantity} • {formatCurrency(item.Price)}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono font-bold text-blue-600 dark:text-sky-400 text-right shrink-0">
                    {formatCurrency(item.Price * item.Quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Courier Dispatch Agent Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161F2C] border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                TR
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Tanvir Rahman</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Courier Partner • Paperfly / Pathao Cargo
                </span>
              </div>
            </div>

            <a
              href="tel:01700000000"
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-xs"
              title="Call Dispatch Courier"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>

          {/* Payment & Security Snapshot */}
          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Payment Verified via {activeOrder.Payment_Method?.toUpperCase() || 'SSLCOMMERZ'} • GoCart Transit Protection Guaranteed.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
