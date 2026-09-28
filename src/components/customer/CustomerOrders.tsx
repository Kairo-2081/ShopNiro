import React from 'react';
import { Customer, Order, Product } from '../../types';
import { formatCurrency, formatBDT, formatDate } from '../../lib/api';
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
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  currentCustomer,
  orders,
  allProducts = [],
  onSelectProduct,
  onAddToCart,
}) => {
  const [searchTracking, setSearchTracking] = React.useState('');
  const [receiptOrder, setReceiptOrder] = React.useState<Order | null>(null);
  const [trackingOrderForMap, setTrackingOrderForMap] = React.useState<Order | null>(null);
  const [showTopMap, setShowTopMap] = React.useState<boolean>(true);

  const customerOrders = orders.filter((o) => o.Customer_ID === currentCustomer.Customer_ID);

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

      {/* Live Google Maps Radar for Products */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-500 animate-pulse" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Live Product Locations on Google Maps
            </h2>
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
            order={filteredOrders[0] || null}
            orders={customerOrders}
            onSelectOrder={(ord) => setTrackingOrderForMap(ord)}
          />
        )}
      </div>

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

                  {/* Live Google Maps Tracking Button */}
                  <button
                    type="button"
                    onClick={() => setTrackingOrderForMap(order)}
                    className="w-full mt-3 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse text-amber-300" />
                    <span>Track Live on Google Maps</span>
                  </button>

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

      {/* Fullscreen Google Maps Product Tracking Modal */}
      {trackingOrderForMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-5xl">
            <LiveProductTrackingMap
              order={trackingOrderForMap}
              orders={customerOrders}
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
