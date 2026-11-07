import React from 'react';
import { Customer, Order, OrderCancellationRequest, Product, RiderDelivery, Seller } from '../../types';
import { api, formatCurrency, formatBDT, formatDate } from '../../lib/api';
import { PaymentReceiptModal } from '../payment/PaymentReceiptModal';
import { Package, Truck, CheckCircle2, Clock, MapPin, Search, AlertCircle, Radio, Receipt, X, XCircle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLocale } from '../../lib/i18n';

const LiveProductTrackingMap = React.lazy(() => import('../tracking/LiveProductTrackingMap').then((module) => ({ default: module.LiveProductTrackingMap })));
const MarketplaceTrendsTopCharts = React.lazy(() => import('../storefront/MarketplaceTrendsTopCharts').then((module) => ({ default: module.MarketplaceTrendsTopCharts })));

interface CustomerOrdersProps {
  currentCustomer: Customer;
  orders: Order[];
  sellers?: Seller[];
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
  onRefreshOrders?: () => Promise<void>;
  onRetryOrders?: () => Promise<void>;
  onBrowseProducts?: () => void;
  ordersError?: string | null;
}

type CancellationDialog =
  | { kind: 'form'; order: Order }
  | { kind: 'notice'; title: string; message: string; tone: 'success' | 'info' | 'error' };

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  currentCustomer,
  orders,
  sellers = [],
  allProducts = [],
  onSelectProduct,
  onAddToCart,
  onRefreshOrders,
  onRetryOrders,
  onBrowseProducts,
  ordersError = null,
}) => {
  const { t } = useLocale();
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
  const [cancellationRequests, setCancellationRequests] = React.useState<OrderCancellationRequest[]>([]);
  const [cancellationRequestsError, setCancellationRequestsError] = React.useState<string | null>(null);
  const [cancellationSubmittingId, setCancellationSubmittingId] = React.useState<string | null>(null);
  const [cancellationDialog, setCancellationDialog] = React.useState<CancellationDialog | null>(null);
  const [cancellationReason, setCancellationReason] = React.useState('Not desired product');
  const [cancellationOtherReason, setCancellationOtherReason] = React.useState('');
  const [cancellationFormError, setCancellationFormError] = React.useState('');
  const cancellationDialogRef = useFocusTrap<HTMLDivElement>(Boolean(cancellationDialog));
  const refreshOrdersRef = React.useRef(onRefreshOrders);

  React.useEffect(() => { refreshOrdersRef.current = onRefreshOrders; }, [onRefreshOrders]);

  const loadRiderDeliveries = React.useCallback(async () => {
    try {
      setRiderDeliveries(await api.getCustomerRiderDeliveries());
    } catch (error: any) {
      setDeliveryNotice(error.message || 'Could not load rider shipment details.');
    }
  }, []);

  const loadCancellationRequests = React.useCallback(async () => {
    try {
      setCancellationRequests(await api.getOrderCancellationRequests());
      setCancellationRequestsError(null);
    } catch (error) {
      setCancellationRequestsError(error instanceof Error ? error.message : 'Could not load cancellation requests.');
    }
  }, []);

  React.useEffect(() => {
    void loadRiderDeliveries();
    void loadCancellationRequests();
    const refreshOrders = () => {
      void refreshOrdersRef.current?.().catch((error: any) => {
        setDeliveryNotice(error.message || 'Could not refresh your orders.');
      });
    };
    refreshOrders();
    const refreshTimer = window.setInterval(() => {
      void loadRiderDeliveries();
      void loadCancellationRequests();
      refreshOrders();
    }, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [loadRiderDeliveries, loadCancellationRequests, currentCustomer.Customer_ID]);

  const openCancellationDialog = (order: Order) => {
    setCancellationReason('Not desired product');
    setCancellationOtherReason('');
    setCancellationFormError('');
    setCancellationDialog({ kind: 'form', order });
  };

  const showCancellationAlreadySent = () => {
    setCancellationDialog({
      kind: 'notice',
      title: 'Request already sent',
      message: 'A cancellation request for this order is already under review. Please wait for the administrator’s decision.',
      tone: 'info',
    });
  };

  const requestCancellation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (cancellationDialog?.kind !== 'form') return;
    const order = cancellationDialog.order;
    const otherReason = cancellationOtherReason.trim();
    if (cancellationReason === 'Other' && !otherReason) {
      setCancellationFormError('Please tell us why you want to cancel.');
      return;
    }

    const reason = cancellationReason === 'Other' ? `Other: ${otherReason}` : cancellationReason;
    setCancellationSubmittingId(order.Order_ID);
    setCancellationFormError('');
    try {
      await api.requestOrderCancellation(order.Order_ID, reason);
      await loadCancellationRequests();
      setCancellationDialog({
        kind: 'notice',
        title: 'Cancellation request sent',
        message: order.Payment_Status === 'paid'
          ? 'Your request has been sent. An administrator will review the cancellation and any refund.'
          : 'Your request has been sent. An administrator will review it shortly.',
        tone: 'success',
      });
    } catch (error: any) {
      if (String(error.message || '').toLowerCase().includes('already open')) {
        await loadCancellationRequests();
        showCancellationAlreadySent();
      } else {
        setCancellationDialog({
          kind: 'notice',
          title: 'Request not sent',
          message: error.message || 'Could not send your cancellation request. Please try again.',
          tone: 'error',
        });
      }
    } finally {
      setCancellationSubmittingId(null);
    }
  };

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
  const trackableOrders = customerOrders.filter((o) =>
    o.Status === 'shipped'
    && (o.Fulfillments || []).some((fulfillment) => ['accepted', 'on_the_way'].includes(fulfillment.Delivery_Status || ''))
  );

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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-100 dark:bg-success-950/60 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-600 text-white shadow-xs">
            <Truck className="w-3.5 h-3.5" /> Shipped
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning-100 dark:bg-warning-950/60 text-warning-700 dark:text-warning-300 border border-warning-200 dark:border-warning-800">
            <Clock className="w-3.5 h-3.5" /> Processing Order
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger-100 dark:bg-danger-950/60 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800">
            <XCircle className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-black uppercase tracking-wider bg-pink-100 dark:bg-pink-950/60 text-[#E2136E] border border-pink-300 dark:border-pink-900/60">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E2136E]"></span>
          bKash • SSLCOMMERZ {isPaid ? '(Paid)' : '(Pending)'}
        </span>
      );
    }
    if (method === 'nagad') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-black uppercase tracking-wider bg-warning-100 dark:bg-warning-950/60 text-[#F7941D] border border-warning-300 dark:border-warning-900/60">
          Nagad • SSLCOMMERZ
        </span>
      );
    }
    if (method === 'rocket') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-black uppercase tracking-wider bg-brand-100 dark:bg-brand-950/60 text-[#8C3494] border border-brand-300 dark:border-brand-900/60">
          Rocket • SSLCOMMERZ
        </span>
      );
    }
    if (method === 'visa_mastercard') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-black uppercase tracking-wider bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 border border-brand-300 dark:border-brand-900/60">
          Cards • SSLCOMMERZ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-micro font-black uppercase tracking-wider bg-success-100 dark:bg-success-950/60 text-success-700 dark:text-success-400 border border-success-300 dark:border-success-800">
        Cash on Delivery
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Search and Orders Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#12161D] p-6 rounded-3xl border border-brand-100 dark:border-surface-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand-950/80 text-brand-400 text-micro font-bold tracking-wider uppercase border border-brand-800/40 mb-2">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>GLOBAL RADAR TELEMETRY</span>
          </div>
          <h1 className="text-2xl font-black text-surface-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            {t('orderHistory')}
          </h1>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
            Tracking package dispatches for Customer: <strong className="text-surface-800 dark:text-surface-200">{currentCustomer.Name}</strong> ({currentCustomer.Email})
          </p>
        </div>

        {/* Search by Tracking ID */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-surface-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTracking}
            onChange={(e) => setSearchTracking(e.target.value)}
            placeholder={t('trackingPlaceholder')}
            className="w-full pl-9 pr-3 py-2 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-full text-xs text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {deliveryNotice && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-300 bg-danger-50 p-3 text-sm text-danger-800 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200"><span>{deliveryNotice}</span><button type="button" onClick={() => void loadRiderDeliveries()} className="min-h-11 rounded-lg border border-danger-500/40 px-4 font-bold">{t('retry')}</button></div>}
      {cancellationRequestsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-300 bg-danger-50 p-3 text-sm text-danger-800 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200"><span>{cancellationRequestsError}</span><button type="button" onClick={() => void loadCancellationRequests()} className="min-h-11 rounded-lg border border-danger-500/40 px-4 font-bold">{t('retry')}</button></div>}

      {/* Live shipment tracking */}
      <div className="space-y-3">
        {trackableOrders.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#12161D] p-4">
            <Radio className="w-5 h-5 text-surface-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Live tracking starts after shipment</h2>
              <p className="text-xs text-surface-500 dark:text-surface-400">Your vendor will mark the order as shipped before its route appears here.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-brand-500 animate-pulse" />
                <h2 className="text-sm font-bold text-surface-900 dark:text-white">Live delivery tracking</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTopMap(!showTopMap)}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                {showTopMap ? 'Hide Live Map' : 'Show Live Map'}
              </button>
            </div>
            {showTopMap && (
              <React.Suspense fallback={<div aria-hidden="true" className="premium-skeleton h-80 rounded-2xl" />}>
                <LiveProductTrackingMap
                  order={trackableOrders[0]}
                  orders={trackableOrders}
                  sellers={sellers}
                  customerAddress={currentCustomer.Address}
                  onSelectOrder={(ord) => setTrackingOrderForMap(ord)}
                />
              </React.Suspense>
            )}
          </>
        )}
      </div>

      {riderDeliveries.length > 0 && (
        <section className="space-y-3" aria-labelledby="rider-shipments-title">
          <div>
            <h2 id="rider-shipments-title" className="text-lg font-bold text-surface-900 dark:text-white">Shop shipments and delivery confirmation</h2>
            <p className="text-xs text-surface-500 dark:text-surface-400">Each shop shipment is tracked and confirmed separately.</p>
          </div>
          {riderDeliveries.map((delivery) => (
            <article key={delivery.Delivery_ID} className="grid gap-4 rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-[#12161D] sm:grid-cols-[1fr_auto]">
              <div>
                <p className="font-bold text-surface-900 dark:text-white">Order {delivery.Order_ID}</p>
                <p className="mt-1 text-xs font-semibold text-surface-700 dark:text-surface-300">Shipment from {delivery.Seller_Name || 'ShopNiro merchant'}</p>
                <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">Rider: {delivery.Rider_Name || 'Assigning a nearby rider'}{delivery.Rider_Number ? ` · ${delivery.Rider_Number}` : ''}</p>
                <p className="mt-1 text-xs text-surface-500 dark:text-surface-500">Delivery status: {delivery.Status.replace('_', ' ')}</p>
                <ul className="mt-2 text-xs text-surface-600 dark:text-surface-400">{delivery.Items.map((item) => <li key={item.Product_ID}>{item.Quantity} × {item.Name}</li>)}</ul>
                {delivery.COD_Amount > 0 && <p className="mt-2 text-xs font-bold text-warning-800 dark:text-warning-300">Cash due on delivery: {formatBDT(delivery.COD_Amount)}</p>}
              </div>
              {delivery.Status === 'on_the_way' && (
                <form onSubmit={(event) => { event.preventDefault(); void confirmRiderDelivery(delivery); }} className="space-y-2 rounded-lg border border-success-300 bg-success-50 p-3 dark:border-success-900 dark:bg-success-950/30">
                  <label className="block text-micro font-bold uppercase tracking-wider text-success-800 dark:text-success-300">Enter the code your rider gave you after receiving the parcel<input aria-invalid={Boolean(deliveryCodeErrors[delivery.Delivery_ID])} aria-describedby={deliveryCodeErrors[delivery.Delivery_ID] ? `delivery-code-error-${delivery.Delivery_ID}` : undefined} value={deliveryCodes[delivery.Delivery_ID] || ''} onChange={(event) => { setDeliveryCodes({ ...deliveryCodes, [delivery.Delivery_ID]: event.target.value.replace(/\D/g, '').slice(0, 6) }); setDeliveryCodeErrors((current) => ({ ...current, [delivery.Delivery_ID]: '' })); }} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" className="mt-1 w-full rounded-lg border border-success-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.3em] dark:border-success-900 dark:bg-[#181F2A]" /></label>
                  {deliveryCodeErrors[delivery.Delivery_ID] && <p id={`delivery-code-error-${delivery.Delivery_ID}`} role="alert" className="text-xs font-semibold text-danger-700 dark:text-danger-300">{deliveryCodeErrors[delivery.Delivery_ID]}</p>}
                  {delivery.COD_Amount > 0 && <p className="text-xs text-warning-800 dark:text-warning-300">Cash collected: {delivery.COD_Collected ? 'confirmed by rider' : 'waiting for rider to record payment'}.</p>}
                  <button type="submit" disabled={confirmingDeliveryId === delivery.Delivery_ID || (deliveryCodes[delivery.Delivery_ID] || '').length !== 6} className="w-full rounded-lg bg-success-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{confirmingDeliveryId === delivery.Delivery_ID ? 'Confirming...' : 'Confirm received'}</button>
                </form>
              )}
              {delivery.Status === 'delivered' && !delivery.Review_ID && (
                <form onSubmit={(event) => { event.preventDefault(); void submitRiderReview(delivery); }} className="space-y-3 border-t border-surface-200 pt-4 sm:col-span-2 dark:border-surface-800">
                  <h3 className="text-sm font-bold text-surface-900 dark:text-white">Rate this delivery</h3>
                  <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto]">
                    <label className="text-xs font-semibold text-surface-600 dark:text-surface-300">Rating
                      <select value={reviewRatings[delivery.Delivery_ID] || 5} onChange={(event) => setReviewRatings({ ...reviewRatings, [delivery.Delivery_ID]: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 dark:border-surface-700 dark:bg-[#181F2A]"><option value={5}>5 · Excellent</option><option value={4}>4 · Good</option><option value={3}>3 · Okay</option><option value={2}>2 · Poor</option><option value={1}>1 · Bad</option></select>
                    </label>
                    <label className="text-xs font-semibold text-surface-600 dark:text-surface-300">Delivery timing
                      <select value={String(deliveryTimely[delivery.Delivery_ID] ?? true)} onChange={(event) => setDeliveryTimely({ ...deliveryTimely, [delivery.Delivery_ID]: event.target.value === 'true' })} className="mt-1 w-full rounded-lg border border-surface-300 bg-white px-3 py-2 dark:border-surface-700 dark:bg-[#181F2A]"><option value="true">Timely</option><option value="false">Late</option></select>
                    </label>
                    <button type="submit" disabled={reviewSubmittingId === delivery.Delivery_ID} className="self-end rounded-lg bg-success-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{reviewSubmittingId === delivery.Delivery_ID ? 'Saving...' : 'Submit review'}</button>
                    <div className="space-y-2 sm:col-span-3">
                      <textarea value={reviewTexts[delivery.Delivery_ID] || ''} onChange={(event) => setReviewTexts({ ...reviewTexts, [delivery.Delivery_ID]: event.target.value })} maxLength={2000} rows={2} placeholder="Optional comment about the delivery" className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-[#181F2A]" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={() => void draftRiderReview(delivery)} disabled={reviewDraftingId === delivery.Delivery_ID} className="rounded-lg border border-success-300 px-3 py-2 text-xs font-bold text-success-800 disabled:opacity-50 dark:border-success-800 dark:text-success-300">{reviewDraftingId === delivery.Delivery_ID ? 'Drafting...' : 'Draft optional comment with AI'}</button>
                        {reviewDraftErrors[delivery.Delivery_ID] && <p role="alert" className="text-xs text-danger-700 dark:text-danger-300">{reviewDraftErrors[delivery.Delivery_ID]}</p>}
                      </div>
                    </div>
                  </div>
                </form>
              )}
              {delivery.Review_ID && delivery.Status === 'delivered' && <p className="text-xs font-semibold text-success-700 dark:text-success-300 sm:col-span-2">Review submitted. Thank you.</p>}
            </article>
          ))}
        </section>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 && ordersError ? (
        <div role="alert" className="space-y-4 rounded-3xl border border-danger-300 bg-danger-50 p-8 text-center text-danger-800 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-200">
          <h3 className="text-lg font-bold">Your orders could not be loaded</h3>
          <p className="text-sm">{ordersError}</p>
          {onRetryOrders && <button type="button" onClick={() => void onRetryOrders()} className="min-h-11 rounded-full bg-danger-700 px-5 font-bold text-white">{t('retry')}</button>}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#12161D] rounded-3xl border border-brand-100 dark:border-surface-800 p-8 space-y-3 shadow-xl">
          <Package className="w-12 h-12 text-surface-300 dark:text-surface-700 mx-auto" />
          <h3 className="font-bold text-surface-800 dark:text-surface-200">{searchTracking ? t('noOrdersFound') : t('noOrders')}</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {searchTracking ? t('noSearchOrders') : t('ordersEmptyPrompt')}
          </p>
          {!searchTracking && onBrowseProducts && <button type="button" onClick={onBrowseProducts} className="min-h-11 rounded-full bg-brand-700 px-5 font-bold text-white">{t('browseProducts')}</button>}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div
              key={order.Order_ID}
              className="bg-white dark:bg-[#12161D] rounded-3xl border border-brand-100 dark:border-surface-800 shadow-xl overflow-hidden transition-all hover:border-brand-500/50"
            >
              {/* Order Bar Header */}
              <div className="p-5 bg-surface-50/70 dark:bg-[#161C24]/80 border-b border-surface-100 dark:border-surface-800 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-surface-500 dark:text-surface-400">
                      ID: {order.Order_ID}
                    </span>
                    <span className="text-surface-300 dark:text-surface-700">•</span>
                    <span className="text-xs font-mono font-black bg-brand-100 dark:bg-[#0F1D2B] text-brand-700 dark:text-brand-300 px-3 py-1 rounded-full border border-brand-200 dark:border-brand-900/60 shadow-2xs">
                      Waybill #: {order.Tracking_ID}
                    </span>
                  </div>
                  <span className="text-micro text-surface-400 dark:text-surface-500 block">
                    Placed on {formatDate(order.Order_Placed_At)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  {getPaymentBadge(order)}
                  {getStatusBadge(order.Status)}
                  {(() => {
                    const cancellationRequest = cancellationRequests.find((request) => request.Order_ID === order.Order_ID);
                    if (cancellationRequest?.Status === 'pending') {
                      return <button type="button" onClick={showCancellationAlreadySent} className="inline-flex items-center gap-1.5 rounded-full border border-warning-500/25 bg-warning-500/10 px-3 py-1 text-micro font-bold text-warning-800 dark:text-warning-200"><Clock className="h-3.5 w-3.5" />Cancellation pending</button>;
                    }
                    if (cancellationRequest && cancellationRequest.Status !== 'rejected') {
                      return <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-500/25 bg-warning-500/10 px-3 py-1 text-micro font-bold text-warning-800 dark:text-warning-200"><Clock className="h-3.5 w-3.5" />Cancellation {cancellationRequest.Status}</span>;
                    }
                    if (!['placed', 'processing'].includes(order.Status)) return null;
                    return (
                      <button type="button" onClick={() => openCancellationDialog(order)} disabled={cancellationSubmittingId === order.Order_ID} className="inline-flex items-center gap-1 rounded-full border border-danger-300 px-3 py-1.5 text-micro font-bold text-danger-700 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-900 dark:text-danger-300 dark:hover:bg-danger-950/30">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {cancellationSubmittingId === order.Order_ID ? 'Sending request…' : cancellationRequest?.Status === 'rejected' ? 'Request cancellation again' : order.Payment_Status === 'paid' ? 'Request cancellation & refund' : 'Request cancellation'}
                      </button>
                    );
                  })()}
                  <div className="text-right">
                    <span className="text-micro text-surface-400 dark:text-surface-500 uppercase font-bold block">Total Amount</span>
                    <span className="text-base font-black text-surface-900 dark:text-white">
                      {formatBDT(order.Subtotal + order.Shipping_Fee)}
                    </span>
                    <span className="text-micro text-surface-400 block">
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Content */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Purchased Items List */}
                <div className="lg:col-span-2 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                    Order Items ({order.Items.length})
                  </h4>

                  <div className="space-y-2">
                    {order.Items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-surface-50/50 dark:bg-[#161C24] border border-surface-100 dark:border-surface-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}
                            alt={item.Name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-surface-200 dark:border-surface-700 bg-white dark:bg-[#0C1014]"
                          />
                          <div>
                            <span className="font-bold text-surface-900 dark:text-white block">{item.Name}</span>
                            <span className="text-surface-500 dark:text-surface-400">
                              Quantity: {item.Quantity} • {formatCurrency(item.Price)} each
                            </span>
                          </div>
                        </div>

                        <span className="font-black text-brand-600 dark:text-brand-400">
                          {formatCurrency(item.Price * item.Quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.Additional_Info && (
                    <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 rounded-2xl text-xs flex items-center gap-2 border border-brand-900/30">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Note: {order.Additional_Info}</span>
                    </div>
                  )}
                </div>

                {/* Shipping & Payment Summary */}
                <div className="p-4 rounded-3xl bg-surface-50 dark:bg-[#161C24] border border-surface-200 dark:border-surface-800 space-y-3 text-xs">
                  <h4 className="font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    Delivery Destination
                  </h4>
                  <div className="text-surface-600 dark:text-surface-300 space-y-0.5">
                    <p className="font-bold text-surface-900 dark:text-white">{currentCustomer.Name}</p>
                    <p>{order.Shipping_Address.House_Name}, {order.Shipping_Address.Street}</p>
                    <p>{order.Shipping_Address.City}, {order.Shipping_Address.Postal_Code}</p>
                    {order.Shipping_Address.Additional_Info && (
                      <p className="text-micro text-surface-400 dark:text-surface-500 italic pt-1">
                        "{order.Shipping_Address.Additional_Info}"
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-surface-200 dark:border-surface-700 space-y-1.5">
                    <div className="flex justify-between text-surface-500 dark:text-surface-400">
                      <span>Subtotal</span>
                      <span>{formatCurrency(order.Subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-surface-500 dark:text-surface-400">
                      <span>Shipping Fee</span>
                      <span>{order.Shipping_Fee === 0 ? 'FREE' : formatCurrency(order.Shipping_Fee)}</span>
                    </div>
                    {order.Applied_Voucher && (
                      <div className="flex justify-between gap-3 text-micro text-success-700 dark:text-success-300">
                        <span>Promotions applied</span>
                        <span className="text-right font-semibold">{order.Applied_Voucher.split('+').join(' · ')}</span>
                      </div>
                    )}
                    {order.Transaction_ID && (
                      <div className="flex justify-between text-micro pt-1 border-t border-surface-100 dark:border-surface-800">
                        <span className="text-surface-400">Tran ID:</span>
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 truncate max-w-[130px]">
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
                      className="w-full mt-3 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Radio className={`w-3.5 h-3.5 ${order.Status === 'shipped' ? 'animate-pulse' : ''} text-warning-300`} />
                      <span>{order.Status === 'shipped' ? 'Track live delivery' : 'View delivery route'}</span>
                    </button>
                  ) : (
                    <p className="w-full mt-3 py-2 px-3 rounded-xl bg-surface-100 dark:bg-[#20252d] text-surface-600 dark:text-surface-400 text-center text-micro">
                      Tracking will appear after the vendor ships this order.
                    </p>
                  )}

                  {/* Payment Receipt Button */}
                  <button
                    type="button"
                    onClick={() => setReceiptOrder(order)}
                    className="w-full mt-2 py-2 px-3 rounded-xl border border-brand-500/30 hover:border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all hover:shadow-xs cursor-pointer"
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
        <React.Suspense fallback={<div aria-hidden="true" className="premium-skeleton h-72 rounded-2xl" />}>
          <MarketplaceTrendsTopCharts
            onSelectProduct={onSelectProduct}
            onAddToCart={onAddToCart}
            allProducts={allProducts}
          />
        </React.Suspense>
      </div>

      {/* Fullscreen delivery tracking map */}
      {trackingOrderForMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-5xl">
            <React.Suspense fallback={<div aria-hidden="true" className="premium-skeleton h-[70vh] rounded-2xl" />}>
              <LiveProductTrackingMap
                order={trackingOrderForMap}
                orders={trackableOrders}
                sellers={sellers}
                customerAddress={currentCustomer.Address}
                onSelectOrder={(ord) => setTrackingOrderForMap(ord)}
                onClose={() => setTrackingOrderForMap(null)}
                isModal={true}
              />
            </React.Suspense>
          </div>
        </div>
      )}

      {cancellationDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5">
          <div
            ref={cancellationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancellation-dialog-title"
            tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape' && !cancellationSubmittingId) setCancellationDialog(null); }}
            className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-5 shadow-2xl outline-none dark:border-surface-700 dark:bg-[#12161D] sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="cancellation-dialog-title" className="text-lg font-bold text-surface-900 dark:text-white">
                  {cancellationDialog.kind === 'form' ? 'Request order cancellation' : cancellationDialog.title}
                </h2>
                {cancellationDialog.kind === 'form' && (
                  <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">Choose a reason so the seller and administrator can review your request.</p>
                )}
              </div>
              <button type="button" onClick={() => setCancellationDialog(null)} disabled={Boolean(cancellationSubmittingId)} aria-label="Close cancellation dialog" className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 disabled:opacity-50 dark:text-surface-400 dark:hover:bg-surface-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {cancellationDialog.kind === 'form' ? (
              <form onSubmit={(event) => void requestCancellation(event)} className="space-y-4">
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-200">Reason for cancellation</legend>
                  {['Not desired product', 'Wrong location', 'Wrong choice', 'Other'].map((reason) => (
                    <label key={reason} className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-200 px-3 py-2.5 text-sm text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800/70">
                      <input type="radio" name="cancellation-reason" value={reason} checked={cancellationReason === reason} onChange={() => { setCancellationReason(reason); setCancellationFormError(''); }} className="accent-danger-600" />
                      {reason}
                    </label>
                  ))}
                </fieldset>
                {cancellationReason === 'Other' && (
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Tell us more
                    <textarea value={cancellationOtherReason} onChange={(event) => { setCancellationOtherReason(event.target.value); setCancellationFormError(''); }} maxLength={493} rows={3} placeholder="Write your reason" className="mt-1.5 w-full resize-y rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:ring-2 focus:ring-danger-500 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white" />
                    <span className="mt-1 block text-right text-xs text-surface-500 dark:text-surface-400">{cancellationOtherReason.length}/493</span>
                  </label>
                )}
                {cancellationFormError && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-300">{cancellationFormError}</p>}
                <div className="flex justify-end gap-2 border-t border-surface-200 pt-4 dark:border-surface-800">
                  <button type="button" onClick={() => setCancellationDialog(null)} disabled={Boolean(cancellationSubmittingId)} className="rounded-lg px-4 py-2 text-sm font-semibold text-surface-600 hover:bg-surface-100 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-800">Keep order</button>
                  <button type="submit" disabled={cancellationSubmittingId === cancellationDialog.order.Order_ID} className="rounded-lg bg-danger-700 px-4 py-2 text-sm font-semibold text-white hover:bg-danger-800 disabled:cursor-wait disabled:opacity-60 dark:bg-danger-600 dark:hover:bg-danger-500">
                    {cancellationSubmittingId === cancellationDialog.order.Order_ID ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p role={cancellationDialog.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${cancellationDialog.tone === 'error' ? 'text-danger-700 dark:text-danger-300' : 'text-surface-700 dark:text-surface-300'}`}>
                  {cancellationDialog.message}
                </p>
                <div className="mt-5 flex justify-end border-t border-surface-200 pt-4 dark:border-surface-800">
                  <button type="button" autoFocus onClick={() => setCancellationDialog(null)} className="rounded-lg bg-surface-900 px-4 py-2 text-sm font-semibold text-white hover:bg-surface-700 dark:bg-surface-100 dark:text-surface-900 dark:hover:bg-white">Close</button>
                </div>
              </div>
            )}
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
