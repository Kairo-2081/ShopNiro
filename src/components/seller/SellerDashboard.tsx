import React from 'react';
import { Seller, Product, Order, Review, Category, ProductStatus } from '../../types';
import { api, formatCurrency, formatDate } from '../../lib/api';
import { SellerProductModal } from './SellerProductModal';
import { SellerProfileModal } from './SellerProfileModal';
import { SellerBundlesPanel } from './SellerBundlesPanel';
import { Section } from '../Section';
import { StarRating } from '../StarRating';
import { discountedPriceForVoucher, isVoucherExpired } from '../../lib/vouchers';
import {
  Package,
  ShoppingBag,
  Star,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Wallet,
  BarChart3,
  Tag,
  X,
} from 'lucide-react';

const compactSellerValue = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
const sellerPriceFormatter = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface SellerDashboardProps {
  currentSeller: Seller;
  products: Product[];
  categories: Category[];
  orders: Order[];
  reviews: Review[];
  isLoading?: boolean;
  onSaveProduct: (data: Partial<Product>) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onUpdateProductStatus: (productId: string, status: ProductStatus) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: string) => Promise<void>;
  onUpdateSellerProfile: (updates: Partial<Seller>) => Promise<Seller>;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  currentSeller,
  products,
  categories,
  orders,
  reviews,
  isLoading = false,
  onSaveProduct,
  onDeleteProduct,
  onUpdateProductStatus,
  onUpdateOrderStatus,
  onUpdateSellerProfile,
}) => {
  const [activeTab, setActiveTab] = React.useState<'products' | 'orders' | 'analytics' | 'reviews' | 'wallet' | 'promotions'>('products');
  const [isProductModalOpen, setIsProductModalOpen] = React.useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);
  const [productToEdit, setProductToEdit] = React.useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = React.useState(false);
  const [deleteProductError, setDeleteProductError] = React.useState('');
  const [restockingProductId, setRestockingProductId] = React.useState<string | null>(null);
  const [restockQuantity, setRestockQuantity] = React.useState('');
  const [isRestocking, setIsRestocking] = React.useState(false);
  const [restockError, setRestockError] = React.useState('');
  const [sellerWallet, setSellerWallet] = React.useState<{ balance: number; entries: any[] } | null>(null);
  const [walletError, setWalletError] = React.useState<string | null>(null);
  const [productAnalytics, setProductAnalytics] = React.useState<Array<{
    Product_ID: string;
    Impressions_7d: number;
    Clicks_7d: number;
    CTR_7d: number | null;
    CTR_Previous_7d: number | null;
    Returned_Units_30d: number;
    Sold_Units_30d: number;
    Return_Rate_30d: number | null;
  }>>([]);
  const [analyticsError, setAnalyticsError] = React.useState('');
  const [isLoadingAnalytics, setIsLoadingAnalytics] = React.useState(false);

  React.useEffect(() => {
    if (activeTab !== 'wallet') return;
    api.getSellerWallet().then(setSellerWallet).catch((error: any) => setWalletError(error.message || 'Could not load seller wallet.'));
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== 'analytics') return;
    let isMounted = true;
    setIsLoadingAnalytics(true);
    api.getSellerProductAnalytics().then((metrics) => {
      if (isMounted) setProductAnalytics(metrics);
    }).catch((error: any) => {
      if (isMounted) setAnalyticsError(error.message || 'Could not load listing analytics.');
    }).finally(() => {
      if (isMounted) setIsLoadingAnalytics(false);
    });
    return () => { isMounted = false; };
  }, [activeTab]);

  // Filter entities specific to this seller
  const sellerProducts = products.filter((p) => p.Seller_ID === currentSeller.Seller_ID);
  const sellerOrders = orders.filter((o) =>
    o.Items.some((item) => item.Seller_ID === currentSeller.Seller_ID)
  );
  const billableSellerOrders = sellerOrders.filter((order) => order.Status !== 'cancelled' && order.Payment_Status !== 'refunded');

  const sellerProductIds = new Set(sellerProducts.map((p) => p.Product_ID));
  const sellerReviews = reviews.filter((r) => sellerProductIds.has(r.Product_ID));

  const confirmDeleteProduct = async () => {
    if (!productToDelete || isDeletingProduct) return;
    setIsDeletingProduct(true);
    setDeleteProductError('');
    try {
      await onDeleteProduct(productToDelete.Product_ID);
      setProductToDelete(null);
    } catch (error: any) {
      setDeleteProductError(error.message || 'Could not delete this product.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const restockProduct = async (product: Product) => {
    const quantity = Math.floor(Number(restockQuantity));
    if (!Number.isFinite(quantity) || quantity <= 0 || isRestocking) {
      setRestockError('Enter a whole quantity greater than zero.');
      return;
    }
    setIsRestocking(true);
    setRestockError('');
    try {
      await onSaveProduct({ Product_ID: product.Product_ID, Stock: Number(product.Stock) + quantity });
      setRestockingProductId(null);
      setRestockQuantity('');
    } catch (error: any) {
      setRestockError(error.message || 'Could not update stock.');
    } finally {
      setIsRestocking(false);
    }
  };

  const totalSalesRevenue = billableSellerOrders.reduce((sum, order) => {
    const sellerItems = order.Items.filter((i) => i.Seller_ID === currentSeller.Seller_ID);
    return sum + sellerItems.reduce((acc, item) => acc + item.Price * item.Quantity, 0);
  }, 0);
  const sellerUnitsSold = billableSellerOrders.reduce((total, order) => total + order.Items
    .filter((item) => item.Seller_ID === currentSeller.Seller_ID)
    .reduce((units, item) => units + Math.max(0, Number(item.Quantity) || 0), 0), 0);
  const averageSellerOrderValue = billableSellerOrders.length ? totalSalesRevenue / billableSellerOrders.length : 0;

  const sellerProductPerformance = (() => {
    const totals = new Map<string, { units: number; revenue: number }>();
    billableSellerOrders.forEach((order) => {
      order.Items.filter((item) => item.Seller_ID === currentSeller.Seller_ID).forEach((item) => {
        const current = totals.get(item.Product_ID) || { units: 0, revenue: 0 };
        current.units += Math.max(0, Number(item.Quantity) || 0);
        current.revenue += Math.max(0, Number(item.Price) || 0) * Math.max(0, Number(item.Quantity) || 0);
        totals.set(item.Product_ID, current);
      });
    });
    return Array.from(totals.entries())
      .map(([productId, metrics]) => ({ product: sellerProducts.find((product) => product.Product_ID === productId), ...metrics }))
      .filter((row): row is typeof row & { product: Product } => Boolean(row.product))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  })();

  const sellerPricingGuidance = sellerProducts.map((product) => {
    const comparablePrices = products
      .filter((candidate) => candidate.Product_ID !== product.Product_ID
        && candidate.Category_ID === product.Category_ID
        && candidate.Product_Status === 'active'
        && Number(candidate.Stock) > 0)
      .map((candidate) => Number(candidate.Price) || 0)
      .filter((price) => price > 0)
      .sort((first, second) => first - second);
    const middle = Math.floor(comparablePrices.length / 2);
    const categoryMedian = comparablePrices.length
      ? comparablePrices.length % 2
        ? comparablePrices[middle]
        : (comparablePrices[middle - 1] + comparablePrices[middle]) / 2
      : null;
    const effectivePrice = product.Voucher && !isVoucherExpired(product.Voucher_Expires_At)
      ? discountedPriceForVoucher(product.Price, product.Voucher)
      : product.Price;
    const variance = categoryMedian ? ((effectivePrice - categoryMedian) / categoryMedian) * 100 : null;
    return { product, categoryMedian, effectivePrice, variance };
  });

  const recentMonthlySales = (() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString(undefined, { month: 'short' }),
        revenue: 0,
        orders: 0,
      };
    });
    const monthMap = new Map(months.map((month) => [month.key, month]));
    billableSellerOrders.forEach((order) => {
      const date = new Date(order.Order_Placed_At);
      if (Number.isNaN(date.getTime())) return;
      const month = monthMap.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (!month) return;
      month.orders += 1;
      month.revenue += order.Items
        .filter((item) => item.Seller_ID === currentSeller.Seller_ID)
        .reduce((sum, item) => sum + Math.max(0, Number(item.Price) || 0) * Math.max(0, Number(item.Quantity) || 0), 0);
    });
    return months;
  })();
  const maximumMonthlyRevenue = Math.max(1, ...recentMonthlySales.map((month) => month.revenue));

  const avgSellerRating =
    sellerReviews.length > 0
      ? sellerReviews.reduce((sum, r) => sum + r.Rating, 0) / sellerReviews.length
      : 0;

  const getApprovalStatusBanner = () => {
    switch (currentSeller.Status) {
      case 'approved':
        return (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300 sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="min-w-0 break-words leading-relaxed">
                <strong className="font-bold">Merchant Approved &amp; Live:</strong> Your store is active on ShopNiro marketplace.
              </div>
            </div>
            <span className="shrink-0 self-start rounded-full bg-emerald-500 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-white sm:self-center">
              Live Verified
            </span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
              <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="min-w-0 break-words leading-relaxed">
                <strong className="font-bold">Awaiting Admin Verification:</strong> Your merchant profile is pending review. Product drafts can be created now.
              </div>
            </div>
            <span className="shrink-0 self-start rounded-full bg-amber-500 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-white sm:self-center">
              Pending Review
            </span>
          </div>
        );
      case 'suspended':
      case 'rejected':
        return (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-200 sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div className="min-w-0 break-words leading-relaxed">
                <strong className="font-bold">Account Restricted ({currentSeller.Status}):</strong> Your merchant account has been paused by platform administration.
              </div>
            </div>
            <span className="shrink-0 self-start rounded-full bg-rose-600 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-white sm:self-center">
              Restricted
            </span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Seller Store Header */}
      <div className="bg-white dark:bg-[#12161D] p-6 rounded-3xl border border-sky-100 dark:border-sky-500/20 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
            <img
              src={currentSeller.Logo}
              alt={currentSeller.Name}
              className="h-16 w-16 shrink-0 rounded-2xl border border-sky-100 bg-slate-50 object-cover shadow-sm dark:border-zinc-700 dark:bg-[#181F2A]"
            />
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-bold leading-tight text-slate-900 dark:text-white [overflow-wrap:anywhere] sm:text-2xl">
                {currentSeller.Name}
              </h1>
              <p className="mt-1 max-w-lg break-words text-xs leading-relaxed text-slate-500 dark:text-zinc-400 [overflow-wrap:anywhere]">
                {currentSeller.Description}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                <span className="break-all font-mono">ID: {currentSeller.Seller_ID}</span>
                <span aria-hidden="true">•</span>
                <span className="break-all">{currentSeller.Email}</span>
                <span aria-hidden="true">•</span>
                <span>Member since {formatDate(currentSeller.Created_At)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-300 text-slate-700 dark:border-zinc-700 dark:text-zinc-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              <Edit className="w-4 h-4" />
              <span>Edit store details</span>
            </button>
            <button
              disabled={currentSeller.Status !== 'approved'}
              onClick={() => {
                setProductToEdit(null);
                setIsProductModalOpen(true);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs shadow-lg transition-all cursor-pointer ${
                currentSeller.Status !== 'approved'
                  ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                  : 'premium-button text-white shadow-md hover:-translate-y-0.5'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product Listing</span>
            </button>
          </div>
        </div>

        {getApprovalStatusBanner()}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-card flex items-center justify-between rounded-3xl p-5">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-400">
              Listed Products
            </span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isLoading ? <span className="premium-skeleton block h-7 w-16 rounded-full" /> : sellerProducts.length}
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#a99b72]/10 text-[#80734f] dark:text-[#d0c8a5]">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card flex items-center justify-between rounded-3xl p-5">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-400">
              Total Revenue
            </span>
            <div className="text-2xl font-extrabold text-emerald-500 mt-1">
              {isLoading ? <span className="premium-skeleton block h-7 w-28 rounded-full" /> : formatCurrency(totalSalesRevenue)}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card flex items-center justify-between rounded-3xl p-5">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-400">
              Orders Received
            </span>
            <div className="mt-1 text-2xl font-extrabold text-[#77775a] dark:text-[#c0c09d]">
              {isLoading ? <span className="premium-skeleton block h-7 w-16 rounded-full" /> : sellerOrders.length}
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#77775a]/10 text-[#77775a] dark:text-[#c0c09d]">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="premium-card flex items-center justify-between rounded-3xl p-5">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-400">
              Store Rating
            </span>
            <div className="text-2xl font-extrabold text-amber-500 mt-1 flex items-center gap-1">
              {isLoading ? <span className="premium-skeleton block h-7 w-14 rounded-full" /> : avgSellerRating.toFixed(1)}
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Star className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex max-w-full flex-wrap gap-2 border-b border-[#a99b72]/25 pb-2 dark:border-[#a99b72]/20">
        <button
          onClick={() => setActiveTab('products')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'products'
              ? 'premium-button text-white shadow-md'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Catalog ({sellerProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'orders'
              ? 'premium-button text-white shadow-md'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Fulfillment Orders ({sellerOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'reviews'
              ? 'premium-button text-white shadow-md'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Customer Reviews ({sellerReviews.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'premium-button text-white shadow-md'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Sales Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('promotions')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'promotions'
              ? 'premium-button text-white shadow-md'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Tag className="h-4 w-4" />
          <span>Deals &amp; Bundles</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`shrink-0 whitespace-nowrap px-5 py-2.5 font-bold text-xs rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'wallet'
              ? 'premium-button text-white shadow-md'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181F2A]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>COD remittances</span>
        </button>
      </div>

      {/* Tab Content */}

      {/* Tab 1: Product Management */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {sellerProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-sky-500/20 p-8 space-y-3">
              <Package className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-zinc-200">No products created yet</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Click "+ Add New Product Listing" above to publish products under your seller brand.
              </p>
            </div>
          ) : (
            <div className="premium-surface overflow-hidden rounded-xl shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-[#a99b72]/20 bg-[#f0eee5] font-semibold uppercase tracking-wider text-[#70674a] dark:border-[#d0c8a5]/10 dark:bg-[#201f18] dark:text-[#c9c2a1]">
                    <tr>
                      <th className="p-4">Product Details</th>
                      <th className="p-4 text-right">Price</th>
                      <th className="p-4">Stock Inventory</th>
                      <th className="p-4">Voucher</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#a99b72]/15 dark:divide-[#d0c8a5]/10">
                    {sellerProducts.map((p) => {
                      const catName = categories.find((c) => c.Category_ID === p.Category_ID)?.Name || 'General';
                      return (
                        <tr key={p.Product_ID} className="transition-colors hover:bg-[#a99b72]/[0.05] dark:hover:bg-[#d0c8a5]/[0.05]">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.Image}
                                alt={p.Name}
                                referrerPolicy="no-referrer"
                                className="h-12 w-12 shrink-0 rounded-xl object-cover bg-slate-100 border border-[#a99b72]/20 dark:border-[#d0c8a5]/15"
                              />
                              <div className="min-w-0">
                                <span className="block break-words font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere]">{p.Name}</span>
                                <span className="block break-words text-[12px] text-slate-500 dark:text-zinc-400 [overflow-wrap:anywhere]">{catName}</span>
                                <span className="block break-all text-[11px] font-mono text-slate-500 dark:text-zinc-400">ID: {p.Product_ID}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{sellerPriceFormatter.format(Number(p.Price) || 0)}</td>
                          <td className="p-4 font-semibold">
                            <div className="flex min-w-32 flex-col items-start gap-1.5">
                              {Number(p.Stock) === 0 ? (
                                <span className="font-bold text-rose-700 dark:text-rose-300">Out of stock</span>
                              ) : Number(p.Stock) <= 5 ? (
                                <span className="font-bold text-amber-700 dark:text-amber-300">Low: {p.Stock} left</span>
                              ) : (
                                <span className="font-medium text-slate-600 dark:text-zinc-300">{p.Stock} in stock</span>
                              )}
                              {restockingProductId === p.Product_ID ? (
                                <form onSubmit={(event) => { event.preventDefault(); void restockProduct(p); }} className="flex flex-wrap items-center gap-1.5">
                                  <input type="number" min="1" step="1" required value={restockQuantity} onChange={(event) => setRestockQuantity(event.target.value)} aria-label={`Quantity to add for ${p.Name}`} placeholder="Qty" className="luxury-input h-9 min-h-9 w-20 rounded-lg px-2 text-xs tabular-nums" />
                                  <button type="submit" disabled={isRestocking} className="rounded-lg bg-[#77775a] px-2.5 py-2 text-[11px] font-bold text-white hover:bg-[#66664c] disabled:opacity-50">{isRestocking ? 'Saving…' : 'Save'}</button>
                                  <button type="button" onClick={() => { setRestockingProductId(null); setRestockError(''); }} aria-label={`Cancel restock for ${p.Name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] dark:text-zinc-300 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
                                  {restockError && <span role="alert" className="w-full text-[10px] text-rose-600 dark:text-rose-300">{restockError}</span>}
                                </form>
                              ) : (
                                <button type="button" onClick={() => { setRestockError(''); setRestockQuantity(''); setRestockingProductId(p.Product_ID); }} className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-[#70674a] underline decoration-[#a99b72]/40 underline-offset-2 hover:text-[#514b3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] dark:text-[#d0c8a5]">Restock</button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            {p.Voucher ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#a99b72]/25 bg-[#a99b72]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#70674a] dark:border-[#d0c8a5]/15 dark:bg-[#d0c8a5]/10 dark:text-[#d0c8a5]">
                                <Tag className="h-3 w-3" />
                                {p.Voucher}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-500">No voucher</span>
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={p.Product_Status === 'active'}
                              aria-label={`${p.Product_Status === 'active' ? 'Pause' : 'Activate'} ${p.Name}`}
                              onClick={() =>
                                onUpdateProductStatus(
                                  p.Product_ID,
                                  p.Product_Status === 'active' ? 'inactive' : 'active'
                                )
                              }
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all duration-200 cursor-pointer hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] ${
                                p.Product_Status === 'active'
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {p.Product_Status}
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                aria-label={`Edit ${p.Name}`}
                                onClick={() => {
                                  setProductToEdit(p);
                                  setIsProductModalOpen(true);
                                }}
                                className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-[#a99b72]/10 hover:text-[#80734f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] dark:text-zinc-400 dark:hover:bg-[#d0c8a5]/10 dark:hover:text-[#d0c8a5]"
                                title="Edit Product"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${p.Name}`}
                                onClick={() => { setDeleteProductError(''); setProductToDelete(p); }}
                                className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-rose-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-zinc-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'promotions' && <SellerBundlesPanel products={sellerProducts} />}

      {/* Tab 2: Incoming Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {sellerOrders.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-sky-500/20 p-8 space-y-3">
              <Truck className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-zinc-200">No incoming orders yet</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Orders containing your seller products will appear here for fulfillment status updates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sellerOrders.map((order) => {
                const myItems = order.Items.filter((i) => i.Seller_ID === currentSeller.Seller_ID);
                const myFulfillment = order.Fulfillments?.find((fulfillment) => fulfillment.Seller_ID === currentSeller.Seller_ID);
                const fulfillmentStatus = myFulfillment?.Status || order.Status;

                return (
                  <div
                    key={order.Order_ID}
                    className="bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-sky-500/20 p-5 shadow-xs space-y-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 dark:border-zinc-800 pb-3">
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          Order #{order.Order_ID}
                        </span>
                        <span className="text-blue-500 dark:text-sky-400 ml-2 font-mono font-bold">
                          Tracking: {order.Tracking_ID}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              order.Payment_Status === 'paid'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {order.Payment_Status === 'paid'
                              ? `Paid via ${order.Payment_Method?.toUpperCase() || 'SSLCOMMERZ'}`
                              : 'Cash on Delivery (Pending)'}
                          </span>
                          {order.Transaction_ID && (
                            <span className="font-mono text-[10px] text-slate-400">
                              Trx: {order.Transaction_ID}
                            </span>
                          )}
                        </div>
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          Placed on {formatDate(order.Order_Placed_At)}
                        </span>
                      </div>

                      {/* Fulfillment Status Selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-zinc-400 font-medium">Fulfillment:</span>
                        <select
                          value={fulfillmentStatus}
                          onChange={(e) => onUpdateOrderStatus(order.Order_ID, e.target.value)}
                          aria-label={`Fulfillment status for order ${order.Order_ID}`}
                          className="luxury-control bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-full px-3 py-1.5 font-bold text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]"
                        >
                          <option value={fulfillmentStatus}>
                            {fulfillmentStatus === 'placed' ? 'Placed (Pending)' :
                              fulfillmentStatus === 'processing' ? 'Processing' :
                              fulfillmentStatus === 'shipped' ? 'Shipped (Tracking Active)' :
                              fulfillmentStatus === 'delivered' ? 'Delivered' : 'Cancelled'}
                          </option>
                          {fulfillmentStatus === 'placed' && <option value="processing">Processing</option>}
                          {['placed', 'processing'].includes(fulfillmentStatus) && (
                            <option value="shipped">Mark as Shipped</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Items from this seller */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <span className="font-semibold text-slate-500 dark:text-zinc-400 uppercase text-[10px]">Your Products in this order</span>
                        {myItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-[#181F2A]">
                            <span className="text-slate-800 dark:text-zinc-200">{item.Quantity}x {item.Name}</span>
                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.Price * item.Quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1 p-3 rounded-2xl bg-slate-50 dark:bg-[#181F2A]">
                        <span className="font-semibold text-slate-500 dark:text-zinc-400 uppercase text-[10px]">Destination Address</span>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {order.Shipping_Address.House_Name}, {order.Shipping_Address.Street}
                        </p>
                        <p className="text-slate-600 dark:text-zinc-300">
                          {order.Shipping_Address.City}, {order.Shipping_Address.Postal_Code}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <Section title="Sales Analytics" description="Sales, product performance, and pricing guidance for your store." className="space-y-4">
          {isLoadingAnalytics && (
            <div role="status" aria-label="Loading seller analytics" aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="premium-skeleton h-56 rounded-2xl" />
              <div className="premium-skeleton h-56 rounded-2xl" />
            </div>
          )}
          {!isLoadingAnalytics && <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Net product sales', value: formatCurrency(totalSalesRevenue), note: 'Excludes cancelled and refunded orders' },
              { label: 'Units sold', value: sellerUnitsSold.toLocaleString(), note: `${billableSellerOrders.length} eligible orders` },
              { label: 'Average order value', value: formatCurrency(averageSellerOrderValue), note: 'Across eligible seller orders' },
              { label: 'Product rating', value: avgSellerRating ? `${avgSellerRating.toFixed(1)} / 5` : 'No ratings', note: `${sellerReviews.length} customer reviews` },
            ].map((metric) => (
              <article key={metric.label} className="rounded-2xl border border-sky-100 bg-white p-4 dark:border-sky-500/20 dark:bg-[#12161D]">
                <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-zinc-400">{metric.label}</p>
                <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{metric.value}</p>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">{metric.note}</p>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#12161D]">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Monthly sales</h2>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Product revenue across the last six months.</p>
              <div role="img" aria-label="Monthly product sales for the last six months" className="mt-5 grid h-44 grid-cols-6 items-end gap-2">
                {recentMonthlySales.map((month) => (
                  <div key={month.key} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                    <span className="text-center text-[9px] tabular-nums text-slate-500 dark:text-zinc-400">{month.revenue ? compactSellerValue(month.revenue) : ''}</span>
                    <div className="flex h-28 w-full items-end rounded-md bg-slate-100 dark:bg-[#1B2430]">
                      <div
                        className="w-full rounded-md bg-emerald-600 transition-[height] duration-500 dark:bg-emerald-500"
                        style={{ height: `${month.revenue ? Math.max(5, (month.revenue / maximumMonthlyRevenue) * 100) : 0}%` }}
                        title={`${month.label}: ${formatCurrency(month.revenue)} · ${month.orders} orders`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-600 dark:text-zinc-300">{month.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#12161D]">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Top products</h2>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Ranked by net product sales.</p>
              {sellerProductPerformance.length ? (
                <ol className="mt-3 divide-y divide-slate-100 dark:divide-zinc-800">
                  {sellerProductPerformance.map(({ product, units, revenue }, index) => (
                    <li key={product.Product_ID} className="flex items-center gap-3 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">{index + 1}</span>
                      <img src={product.Image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{product.Name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">{units.toLocaleString()} units sold</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-slate-800 dark:text-zinc-200">{formatCurrency(revenue)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-10 text-center text-xs text-slate-500 dark:text-zinc-400">Sales analytics appear after your first eligible order.</p>
              )}
            </section>
          </div>
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#12161D]">
            <div className="p-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Price positioning</h2>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Compares effective price with the median of other active, in-stock ShopNiro listings in the same category. This is not external competitor data or a margin estimate.</p>
            </div>
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500 dark:border-zinc-800 dark:bg-[#181F2A] dark:text-zinc-400"><tr><th className="p-3">Product</th><th className="p-3">List price</th><th className="p-3">Effective price</th><th className="p-3">Category median</th><th className="p-3">Position</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {sellerPricingGuidance.map(({ product, categoryMedian, effectivePrice, variance }) => (
                  <tr key={product.Product_ID}>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{product.Name}</td>
                    <td className="p-3 tabular-nums">{formatCurrency(product.Price)}</td>
                    <td className="p-3 tabular-nums">{formatCurrency(effectivePrice)}</td>
                    <td className="p-3 tabular-nums">{categoryMedian === null ? 'Not enough listings' : formatCurrency(categoryMedian)}</td>
                    <td className="p-3 text-slate-600 dark:text-zinc-300">{variance === null ? 'No comparison' : `${variance > 0 ? '+' : ''}${variance.toFixed(1)}% vs median`}</td>
                  </tr>
                ))}
                {!sellerPricingGuidance.length && <tr><td colSpan={5} className="p-6 text-center text-xs text-slate-500">Add products to compare category pricing.</td></tr>}
              </tbody>
            </table>
          </section>
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#12161D]">
            <div className="p-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Listing performance</h2>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Click-through uses unique daily storefront impressions and clicks for the last 7 days; return rate uses refunded order units from the last 30 days.</p>
            </div>
            {analyticsError && <p role="alert" className="mx-5 mb-3 text-xs text-rose-700 dark:text-rose-300">{analyticsError}</p>}
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500 dark:border-zinc-800 dark:bg-[#181F2A] dark:text-zinc-400">
                <tr><th className="p-3">Product</th><th className="p-3">Views · 7d</th><th className="p-3">Clicks · 7d</th><th className="p-3">CTR</th><th className="p-3">Returned · 30d</th><th className="p-3">Return rate</th><th className="p-3">Next action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {productAnalytics.map((metric) => {
                  const product = sellerProducts.find((item) => item.Product_ID === metric.Product_ID);
                  if (!product) return null;
                  const lowCtr = metric.Impressions_7d >= 25 && metric.CTR_7d !== null && metric.CTR_7d < 2;
                  const ctrDrop = metric.CTR_Previous_7d !== null && metric.CTR_Previous_7d > 0 && metric.CTR_7d !== null && metric.CTR_7d <= metric.CTR_Previous_7d * 0.9;
                  const highReturns = metric.Returned_Units_30d >= 2 && metric.Return_Rate_30d !== null && metric.Return_Rate_30d >= 10;
                  return <tr key={metric.Product_ID}>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{product.Name}</td>
                    <td className="p-3 tabular-nums">{metric.Impressions_7d.toLocaleString()}</td>
                    <td className="p-3 tabular-nums">{metric.Clicks_7d.toLocaleString()}</td>
                    <td className="p-3 tabular-nums">{metric.CTR_7d === null ? '—' : `${metric.CTR_7d.toFixed(1)}%`}</td>
                    <td className="p-3 tabular-nums">{metric.Returned_Units_30d.toLocaleString()}</td>
                    <td className="p-3 tabular-nums">{metric.Return_Rate_30d === null ? '—' : `${metric.Return_Rate_30d.toFixed(1)}%`}</td>
                    <td className="p-3 text-[10px] text-slate-600 dark:text-zinc-300">{ctrDrop ? 'CTR down 10%+; review listing' : lowCtr ? 'Refresh image or title' : highReturns ? 'Review product details and fit' : metric.Impressions_7d < 25 ? 'Gather more views' : 'On track'}</td>
                  </tr>;
                })}
                {!productAnalytics.length && !analyticsError && <tr><td colSpan={7} className="p-6 text-center text-xs text-slate-500">Listing metrics will appear as shoppers view and buy your products.</td></tr>}
              </tbody>
            </table>
          </section>
          </>}
        </Section>
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget && !isDeletingProduct) setProductToDelete(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-product-title" className="premium-surface w-full max-w-md space-y-4 rounded-xl p-5 shadow-2xl">
            <div>
              <h2 id="delete-product-title" className="text-base font-bold text-slate-900 dark:text-white">Delete {productToDelete.Name}?</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">Orders already placed keep their copy.</p>
            </div>
            {deleteProductError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{deleteProductError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={isDeletingProduct} onClick={() => setProductToDelete(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Keep product</button>
              <button type="button" disabled={isDeletingProduct} onClick={() => void confirmDeleteProduct()} className="rounded-full bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50">{isDeletingProduct ? 'Deleting…' : 'Delete product'}</button>
            </div>
          </section>
        </div>
      )}

      {/* Tab 3: Reviews */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {sellerReviews.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-sky-500/20 p-8 space-y-3">
              <Star className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-zinc-200">No product reviews yet</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Customer reviews and star ratings left on your products will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sellerReviews.map((rev) => {
                const prod = products.find((p) => p.Product_ID === rev.Product_ID);
                return (
                  <div
                    key={rev.Review_ID}
                    className="premium-surface p-5 rounded-xl space-y-3 shadow-xs text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{rev.Customer_Name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{formatDate(rev.Created_At)}</span>
                      </div>
                      <StarRating rating={rev.Rating} size="sm" />
                    </div>

                    {prod && (
                      <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-[11px] font-semibold text-blue-500 dark:text-sky-400">
                        Product: {prod.Name}
                      </div>
                    )}

                    <p className="text-slate-600 dark:text-zinc-300 leading-relaxed italic">
                      "{rev.Review_text}"
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'wallet' && (
        <section className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Cash-on-delivery remittances</h2><p className="text-xs text-slate-500 dark:text-zinc-400">Completed COD deliveries credited to this seller ledger.</p></div>
            <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Total received: ৳{sellerWallet?.balance.toLocaleString() || '0'}</p>
          </header>
          {walletError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{walletError}</p>}
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-[#12161D]">
            {sellerWallet?.entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.description}</p><p className="mt-1 font-mono text-[10px] text-slate-500">Delivery ref: {entry.reference_id} · {formatDate(entry.created_at)}</p></div><span className="font-bold text-emerald-700 dark:text-emerald-300">+৳{Number(entry.amount).toLocaleString()}</span></div>)}
            {!sellerWallet?.entries.length && !walletError && <p className="p-8 text-center text-sm text-slate-500">No COD remittances yet.</p>}
            {!sellerWallet && !walletError && <p className="p-8 text-center text-sm text-slate-500">Loading remittances...</p>}
          </div>
        </section>
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget && !isDeletingProduct) setProductToDelete(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-product-title" className="premium-surface w-full max-w-md space-y-4 rounded-xl p-5 shadow-2xl">
            <div>
              <h2 id="delete-product-title" className="text-base font-bold text-slate-900 dark:text-white">Delete {productToDelete.Name}?</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">Orders already placed keep their copy.</p>
            </div>
            {deleteProductError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{deleteProductError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={isDeletingProduct} onClick={() => setProductToDelete(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Keep product</button>
              <button type="button" disabled={isDeletingProduct} onClick={() => void confirmDeleteProduct()} className="rounded-full bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50">{isDeletingProduct ? 'Deleting…' : 'Delete product'}</button>
            </div>
          </section>
        </div>
      )}

      {/* Product Create/Edit Modal */}
      <SellerProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        productToEdit={productToEdit}
        categories={categories}
        currentSeller={currentSeller}
        onSaveProduct={(data) => onSaveProduct(data)}
      />
      {isProfileModalOpen && (
        <SellerProfileModal
          seller={currentSeller}
          onClose={() => setIsProfileModalOpen(false)}
          onSave={async (updates) => { await onUpdateSellerProfile(updates); }}
        />
      )}
    </div>
  );
};
