import React from 'react';
import { Customer, Order, Product, RiderDelivery, Seller } from '../../types';
import { api, formatCurrency, formatBDT, formatDate } from '../../lib/api';
import { PaymentReceiptModal } from '../payment/PaymentReceiptModal';
import { LiveProductTrackingMap } from '../tracking/LiveProductTrackingMap';
import { MarketplaceTrendsTopCharts } from '../storefront/MarketplaceTrendsTopCharts';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ChevronRight,
  AlertCircle,
  Radio,
  Receipt,
  ShieldCheck,
  CreditCard,
  Lock,
  Navigation,
} from 'lucide-react';

interface CustomerOrdersProps {
  currentCustomer: Customer;
  orders: Order[];
  sellers?: Seller[];
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
  onRefreshOrders?: () => Promise<void>;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  currentCustomer,
  orders,
  sellers = [],
  allProducts = [],
  onSelectProduct,
  onAddToCart,
  onRefreshOrders,
}) => {
  const [searchTracking, setSearchTracking] = React.useState('');
  const [receiptOrder, setReceiptOrder] = React.useState<Order | null>(null);
  const [trackingOrderForMap, setTrackingOrderForMap] = React.useState<Order | null>(null);
  const [showTopMap, setShowTopMap] = React.useState<boolean>(true);
  const [riderDeliveries, setRiderDeliveries] = React.useState<Array<RiderDelivery & { Rider_Name?: string; Rider_Number?: string }>>([]);
  const [reviewRatings, setReviewRatings] = React.useState<Record<string, number>>({});
  const [reviewTexts, setReviewTexts] = React.useState<Record<string, string>>({});
  const [deliveryTimely, setDeliveryTimely] = React.useState<Record<string, boolean>>({});
  const [reviewSubmittingId, setReviewSubmittingId] = React.useState<string | null>(null);
  const [deliveryNotice, setDeliveryNotice] = React.useState<string | null>(null);
  const [deliveryCodes, setDeliveryCodes] = React.useState<Record<string, string>>({});
  const [deliveryCodeErrors, setDeliveryCodeErrors] = React.useState<Record<string, string>>({});
  const [confirmingDeliveryId, setConfirmingDeliveryId] = React.useState<string | null>(null);
  const [reviewDraftingId, setReviewDraftingId] = React.useState<string | null>(null);
  const [reviewDraftErrors, setReviewDraftErrors] = React.useState<Record<string, string>>({});
  const refreshOrdersRef = React.useRef(onRefreshOrders);

  React.useEffect(() => { refreshOrdersRef.current = onRefreshOrders; }, [onRefreshOrders]);

  const loadRiderDeliveries = React.useCallback(async () => {
    try {
      setRiderDeliveries(await api.getCustomerRiderDeliveries());
    } catch (error: any) {
      setDeliveryNotice(error.message || 'Could not load rider shipment details.');
    }
  }, []);

  React.useEffect(() => {
    void loadRiderDeliveries();
    const refreshOrders = () => {
      void refreshOrdersRef.current?.().catch((error: any) => {
        setDeliveryNotice(error.message || 'Could not refresh your orders.');
      });
    };
    refreshOrders();
    const refreshTimer = window.setInterval(() => {
      void loadRiderDeliveries();
      refreshOrders();
    }, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [loadRiderDeliveries, currentCustomer.Customer_ID]);

  const submitRiderReview = async (delivery: RiderDelivery & { Review_ID?: string }) => {
    setReviewSubmittingId(delivery.Delivery_ID);
    setDeliveryNotice(null);
    try {
      await api.reviewRiderDelivery(
        delivery.Delivery_ID,
        reviewRatings[delivery.Delivery_ID] || 5,
        reviewTexts[delivery.Delivery_ID] || '',
        deliveryTimely[delivery.Delivery_ID] ?? true
      );
      setDeliveryNotice('Thank you. Your rider review has been recorded.');
      await loadRiderDeliveries();
    } catch (error: any) {
      setDeliveryNotice(error.message || 'Could not submit the rider review.');
    } finally {
      setReviewSubmittingId(null);
    }
  };

  const draftRiderReview = async (delivery: RiderDelivery) => {
    setReviewDraftingId(delivery.Delivery_ID);
    setReviewDraftErrors((current) => ({ ...current, [delivery.Delivery_ID]: '' }));
    try {
      const result = await api.generateAIRiderReviewDraft({
        riderName: delivery.Rider_Name || 'ShopNiro rider',
        rating: reviewRatings[delivery.Delivery_ID] || 5,
        wasTimely: deliveryTimely[delivery.Delivery_ID] ?? true,
        notes: reviewTexts[delivery.Delivery_ID] || '',
      });
      setReviewTexts((current) => ({ ...current, [delivery.Delivery_ID]: result.draft }));
    } catch (error: any) {
      setReviewDraftErrors((current) => ({ ...current, [delivery.Delivery_ID]: error.message || 'Could not draft a comment.' }));
    } finally {
      setReviewDraftingId(null);
    }
  };

  const confirmRiderDelivery = async (delivery: RiderDelivery) => {
    setConfirmingDeliveryId(delivery.Delivery_ID);
    setDeliveryCodeErrors((current) => ({ ...current, [delivery.Delivery_ID]: '' }));
    setDeliveryNotice(null);
    try {
      await api.confirmCustomerDelivery(delivery.Delivery_ID, deliveryCodes[delivery.Delivery_ID] || '');
      setDeliveryNotice('Delivery confirmed. You can now leave a rider review.');
      setDeliveryCodes({ ...deliveryCodes, [delivery.Delivery_ID]: '' });
      await Promise.all([loadRiderDeliveries(), onRefreshOrders?.()]);
    } catch (error: any) {
      setDeliveryCodeErrors((current) => ({ ...current, [delivery.Delivery_ID]: error.message || 'Could not confirm delivery. Check the code from your rider.' }));
    } finally {
      setConfirmingDeliveryId(null);
    }
  };

  const customerOrders = orders.filter((o) => o.Customer_ID === currentCustomer.Customer_ID);
  const trackableOrders = customerOrders.filter((o) => o.Status === 'shipped');

  const filteredOrders = customerOrders.filter((o) => {
    if (!searchTracking.trim()) return true;
    const q = searchTracking.toLowerCase();
    return (
      o.Tracking_ID.toLowerCase().includes(q) ||
      o.Order_ID.toLowerCase().includes(q) ||
      (o.Transaction_ID && o.Transaction_ID.toLowerCase().includes(q)) ||
      o.Items.some((item) => item.Name.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs animate-pulse">
            <Truck className="w-3.5 h-3.5" /> In Flight • 2 Stops Away
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" /> Processing Order
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/80 text-blue-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <Package className="w-3.5 h-3.5" /> Order Registered
          </span>
        );
    }
  };

  const getPaymentBadge = (order: Order) => {
    const isPaid = order.Payment_Status === 'paid';
    const method = order.Payment_Method || 'cash_on_delivery';

    if (method === 'bkash') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-[#E2136E] border border-pink-300 dark:border-pink-900/60">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E2136E]"></span>
          bKash • SSLCOMMERZ {isPaid ? '(Paid)' : '(Pending)'}
        </span>
      );
    }
    if (method === 'nagad') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-[#F7941D] border border-orange-300 dark:border-orange-900/60">
          Nagad • SSLCOMMERZ
        </span>
      );
    }
    if (method === 'rocket') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-[#8C3494] border border-purple-300 dark:border-purple-900/60">
          Rocket • SSLCOMMERZ
        </span>
      );
    }
    if (method === 'visa_mastercard') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-sky-400 border border-blue-300 dark:border-blue-900/60">
          Cards • SSLCOMMERZ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
        Cash on Delivery
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Search and Orders Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#12161D] p-6 rounded-3xl border border-sky-100 dark:border-zinc-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-950/80 text-sky-400 text-[10px] font-bold tracking-wider uppercase border border-sky-800/40 mb-2">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>GLOBAL RADAR TELEMETRY</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600 dark:text-sky-400" />
            Order History &amp; Tracking
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Tracking package dispatches for Customer: <strong className="text-slate-800 dark:text-zinc-200">{currentCustomer.Name}</strong> ({currentCustomer.Email})
          </p>
        </div>

        {/* Search by Tracking ID */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTracking}
            onChange={(e) => setSearchTracking(e.target.value)}
            placeholder="Filter by Tracking ID (e.g. TRK-)..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Live shipment tracking */}
      <div className="space-y-3">
        {trackableOrders.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12161D] p-4">
            <Radio className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live tracking starts after shipment</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Your vendor will mark the order as shipped before its route appears here.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live delivery tracking</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTopMap(!showTopMap)}
                className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                {showTopMap ? 'Hide Live Map' : 'Show Live Map'}
              </button>
            </div>
            {showTopMap && (
              <LiveProductTrackingMap
                order={trackableOrders[0]}
                orders={trackableOrders}
                sellers={sellers}
                customerAddress={currentCustomer.Address}
                onSelectOrder={(ord) => setTrackingOrderForMap(ord)}
              />
            )}
          </>
        )}
      </div>

      {riderDeliveries.length > 0 && (
        <section className="space-y-3" aria-labelledby="rider-shipments-title">
          <div>
            <h2 id="rider-shipments-title" className="text-lg font-bold text-slate-900 dark:text-white">Shop shipments and delivery confirmation</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Each shop shipment is tracked and confirmed separately.</p>
          </div>
          {deliveryNotice && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-[#12161D] dark:text-zinc-200">{deliveryNotice}</p>}
          {riderDeliveries.map((delivery) => (
            <article key={delivery.Delivery_ID} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#12161D] sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Order {delivery.Order_ID}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Shipment from {delivery.Seller_Name || 'ShopNiro merchant'}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Rider: {delivery.Rider_Name || 'Assigning a nearby rider'}{delivery.Rider_Number ? ` · ${delivery.Rider_Number}` : ''}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">Delivery status: {delivery.Status.replace('_', ' ')}</p>
                <ul className="mt-2 text-xs text-slate-600 dark:text-zinc-400">{delivery.Items.map((item) => <li key={item.Product_ID}>{item.Quantity} × {item.Name}</li>)}</ul>
                {delivery.COD_Amount > 0 && <p className="mt-2 text-xs font-bold text-amber-800 dark:text-amber-300">Cash due on delivery: {formatBDT(delivery.COD_Amount)}</p>}
              </div>
              {delivery.Status === 'on_the_way' && (
                <form onSubmit={(event) => { event.preventDefault(); void confirmRiderDelivery(delivery); }} className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Enter the code your rider gave you after receiving the parcel<input aria-invalid={Boolean(deliveryCodeErrors[delivery.Delivery_ID])} aria-describedby={deliveryCodeErrors[delivery.Delivery_ID] ? `delivery-code-error-${delivery.Delivery_ID}` : undefined} value={deliveryCodes[delivery.Delivery_ID] || ''} onChange={(event) => { setDeliveryCodes({ ...deliveryCodes, [delivery.Delivery_ID]: event.target.value.replace(/\D/g, '').slice(0, 6) }); setDeliveryCodeErrors((current) => ({ ...current, [delivery.Delivery_ID]: '' })); }} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.3em] dark:border-emerald-900 dark:bg-[#181F2A]" /></label>
                  {deliveryCodeErrors[delivery.Delivery_ID] && <p id={`delivery-code-error-${delivery.Delivery_ID}`} role="alert" className="text-xs font-semibold text-rose-700 dark:text-rose-300">{deliveryCodeErrors[delivery.Delivery_ID]}</p>}
                  {delivery.COD_Amount > 0 && <p className="text-xs text-amber-800 dark:text-amber-300">Cash collected: {delivery.COD_Collected ? 'confirmed by rider' : 'waiting for rider to record payment'}.</p>}
                  <button type="submit" disabled={confirmingDeliveryId === delivery.Delivery_ID || (deliveryCodes[delivery.Delivery_ID] || '').length !== 6} className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{confirmingDeliveryId === delivery.Delivery_ID ? 'Confirming...' : 'Confirm received'}</button>
                </form>
              )}
              {delivery.Status === 'delivered' && !delivery.Review_ID && (
                <form onSubmit={(event) => { event.preventDefault(); void submitRiderReview(delivery); }} className="space-y-3 border-t border-slate-200 pt-4 sm:col-span-2 dark:border-zinc-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Rate this delivery</h3>
                  <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto]">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Rating
                      <select value={reviewRatings[delivery.Delivery_ID] || 5} onChange={(event) => setReviewRatings({ ...reviewRatings, [delivery.Delivery_ID]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-[#181F2A]"><option value={5}>5 · Excellent</option><option value={4}>4 · Good</option><option value={3}>3 · Okay</option><option value={2}>2 · Poor</option><option value={1}>1 · Bad</option></select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Delivery timing
                      <select value={String(deliveryTimely[delivery.Delivery_ID] ?? true)} onChange={(event) => setDeliveryTimely({ ...deliveryTimely, [delivery.Delivery_ID]: event.target.value === 'true' })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-[#181F2A]"><option value="true">Timely</option><option value="false">Late</option></select>
                    </label>
                    <button type="submit" disabled={reviewSubmittingId === delivery.Delivery_ID} className="self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{reviewSubmittingId === delivery.Delivery_ID ? 'Saving...' : 'Submit review'}</button>
                    <div className="space-y-2 sm:col-span-3">
                      <textarea value={reviewTexts[delivery.Delivery_ID] || ''} onChange={(event) => setReviewTexts({ ...reviewTexts, [delivery.Delivery_ID]: event.target.value })} maxLength={2000} rows={2} placeholder="Optional comment about the delivery" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-[#181F2A]" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={() => void draftRiderReview(delivery)} disabled={reviewDraftingId === delivery.Delivery_ID} className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300">{reviewDraftingId === delivery.Delivery_ID ? 'Drafting...' : 'Draft optional comment with AI'}</button>
                        {reviewDraftErrors[delivery.Delivery_ID] && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{reviewDraftErrors[delivery.Delivery_ID]}</p>}
                      </div>
                    </div>
                  </div>
                </form>
              )}
              {delivery.Review_ID && delivery.Status === 'delivered' && <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 sm:col-span-2">Review submitted. Thank you.</p>}
            </article>
          ))}
        </section>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-zinc-800 p-8 space-y-3 shadow-xl">
          <Package className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-zinc-200">No orders found</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {searchTracking ? 'No orders match your search criteria.' : 'You have not placed any orders yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div
              key={order.Order_ID}
              className="bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-zinc-800 shadow-xl overflow-hidden transition-all hover:border-blue-500/50"
            >
              {/* Order Bar Header */}
              <div className="p-5 bg-slate-50/70 dark:bg-[#161C24]/80 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-zinc-400">
                      ID: {order.Order_ID}
                    </span>
                    <span className="text-slate-300 dark:text-zinc-700">•</span>
                    <span className="text-xs font-mono font-black bg-blue-100 dark:bg-[#0F1D2B] text-blue-700 dark:text-sky-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900/60 shadow-2xs">
                      Waybill #: {order.Tracking_ID}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 block">
                    Placed on {formatDate(order.Order_Placed_At)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  {getPaymentBadge(order)}
                  {getStatusBadge(order.Status)}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Total Amount</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {formatBDT(order.Subtotal + order.Shipping_Fee)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Content */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Purchased Items List */}
                <div className="lg:col-span-2 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Order Items ({order.Items.length})
                  </h4>

                  <div className="space-y-2">
                    {order.Items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-[#161C24] border border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                            alt={item.Name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#0C1014]"
                          />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{item.Name}</span>
                            <span className="text-slate-500 dark:text-zinc-400">
                              Quantity: {item.Quantity} • {formatCurrency(item.Price)} each
                            </span>
                          </div>
                        </div>

                        <span className="font-black text-blue-600 dark:text-sky-400">
                          {formatCurrency(item.Price * item.Quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.Additional_Info && (
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-sky-300 rounded-2xl text-xs flex items-center gap-2 border border-blue-900/30">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Note: {order.Additional_Info}</span>
                    </div>
                  )}
                </div>

                {/* Shipping & Payment Summary */}
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 space-y-3 text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    Delivery Destination
                  </h4>
                  <div className="text-slate-600 dark:text-zinc-300 space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white">{currentCustomer.Name}</p>
                    <p>{order.Shipping_Address.House_Name}, {order.Shipping_Address.Street}</p>
                    <p>{order.Shipping_Address.City}, {order.Shipping_Address.Postal_Code}</p>
                    {order.Shipping_Address.Additional_Info && (
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 italic pt-1">
                        "{order.Shipping_Address.Additional_Info}"
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-zinc-700 space-y-1.5">
                    <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                      <span>Subtotal</span>
                      <span>{formatCurrency(order.Subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                      <span>Shipping Fee</span>
                      <span>{order.Shipping_Fee === 0 ? 'FREE' : formatCurrency(order.Shipping_Fee)}</span>
                    </div>
                    {order.Transaction_ID && (
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-zinc-800">
                        <span className="text-slate-400">Tran ID:</span>
                        <span className="font-mono font-bold text-blue-600 dark:text-sky-400 truncate max-w-[130px]">
                          {order.Transaction_ID}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tracking is available after the vendor dispatches the order. */}
                  {order.Status === 'shipped' || order.Status === 'delivered' ? (
                    <button
                      type="button"
                      onClick={() => setTrackingOrderForMap(order)}
                      className="w-full mt-3 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Radio className={`w-3.5 h-3.5 ${order.Status === 'shipped' ? 'animate-pulse' : ''} text-amber-300`} />
                      <span>{order.Status === 'shipped' ? 'Track live delivery' : 'View delivery route'}</span>
                    </button>
                  ) : (
                    <p className="w-full mt-3 py-2 px-3 rounded-xl bg-slate-100 dark:bg-[#20252d] text-slate-600 dark:text-zinc-400 text-center text-[11px]">
                      Tracking will appear after the vendor ships this order.
                    </p>
                  )}

                  {/* Payment Receipt Button */}
                  <button
                    type="button"
                    onClick={() => setReceiptOrder(order)}
                    className="w-full mt-2 py-2 px-3 rounded-xl border border-sky-500/30 hover:border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 text-blue-700 dark:text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:shadow-xs cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>View SSLCommerz Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Portal: Live Marketplace Top Charts & Trends (from schema.sql routines) */}
      <div className="pt-6">
        <MarketplaceTrendsTopCharts
          onSelectProduct={onSelectProduct}
          onAddToCart={onAddToCart}
          allProducts={allProducts}
        />
      </div>

      {/* Fullscreen delivery tracking map */}
      {trackingOrderForMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-5xl">
            <LiveProductTrackingMap
              order={trackingOrderForMap}
              orders={trackableOrders}
              sellers={sellers}
              customerAddress={currentCustomer.Address}
              onSelectOrder={(ord) => setTrackingOrderForMap(ord)}
              onClose={() => setTrackingOrderForMap(null)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {receiptOrder && (
        <PaymentReceiptModal
          isOpen={Boolean(receiptOrder)}
          onClose={() => setReceiptOrder(null)}
          order={receiptOrder}
          customer={currentCustomer}
        />
      )}
    </div>
  );
};
