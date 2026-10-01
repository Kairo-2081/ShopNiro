import React from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { Address, Rider, RiderDelivery } from '../../types';
import { api } from '../../lib/api';
import { RiderDetailsModal } from './RiderDetailsModal';
import { Banknote, CheckCircle2, Clock3, MapPin, RefreshCw, Star, Truck, Wallet } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface RiderDashboardProps {
  rider: Rider;
}

const defaultCenter: [number, number] = [23.8103, 90.4125];
const riderMarker = L.divIcon({ className: 'shopniro-location-icon', html: '<span class="shopniro-location-pin" aria-hidden="true"></span>', iconSize: [28, 36], iconAnchor: [14, 36] });

function ClickMap({ onSelect }: { onSelect: (location: [number, number]) => void }) {
  useMapEvents({ click: (event) => onSelect([event.latlng.lat, event.latlng.lng]) });
  return null;
}

const addressLabel = (address: Address) => [address.House_Name, address.Street, address.City, address.Postal_Code].filter(Boolean).join(', ');

export const RiderDashboard: React.FC<RiderDashboardProps> = ({ rider }) => {
  const [profile, setProfile] = React.useState(rider);
  const [location, setLocation] = React.useState<[number, number] | null>(
    rider.Current_Latitude !== undefined && rider.Current_Longitude !== undefined
      ? [rider.Current_Latitude, rider.Current_Longitude]
      : null
  );
  const [savedLocation, setSavedLocation] = React.useState(
    rider.Current_Latitude !== undefined && rider.Current_Longitude !== undefined
  );
  const [deliveries, setDeliveries] = React.useState<RiderDelivery[]>([]);
  const [wallet, setWallet] = React.useState<{ balance: number; pendingSalary: number; entries: any[]; withdrawals: any[] } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [payoutMethod, setPayoutMethod] = React.useState('bkash');
  const [payoutAccount, setPayoutAccount] = React.useState('');
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (profile.Status !== 'approved' || !location) return;
    setLoading(true);
    setError(null);
    try {
      const [nextDeliveries, nextWallet, nextProfile] = await Promise.all([
        api.getRiderDeliveries(location[0], location[1]),
        api.getRiderWallet(),
        api.getRiderProfile(),
      ]);
      setDeliveries(nextDeliveries);
      setWallet(nextWallet);
      setProfile(nextProfile);
    } catch (err: any) {
      setError(err.message || 'Could not refresh your rider dashboard.');
    } finally {
      setLoading(false);
    }
  }, [location, profile.Status]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  React.useEffect(() => {
    if (!savedLocation || profile.Status !== 'approved') return;
    const refreshTimer = window.setInterval(() => { void refresh(); }, 15000);
    return () => window.clearInterval(refreshTimer);
  }, [profile.Status, refresh, savedLocation]);

  React.useEffect(() => {
    api.getRiderProfile().then(setProfile).catch((err: any) => setError(err.message || 'Could not refresh rider profile.'));
  }, [rider.Rider_ID]);

  const saveLocation = async () => {
    if (!location) return;
    setError(null);
    try {
      await api.updateRiderLocation(location[0], location[1]);
      setSavedLocation(true);
      await refresh();
    } catch (err: any) {
      setSavedLocation(false);
      setError(err.message || 'Could not save your location.');
    }
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) {
      setError('Location access is unavailable in this browser. Choose a point on the map instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocation([coords.latitude, coords.longitude]); setSavedLocation(false); setError(null); },
      () => setError('Location permission was denied. Choose your current point on the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const deliveryAction = async (delivery: RiderDelivery, action: () => Promise<unknown>) => {
    setBusyId(delivery.Delivery_ID);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Could not update this delivery.');
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (event: React.FormEvent) => {
    event.preventDefault();
    setWithdrawing(true);
    setError(null);
    try {
      await api.requestRiderWithdrawal(Number(withdrawAmount), payoutMethod, payoutAccount);
      setWithdrawAmount('');
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Could not request this withdrawal.');
    } finally {
      setWithdrawing(false);
    }
  };

  const timelyPercent = profile.Total_Deliveries ? Math.round((profile.Timely_Deliveries / profile.Total_Deliveries) * 100) : 100;

  if (profile.Status !== 'approved') {
    return <>
      <div className="mx-auto max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950/30"><h1 className="text-lg font-bold text-slate-900 dark:text-white">Rider application under review</h1><p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">Your account is signed in, but delivery operations will appear after administrator approval.</p><button type="button" onClick={() => setShowDetails(true)} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">My details</button></div>
      <RiderDetailsModal isOpen={showDetails} rider={profile} onClose={() => setShowDetails(false)} onSaved={setProfile} />
    </>;
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Rider operations</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Good day, {profile.Name}</h1><p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Your location is used to sort nearby ShopNiro deliveries.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowDetails(true)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-[#12161D] dark:text-zinc-200">My details</button>
          <button type="button" onClick={() => void refresh()} disabled={loading || !location} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-[#12161D] dark:text-zinc-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh jobs</button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-emerald-900/15 bg-white dark:border-emerald-900/40 dark:bg-[#12161D]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-zinc-800">
          <div><h2 className="font-bold text-slate-900 dark:text-white">Your current location</h2><p className="text-xs text-slate-500 dark:text-zinc-400">Select on the map or use device location to see nearby shipments.</p></div>
          <div className="flex gap-2"><button type="button" onClick={useDeviceLocation} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700">Use device location</button><button type="button" onClick={() => void saveLocation()} disabled={!location || savedLocation} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{savedLocation ? 'Location saved' : 'Save location'}</button></div>
        </div>
        <div className="relative h-64 sm:h-80">
          <MapContainer center={location || defaultCenter} zoom={location ? 14 : 11} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            <ClickMap onSelect={(next) => { setLocation(next); setSavedLocation(false); }} />
            {location && <Marker position={location} icon={riderMarker} />}
          </MapContainer>
        </div>
        <div className="flex items-center gap-2 p-3 text-xs text-slate-600 dark:text-zinc-400"><MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />{location ? `${location[0].toFixed(5)}, ${location[1].toFixed(5)}${savedLocation ? ' · saved' : ' · save to load deliveries'}` : 'No location selected'}</div>
      </section>

      {!savedLocation ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Save your current location to load available shipments and confirm your starting point.</div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-end justify-between"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Nearby shipments</h2><p className="text-xs text-slate-500 dark:text-zinc-400">Nearest pickup locations are listed first.</p></div><span className="text-xs font-semibold text-slate-500">{deliveries.length} available</span></div>
          {deliveries.map((delivery) => (
            <article key={delivery.Delivery_ID} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#12161D] lg:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900 dark:text-white">Order {delivery.Order_ID}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">{delivery.Status.replace('_', ' ')}</span><span className="text-xs text-slate-500">{delivery.Distance_KM?.toFixed(1)} km away</span></div>
                <p className="text-sm text-slate-700 dark:text-zinc-300">Customer: {delivery.Customer_Name} · {delivery.Customer_Number}</p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">Deliver to: {addressLabel(delivery.Shipping_Address)}</p>
                <ul className="text-xs text-slate-600 dark:text-zinc-400">{delivery.Items.map((item) => <li key={item.Product_ID}>{item.Quantity} × {item.Name}</li>)}</ul>
                {delivery.COD_Amount > 0 && <p className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><Banknote className="h-3.5 w-3.5" />Collect ৳{delivery.COD_Amount.toLocaleString()}</p>}
              </div>
              <div className="flex min-w-52 flex-col justify-center gap-2">
                {delivery.Status === 'pending' && <button type="button" disabled={busyId === delivery.Delivery_ID} onClick={() => void deliveryAction(delivery, () => api.acceptRiderDelivery(delivery.Delivery_ID))} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busyId === delivery.Delivery_ID ? 'Accepting...' : 'Accept shipment'}</button>}
                {delivery.Status === 'accepted' && <button type="button" disabled={busyId === delivery.Delivery_ID} onClick={() => void deliveryAction(delivery, () => api.setRiderDeliveryOnWay(delivery.Delivery_ID))} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Start delivery</button>}
                {delivery.Status === 'on_the_way' && <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/25"><p className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">Tell the customer this delivery code</p><p className="font-mono text-2xl font-black tracking-[0.3em] text-emerald-950 dark:text-emerald-100">{delivery.Confirmation_Code}</p>{delivery.COD_Amount > 0 && !delivery.COD_Collected && <button type="button" disabled={busyId === delivery.Delivery_ID} onClick={() => void deliveryAction(delivery, () => api.markRiderCodCollected(delivery.Delivery_ID))} className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === delivery.Delivery_ID ? 'Recording...' : `Confirm ৳${delivery.COD_Amount.toLocaleString()} collected`}</button>}{delivery.COD_Amount > 0 && delivery.COD_Collected && <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">COD collection recorded. Waiting for the customer to confirm receipt.</p>}{delivery.COD_Amount === 0 && <p className="text-xs text-emerald-800 dark:text-emerald-300">Waiting for the customer to confirm receipt in their portal.</p>}</div>}
              </div>
            </article>
          ))}
          {!loading && deliveries.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-zinc-700">No nearby shipments are waiting. New seller dispatches will appear here.</div>}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Successful deliveries', value: profile.Total_Deliveries, icon: Truck },
          { label: 'Timely delivery rate', value: `${timelyPercent}%`, icon: Clock3 },
          { label: 'Customer rating', value: profile.Average_Rating ? `${profile.Average_Rating.toFixed(1)}/5` : 'New', icon: Star },
          { label: "This month's points", value: `${profile.Performance_Points}/100`, icon: Star },
          { label: 'Wallet balance', value: `৳${wallet?.balance.toLocaleString() || '0'}`, icon: Wallet },
        ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#12161D]"><Icon className="mb-3 h-4 w-4 text-emerald-700 dark:text-emerald-400" /><p className="text-xs text-slate-500 dark:text-zinc-400">{label}</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</p></div>)}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#12161D]">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Wallet className="h-4 w-4 text-emerald-700" />Withdraw salary</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Net salary releases to your wallet 30 days after month-end. Available now: ৳{wallet?.balance.toLocaleString() || '0'} · pending after COD deductions: ৳{wallet?.pendingSalary.toLocaleString() || '0'}.</p>
          <form onSubmit={withdraw} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="number" min="1" step="0.01" max={wallet?.balance || 0} required value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Amount" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#181F2A]" />
            <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#181F2A]"><option value="bkash">bKash</option><option value="bank">Bank transfer</option><option value="nagad">Nagad</option></select>
            <input required value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} placeholder="Payout account" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#181F2A]" />
            <button type="submit" disabled={withdrawing || (wallet?.balance || 0) <= 0} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-3">{withdrawing ? 'Requesting...' : 'Request withdrawal'}</button>
          </form>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#12161D]">
          <h2 className="font-bold text-slate-900 dark:text-white">Wallet activity</h2>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{wallet?.entries.map((entry) => <div key={entry.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-xs dark:border-zinc-800"><span className="text-slate-600 dark:text-zinc-300">{entry.description || entry.entry_type}</span><span className="font-bold text-slate-900 dark:text-white">৳{Number(entry.amount).toLocaleString()}</span></div>)}{wallet?.withdrawals.map((entry) => <div key={entry.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-xs dark:border-zinc-800"><span className="text-slate-600 dark:text-zinc-300">Withdrawal · {entry.status}</span><span className="font-bold text-slate-900 dark:text-white">-৳{Number(entry.amount).toLocaleString()}</span></div>)}{!wallet?.entries.length && !wallet?.withdrawals.length && <p className="py-4 text-xs text-slate-500">No wallet entries yet.</p>}</div>
        </div>
      </section>
      <p className="text-xs text-slate-500 dark:text-zinc-500">COD appears in wallet activity and is deducted from pending monthly salary; it is not withdrawable before salary release. {profile.Late_Deliveries} late deliveries recorded.</p>
      <RiderDetailsModal isOpen={showDetails} rider={profile} onClose={() => setShowDetails(false)} onSaved={setProfile} />
      {loading && <span className="sr-only" role="status">Refreshing rider dashboard</span>}
      <CheckCircle2 className="sr-only" aria-hidden="true" />
    </div>
  );
};