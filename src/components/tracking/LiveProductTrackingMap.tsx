import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
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

function FitRouteBounds({
  origin,
  destination,
  routeId,
}: {
  origin: TrackingCoordinates;
  destination: TrackingCoordinates;
  routeId: string;
}) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(
      L.latLngBounds([origin.lat, origin.lng], [destination.lat, destination.lng]),
      { padding: [60, 60], maxZoom: 13 }
    );
  }, [map, origin.lat, origin.lng, destination.lat, destination.lng, routeId]);

  return null;
}

interface LiveProductTrackingMapProps {
  order?: Order | null;
  orders?: Order[];
  onSelectOrder?: (order: Order) => void;
  onDeliveryComplete?: (orderId: string) => Promise<void>;
  onClose?: () => void;
  isModal?: boolean;
}

export const LiveProductTrackingMap: React.FC<LiveProductTrackingMapProps> = ({
  order: initialOrder,
  orders = [],
  onSelectOrder,
  onDeliveryComplete,
  onClose,
  isModal = false,
}) => {
  const trackableOrders = Array.from(
    new globalThis.Map<string, Order>(
      [...orders, ...(initialOrder ? [initialOrder] : [])]
        .filter((candidate) => candidate.Status === 'shipped' || candidate.Status === 'delivered')
        .map((candidate) => [candidate.Order_ID, candidate])
    ).values()
  );
  const hasTrackableOrder = trackableOrders.length > 0;
  const firstTrackableOrder = initialOrder && (initialOrder.Status === 'shipped' || initialOrder.Status === 'delivered')
    ? initialOrder
    : trackableOrders[0];
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    firstTrackableOrder?.Order_ID || 'TRK-9021'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isSimulatingMovement, setIsSimulatingMovement] = useState(firstTrackableOrder?.Status === 'shipped');
  const [movementStep, setMovementStep] = useState(firstTrackableOrder?.Status === 'delivered' ? 1 : 0);
  const [isCompletingDelivery, setIsCompletingDelivery] = useState(false);
  const [deliveryUpdateError, setDeliveryUpdateError] = useState<string | null>(null);
  const deliveryUpdateStartedRef = useRef<string | null>(null);

  // Derive current order from props or selected ID
  const activeOrder: Order =
    trackableOrders.find((o) => o.Order_ID === selectedOrderId || o.Tracking_ID === selectedOrderId) ||
    firstTrackableOrder || {
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
  const assignedRider = activeOrder.Fulfillments?.find((fulfillment) => fulfillment.Rider_Name && ['accepted', 'on_the_way'].includes(fulfillment.Delivery_Status || ''))
    || activeOrder.Fulfillments?.find((fulfillment) => fulfillment.Rider_Name);
  const riderName = assignedRider?.Rider_Name || 'Rider not assigned yet';
  const riderInitials = assignedRider?.Rider_Name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'SN';

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

  useEffect(() => {
    if (!firstTrackableOrder) return;
    setSelectedOrderId(firstTrackableOrder.Order_ID);
  }, [firstTrackableOrder?.Order_ID]);

  useEffect(() => {
    if (activeOrder.Status === 'delivered') {
      setMovementStep(1);
      setIsSimulatingMovement(false);
    } else if (activeOrder.Status === 'shipped') {
      setMovementStep(0);
      setIsSimulatingMovement(true);
    }
  }, [activeOrder.Order_ID, activeOrder.Status]);

  // Simulate shipment movement only after the vendor marks the order as shipped.
  useEffect(() => {
    if (!hasTrackableOrder || activeOrder.Status !== 'shipped' || !isSimulatingMovement) return;
    const interval = setInterval(() => {
      setMovementStep((prev) => Math.min(1, prev + 0.03));
    }, 1000);
    return () => clearInterval(interval);
  }, [hasTrackableOrder, activeOrder.Order_ID, activeOrder.Status, isSimulatingMovement]);

  const completeDelivery = async (orderId: string) => {
    if (!onDeliveryComplete || deliveryUpdateStartedRef.current === orderId) return;
    deliveryUpdateStartedRef.current = orderId;
    setIsSimulatingMovement(false);
    setIsCompletingDelivery(true);
    setDeliveryUpdateError(null);
    try {
      await onDeliveryComplete(orderId);
    } catch (error: any) {
      deliveryUpdateStartedRef.current = null;
      setDeliveryUpdateError(error.message || 'Could not confirm delivery. Retry the status update.');
    } finally {
      setIsCompletingDelivery(false);
    }
  };

  useEffect(() => {
    if (activeOrder.Status === 'shipped' && movementStep >= 1) {
      void completeDelivery(activeOrder.Order_ID);
    }
  }, [activeOrder.Order_ID, activeOrder.Status, movementStep]);

  const stopsRemaining = Math.max(0, Math.round((1 - movementStep) * 4));
  const etaMinutes = Math.max(0, Math.round((1 - movementStep) * 28));

  if (!hasTrackableOrder) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12161D] p-6 text-center space-y-2">
        <Truck className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-bold text-slate-900 dark:text-white">Tracking starts when your order ships</h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400">Your vendor will mark the order as shipped before its live route appears here.</p>
      </div>
    );
  }

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
                OpenStreetMap Delivery Tracking
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-300 dark:border-emerald-800/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {activeOrder.Status === 'delivered' ? 'Delivered' : 'Live Radar'}
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
          {activeOrder.Status === 'shipped' ? (
            <button
              type="button"
              onClick={() => setIsSimulatingMovement(!isSimulatingMovement)}
              disabled={movementStep >= 1 || isCompletingDelivery}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer disabled:opacity-60 ${
                isSimulatingMovement
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-sky-300'
                  : 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
              }`}
              title="Pause or resume shipment movement simulation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingMovement ? 'animate-spin' : ''}`} />
              <span>{isCompletingDelivery ? 'Confirming delivery' : isSimulatingMovement ? 'GPS Live: Active' : 'GPS Paused'}</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              Delivered
            </span>
          )}

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

          </div>

          {/* Interactive OpenStreetMap Instance */}
          <div className="flex-1 w-full h-full min-h-[420px]">
            <MapContainer
              center={courierLocation}
              zoom={12}
              scrollWheelZoom
              className="relative z-0 h-full w-full min-h-[420px]"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <FitRouteBounds origin={originWarehouse} destination={deliveryDestination} routeId={activeOrder.Order_ID} />
              <Polyline positions={[originWarehouse, courierLocation]} pathOptions={{ color: '#77775a', weight: 5, opacity: 0.9 }} />
              <Polyline positions={[courierLocation, deliveryDestination]} pathOptions={{ color: '#858585', weight: 4, opacity: 0.65, dashArray: '8 8' }} />

              <CircleMarker center={originWarehouse} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#555347', fillOpacity: 1 }}>
                <Tooltip permanent direction="top">Dispatch Warehouse</Tooltip>
                <Popup>ShopNiro dispatch warehouse</Popup>
              </CircleMarker>
              <CircleMarker center={courierLocation} radius={12} pathOptions={{ color: '#fff', weight: 3, fillColor: '#8a805e', fillOpacity: 1 }}>
                <Tooltip direction="top">{activeOrder.Items[0]?.Name || 'Parcel in transit'}</Tooltip>
                <Popup>Courier in transit</Popup>
              </CircleMarker>
              <CircleMarker center={deliveryDestination} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#7d7e5e', fillOpacity: 1 }}>
                <Tooltip permanent direction="top">Customer Destination</Tooltip>
                <Popup>{activeOrder.Shipping_Address.Street}, {activeOrder.Shipping_Address.City}</Popup>
              </CircleMarker>
            </MapContainer>
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

            {isCompletingDelivery && (
              <p className="text-[11px] text-slate-500 dark:text-zinc-400" role="status">
                Route complete. Updating order status to delivered...
              </p>
            )}
            {activeOrder.Status === 'delivered' && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300" role="status">
                Shipment delivered successfully.
              </p>
            )}
            {deliveryUpdateError && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-rose-700 dark:text-rose-300" role="alert">
                <span>{deliveryUpdateError}</span>
                <button
                  type="button"
                  onClick={() => void completeDelivery(activeOrder.Order_ID)}
                  className="font-bold underline underline-offset-2 shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

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
                  <span className="font-bold text-blue-600 dark:text-sky-300 block">
                    {activeOrder.Status === 'delivered' ? 'Delivered' : 'Out for Delivery (In Transit)'}
                  </span>
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

          {/* Assigned rider card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161F2C] border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                {riderInitials}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">{riderName}</span>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {assignedRider ? `ShopNiro rider · ${assignedRider.Delivery_Status?.replace('_', ' ') || 'assigned'}` : 'Assigned when the shipment is accepted'}
                </span>
              </div>
            </div>

            {assignedRider?.Rider_Number && <a href={`tel:${assignedRider.Rider_Number}`} className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-xs" title={`Call ${riderName}`}><Phone className="w-4 h-4" /></a>}
          </div>

          {/* Payment & Security Snapshot */}
          <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              Payment Verified via {activeOrder.Payment_Method?.toUpperCase() || 'SSLCOMMERZ'} • ShopNiro Transit Protection Guaranteed.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
