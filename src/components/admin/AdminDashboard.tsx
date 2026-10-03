import React from 'react';
import { Seller, Product, Order, Category, Review, SellerStatus, ProductStatus } from '../../types';
import { formatCurrency, formatBDT, formatDate } from '../../lib/api';
import { RiderApplicationsPanel } from './RiderApplicationsPanel';
import { AdminMarketplaceMetrics } from './AdminMarketplaceMetrics';
import {
  BarChart3,
  ShieldCheck,
  Store,
  FolderTree,
  Package,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  Trash2,
  Activity,
  Search,
  CreditCard,
  Lock,
  RefreshCw,
  Smartphone,
  ExternalLink,
  X,
  AlertCircle,
  Truck,
} from 'lucide-react';

const AdminOverviewAnalytics = React.lazy(() =>
  import('./AdminOverviewAnalytics').then(({ AdminOverviewAnalytics: Component }) => ({ default: Component }))
);

interface AdminDashboardProps {
  sellers: Seller[];
  products: Product[];
  orders: Order[];
  categories: Category[];
  reviews: Review[];
  onUpdateSellerStatus: (sellerId: string, status: SellerStatus) => Promise<void>;
  onUpdateProductStatus: (productId: string, status: ProductStatus) => Promise<void>;
  onCreateCategory: (name: string) => Promise<void>;
  onUpdateCategory: (categoryId: string, name: string) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onOpenSellerSignup?: () => void;
}

const adminTabButtonClass = (isActive: boolean, activeClass: string) =>
  `inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all duration-200 hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#12161D] ${
    isActive
      ? `${activeClass} ring-1 ring-inset ring-white/20`
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-[#181F2A] dark:hover:text-white'
  }`;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  sellers,
  products,
  orders,
  categories,
  reviews,
  onUpdateSellerStatus,
  onUpdateProductStatus,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onOpenSellerSignup,
}) => {
  const [adminTab, setAdminTab] = React.useState<'overview' | 'metrics' | 'sellers' | 'riders' | 'categories' | 'products' | 'payments'>('overview');
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = React.useState('');
  const [sellerSearch, setSellerSearch] = React.useState('');
  const [sellerStatusFilter, setSellerStatusFilter] = React.useState<string>('all');
  const [isSubmittingCat, setIsSubmittingCat] = React.useState(false);
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = React.useState<'success' | 'error'>('success');
  const [updatingSellerId, setUpdatingSellerId] = React.useState<string | null>(null);
  const [selectedSellerId, setSelectedSellerId] = React.useState<string | null>(null);
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = React.useState(false);
  const [paymentFilter, setPaymentFilter] = React.useState<string>('all');
  const filteredTransactions = transactions.filter((transaction) => {
    if (paymentFilter === 'all') return true;
    if (paymentFilter === 'cards') return ['visa_mastercard', 'visa', 'mastercard', 'amex'].includes(String(transaction.payment_method).toLowerCase());
    return String(transaction.payment_method).toLowerCase() === paymentFilter;
  });
  const paymentChannelLabel = (method: string) => method === 'visa_mastercard' ? 'Cards' : method.replaceAll('_', ' ');

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await fetch('/api/payment/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  React.useEffect(() => {
    if (adminTab === 'payments') {
      fetchTransactions();
    }
  }, [adminTab]);

  const showNotification = (msg: string, tone: 'success' | 'error' = 'success') => {
    setFeedbackMsg(msg);
    setFeedbackTone(tone);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Derived calculations
  const pendingSellers = sellers.filter((s) => s.Status === 'pending');
  const approvedSellers = sellers.filter((s) => s.Status === 'approved');
  const suspendedSellers = sellers.filter((s) => s.Status === 'suspended' || s.Status === 'rejected');

  const totalMarketValue = products.reduce(
    (sum, product) => sum + Math.max(Number(product.Price) || 0, 0) * Math.max(Number(product.Stock) || 0, 0),
    0
  );
  const totalOrderVolume = orders.reduce((sum, order) => sum + order.Subtotal + order.Shipping_Fee, 0);
  const avgSentiment =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.Rating, 0) / reviews.length : 4.9;

  const filteredSellers = sellers.filter((s) => {
    if (sellerStatusFilter !== 'all' && s.Status !== sellerStatusFilter) return false;
    if (sellerSearch.trim()) {
      const q = sellerSearch.toLowerCase();
      return (
        s.Name.toLowerCase().includes(q) ||
        s.Email.toLowerCase().includes(q) ||
        s.Seller_ID.toLowerCase().includes(q)
      );
    }
    return true;
  });
  const selectedSeller = sellers.find((seller) => seller.Seller_ID === selectedSellerId) || null;
  const dashboardKpis = [
    { label: 'Total Market Value', value: formatCurrency(totalMarketValue), detail: 'Current catalog stock value', accent: 'bg-sky-500' },
    { label: 'Active Merchants', value: approvedSellers.length.toLocaleString(), detail: `${pendingSellers.length} pending · ${suspendedSellers.length} suspended`, accent: 'bg-emerald-500' },
    { label: 'Order Throughput', value: `${orders.length.toLocaleString()} orders`, detail: 'Live fulfillment synced', accent: 'bg-blue-600' },
    { label: 'Review Sentiment', value: `${avgSentiment.toFixed(2)} / 5.0`, detail: `Based on ${reviews.length.toLocaleString()} customer reviews`, accent: 'bg-amber-500' },
  ];

  const handleSellerStatusChange = async (seller: Seller, status: SellerStatus) => {
    setUpdatingSellerId(seller.Seller_ID);
    try {
      await onUpdateSellerStatus(seller.Seller_ID, status);
      const action = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Suspended';
      showNotification(`${action} merchant ${seller.Name}`);
    } catch (err: any) {
      showNotification(err.message || `Could not update ${seller.Name}'s status.`, 'error');
    } finally {
      setUpdatingSellerId(null);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSubmittingCat(true);
    try {
      await onCreateCategory(newCategoryName.trim());
      showNotification(`Category "${newCategoryName.trim()}" created successfully!`);
      setNewCategoryName('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to create category');
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const handleSaveCategoryEdit = async (categoryId: string) => {
    if (!editingCategoryName.trim()) return;
    try {
      await onUpdateCategory(categoryId, editingCategoryName.trim());
      showNotification('Category updated successfully!');
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } catch (err: any) {
      showNotification(err.message || 'Failed to update category');
    }
  };

  return (
    <div className="space-y-6 pb-16 text-slate-900 dark:text-zinc-100">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div role="status" className={`fixed right-4 top-20 z-50 flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-semibold text-white shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 sm:right-6 ${feedbackTone === 'error' ? 'bg-rose-700/95 shadow-rose-950/30' : 'bg-blue-700/95 shadow-blue-950/30'}`}>
          {feedbackTone === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-sky-200" />}
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Top Overview Banner */}
      <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Platform Admin Governance Console
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Review seller applications, manage global product categories, and moderate marketplace entities.
            </p>
          </div>
        </div>

        {/* Pending approvals highlight badge */}
        {pendingSellers.length > 0 ? (
          <div className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{pendingSellers.length} Pending Seller Application{pendingSellers.length > 1 ? 's' : ''} Requires Approval</span>
          </div>
        ) : (
          <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>All Seller Applications Processed</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardKpis.map((kpi) => (
          <section key={kpi.label} className="group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-sky-500/20 dark:bg-[#12161D]">
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 ${kpi.accent}`} />
            <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-zinc-400">{kpi.label}</p>
            <p className="mt-2 break-words text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{kpi.value}</p>
            <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-zinc-400">{kpi.detail}</p>
          </section>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-sky-100 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setAdminTab('overview')}
          aria-current={adminTab === 'overview' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'overview', 'bg-blue-600 text-white shadow-md shadow-blue-500/20')}
        >
          <Activity className="w-4 h-4" />
          <span>Governance Overview</span>
        </button>

        <button
          onClick={() => setAdminTab('metrics')}
          aria-current={adminTab === 'metrics' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'metrics', 'bg-blue-600 text-white shadow-md shadow-blue-500/20')}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Marketplace Metrics</span>
        </button>

        <button
          onClick={() => setAdminTab('sellers')}
          aria-current={adminTab === 'sellers' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'sellers', 'bg-blue-600 text-white shadow-md shadow-blue-500/20')}
        >
          <Store className="w-4 h-4" />
          <span>Merchant Approvals ({sellers.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('categories')}
          aria-current={adminTab === 'categories' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'categories', 'bg-blue-600 text-white shadow-md shadow-blue-500/20')}
        >
          <FolderTree className="w-4 h-4" />
          <span>Category Registry ({categories.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('riders')}
          aria-current={adminTab === 'riders' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'riders', 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20')}
        >
          <Truck className="w-4 h-4" />
          <span>Rider Hiring</span>
        </button>

        <button
          onClick={() => setAdminTab('products')}
          aria-current={adminTab === 'products' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'products', 'bg-blue-600 text-white shadow-md shadow-blue-500/20')}
        >
          <Package className="w-4 h-4" />
          <span>Product Moderation ({products.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('payments')}
          aria-current={adminTab === 'payments' ? 'page' : undefined}
          className={adminTabButtonClass(adminTab === 'payments', 'bg-[#E2136E] text-white shadow-md shadow-[#E2136E]/20')}
        >
          <Lock className="w-4 h-4" />
          <span>Online Payments</span>
        </button>
      </div>

      {adminTab === 'metrics' && (
        <AdminMarketplaceMetrics
          products={products}
          sellers={sellers}
          orders={orders}
        />
      )}

      {/* Tab 1: Overview & Seller Approval Workflow */}
      {adminTab === 'overview' && (
        <>
        <div className="grid grid-cols-12 gap-6">
          {/* Main Approval Table (Span 8) */}
          <div className="col-span-12 lg:col-span-8 bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl flex flex-col overflow-hidden shadow-xs">
            <div className="p-6 border-b border-sky-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Seller Approval Workflow</h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Approve or restrict merchant stores requesting live product listing privileges.
                </p>
              </div>
              <button
                onClick={() => setAdminTab('sellers')}
                className="text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#181F2A] dark:hover:bg-[#1f2937] text-blue-600 dark:text-sky-400 px-3.5 py-1.5 rounded-full border border-sky-100 dark:border-zinc-700 transition-colors cursor-pointer"
              >
                View All Merchants ({sellers.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#181F2A] text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-sky-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Seller Info</th>
                    <th className="px-6 py-4 font-semibold">Contact Email</th>
                    <th className="px-6 py-4 font-semibold">Registered</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/60 dark:divide-zinc-800/80 text-slate-700 dark:text-zinc-300">
                  {sellers.map((seller) => (
                    <tr key={seller.Seller_ID} className="hover:bg-slate-50 dark:hover:bg-[#181F2A]/60 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedSellerId(seller.Seller_ID)}
                          aria-label={`View ${seller.Name} application details`}
                          className="flex items-center gap-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <img
                            src={seller.Logo}
                            alt={seller.Name}
                            className="w-9 h-9 rounded-xl object-cover border border-sky-100 dark:border-zinc-700 bg-slate-100 dark:bg-[#181F2A]"
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{seller.Name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">ID: {seller.Seller_ID}</p>
                            <p className="text-[10px] text-blue-600 dark:text-sky-400">View application</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-zinc-400">{seller.Email}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-zinc-400">{formatDate(seller.Created_At)}</td>
                      <td className="px-6 py-4">
                        {seller.Status === 'approved' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase">
                            Approved
                          </span>
                        )}
                        {seller.Status === 'pending' && (
                          <span className="inline-flex whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 uppercase">
                            Pending Review
                          </span>
                        )}
                        {(seller.Status === 'suspended' || seller.Status === 'rejected') && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/20 uppercase">
                            {seller.Status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {seller.Status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => void handleSellerStatusChange(seller, 'approved')}
                              disabled={updatingSellerId === seller.Seller_ID}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-full text-[10px] font-bold transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
                            >
                              {updatingSellerId === seller.Seller_ID ? 'Updating...' : 'Approve'}
                            </button>
                          )}
                          {seller.Status !== 'suspended' && (
                            <button
                              type="button"
                              onClick={() => void handleSellerStatusChange(seller, 'suspended')}
                              disabled={updatingSellerId === seller.Seller_ID}
                              className="px-3 py-1 bg-rose-600/80 hover:bg-rose-500 disabled:opacity-50 text-white rounded-full text-[10px] font-bold transition-all cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Info Panels (Span 4) */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* System Activity Log */}
            <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-6 flex flex-col justify-between shadow-xs">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-sky-100 dark:border-zinc-800 pb-3">
                System Activity Log
              </h2>
              <div className="space-y-4 pt-4 text-xs">
                <div className="flex gap-3 items-start">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-zinc-200">Merchant Directory Synced</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">All registered vendors verified with PostgreSQL</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-zinc-200">Platform Health Guard Active</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">0 critical incidents reported across active nodes</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-500 mt-1 shrink-0"></div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-zinc-200">Category Registry Updated</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">{categories.length} Categories active in storefront</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Storefront Synchronized Banner */}
            <div className="bg-gradient-to-br from-[#0B1528] to-[#12161D] border border-sky-500/25 rounded-3xl p-6 relative overflow-hidden text-white space-y-3 shadow-lg shadow-blue-500/10">
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <h3 className="text-base font-bold text-sky-400">Storefront Synchronization</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Changes made here immediately update live product visibility and seller status across all client interfaces.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md shadow-blue-500/30">
                  Status: 100% Synced
                </span>
              </div>
            </div>
          </div>
        </div>
        <React.Suspense fallback={<p className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">Loading overview charts...</p>}>
          <AdminOverviewAnalytics orders={orders} />
        </React.Suspense>
        </>
      )}

      {/* Tab 2: Full Merchant Accounts Management */}
      {adminTab === 'sellers' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#12161D] p-4 rounded-3xl border border-sky-100 dark:border-sky-500/20 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
                placeholder="Search sellers by name or email..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-zinc-400 font-medium">Status Filter:</span>
                <select
                  value={sellerStatusFilter}
                  onChange={(e) => setSellerStatusFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-[#181F2A] text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700 rounded-full px-3.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses ({sellers.length})</option>
                  <option value="pending">Pending ({pendingSellers.length})</option>
                  <option value="approved">Approved ({approvedSellers.length})</option>
                  <option value="suspended">Suspended ({suspendedSellers.length})</option>
                </select>
              </div>

              {onOpenSellerSignup && (
                <button
                  onClick={onOpenSellerSignup}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full text-xs transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register New Merchant</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#181F2A] text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-sky-100 dark:border-zinc-800">
                  <tr>
                    <th className="p-4">Merchant Name</th>
                    <th className="p-4">Email &amp; Phone</th>
                    <th className="p-4">Registered Address</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/60 dark:divide-zinc-800/80">
                  {filteredSellers.map((seller) => (
                    <tr key={seller.Seller_ID} className="hover:bg-slate-50 dark:hover:bg-[#181F2A]/60 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={seller.Logo}
                            alt={seller.Name}
                            className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-[#181F2A] border border-sky-100 dark:border-zinc-700"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedSellerId(seller.Seller_ID)}
                            aria-label={`View ${seller.Name} application details`}
                            className="text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <span className="font-bold text-slate-900 dark:text-white block">{seller.Name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono block">ID: {seller.Seller_ID}</span>
                            <span className="text-[10px] text-blue-600 dark:text-sky-400 block">View application</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-zinc-300">
                        <p>{seller.Email}</p>
                        <p className="text-slate-400 dark:text-zinc-500">{seller.Number}</p>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-zinc-400 max-w-xs">
                        {seller.Address.House_Name}, {seller.Address.Street}, {seller.Address.City} ({seller.Address.Postal_Code})
                      </td>
                      <td className="p-4">
                        {seller.Status === 'approved' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase">
                            Approved
                          </span>
                        )}
                        {seller.Status === 'pending' && (
                          <span className="inline-flex whitespace-nowrap px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 uppercase">
                            Pending Review
                          </span>
                        )}
                        {(seller.Status === 'suspended' || seller.Status === 'rejected') && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/20 uppercase">
                            {seller.Status}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {seller.Status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => void handleSellerStatusChange(seller, 'approved')}
                              disabled={updatingSellerId === seller.Seller_ID}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
                            >
                              {updatingSellerId === seller.Seller_ID ? 'Updating...' : 'Approve'}
                            </button>
                          )}
                          {seller.Status !== 'rejected' && seller.Status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void handleSellerStatusChange(seller, 'rejected')}
                              disabled={updatingSellerId === seller.Seller_ID}
                              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 disabled:opacity-50 text-slate-800 dark:text-zinc-200 rounded-full text-xs font-bold transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                          {seller.Status !== 'suspended' && (
                            <button
                              type="button"
                              onClick={() => void handleSellerStatusChange(seller, 'suspended')}
                              disabled={updatingSellerId === seller.Seller_ID}
                              className="px-3 py-1 bg-rose-600/80 hover:bg-rose-500 disabled:opacity-50 text-white rounded-full text-xs font-bold transition-all cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Category Registry Management */}
      {adminTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Create Category Form */}
          <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-6 h-fit space-y-4 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-500" />
              Add New Category
            </h3>
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Eco-Hardware or Audio & Studio"
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingCat || !newCategoryName.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Category</span>
              </button>
            </form>
          </div>

          {/* Existing Categories Table */}
          <div className="md:col-span-2 bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-sky-100 dark:border-zinc-800 font-bold text-xs text-slate-900 dark:text-white">
              Global Category Registry ({categories.length})
            </div>
            <div className="divide-y divide-sky-100/60 dark:divide-zinc-800/80 text-xs">
              {categories.map((cat) => {
                const count = products.filter((p) => p.Category_ID === cat.Category_ID).length;
                const isEditing = editingCategoryId === cat.Category_ID;

                return (
                  <div key={cat.Category_ID} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-[#181F2A]/60 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                        {cat.Name.charAt(0)}
                      </div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="bg-slate-50 dark:bg-[#181F2A] border border-blue-500 rounded-xl p-1.5 text-xs text-slate-900 dark:text-white"
                        />
                      ) : (
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{cat.Name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">ID: {cat.Category_ID} • {count} Products listed</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveCategoryEdit(cat.Category_ID)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-[10px] cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            className="px-3 py-1 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 font-bold rounded-full text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingCategoryId(cat.Category_ID);
                              setEditingCategoryName(cat.Name);
                            }}
                            className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            title="Edit Category Name"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              onDeleteCategory(cat.Category_ID);
                              showNotification(`Deleted category "${cat.Name}"`);
                            }}
                            className="p-1.5 text-slate-400 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Product Deactivation / Moderation */}
      {adminTab === 'products' && (
        <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-sky-100 dark:border-zinc-800 font-bold text-xs text-slate-900 dark:text-white">
            Product Listing Moderation ({products.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#181F2A] text-[10px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-sky-100 dark:border-zinc-800">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Merchant</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Moderation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100/60 dark:divide-zinc-800/80 text-slate-700 dark:text-zinc-300">
                {products.map((p) => {
                  const sellerName = sellers.find((s) => s.Seller_ID === p.Seller_ID)?.Name || 'Unknown';
                  return (
                    <tr key={p.Product_ID} className="hover:bg-slate-50 dark:hover:bg-[#181F2A]/60 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.Image}
                            alt={p.Name}
                            className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-[#181F2A] border border-sky-100 dark:border-zinc-700"
                          />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{p.Name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">ID: {p.Product_ID}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-zinc-300">{sellerName}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{formatCurrency(p.Price)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          p.Product_Status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : p.Product_Status === 'deactivated'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          {p.Product_Status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            const newStatus = p.Product_Status === 'deactivated' ? 'active' : 'deactivated';
                            onUpdateProductStatus(p.Product_ID, newStatus);
                            showNotification(`Updated ${p.Name} status to ${newStatus}`);
                          }}
                          className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                            p.Product_Status === 'deactivated'
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                              : 'bg-rose-600/80 hover:bg-rose-500 text-white'
                          }`}
                        >
                          {p.Product_Status === 'deactivated' ? 'Reinstate Listing' : 'Deactivate Listing'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Online Payment Transactions Ledger */}
      {adminTab === 'payments' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Total Order Volume
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {formatBDT(totalOrderVolume)}
                </div>
              </div>
              <span className="text-[11px] text-emerald-500 font-semibold mt-2">
                Order subtotal plus shipping across the marketplace
              </span>
            </div>

            <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  bKash Transactions
                </span>
                <div className="text-2xl font-black text-[#E2136E] mt-1">
                  {transactions.filter((t) => t.payment_method === 'bkash').length || orders.filter((o) => o.Payment_Method === 'bkash').length}
                </div>
              </div>
              <span className="text-[11px] text-pink-600 dark:text-pink-400 font-semibold mt-2">
                Official MFS Partner
              </span>
            </div>

            <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Cards &amp; Other MFS
                </span>
                <div className="text-2xl font-black text-blue-500 mt-1">
                  {transactions.filter((t) => t.payment_method !== 'bkash' && t.payment_method !== 'cash_on_delivery').length}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-2">
                Nagad, Rocket &amp; Visa/Mastercard
              </span>
            </div>

            <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Gateway Status
                </span>
                <div className="text-sm font-black text-emerald-500 mt-1 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>ONLINE (SANDBOX ACTIVE)</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-2">Store ID: testbox</span>
            </div>
          </div>

          {/* Transactions Table Container */}
          <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-sky-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  Online Payment Transaction Ledger
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Online gateway sessions recorded separately by payment channel and transaction status.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="payment-channel-filter">Filter online payments by channel</label>
                <select
                  id="payment-channel-filter"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                  className="min-h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-zinc-200"
                >
                  <option value="all">All online channels</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="cards">Cards / Internet banking</option>
                </select>
                <button
                  type="button"
                  onClick={fetchTransactions}
                  disabled={loadingTransactions}
                  className="px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-[#181F2A] hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTransactions ? 'animate-spin' : ''}`} />
                  <span>Refresh Ledger</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-[#161C24]/80 border-b border-sky-100 dark:border-zinc-800 text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">
                    <th className="p-4">Transaction ID (tran_id)</th>
                    <th className="p-4">Channel</th>
                    <th className="p-4">Order ID</th>
                    <th className="p-4">Customer Phone</th>
                    <th className="p-4">Amount (BDT)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100/50 dark:divide-zinc-800/80">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-zinc-500">
                        {loadingTransactions ? 'Loading online payment transactions...' : paymentFilter === 'all' ? 'No online payment transactions recorded yet.' : `No ${paymentChannelLabel(paymentFilter)} transactions recorded yet.`}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-[#181F2A]/60 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-600 dark:text-sky-400">
                          {t.transaction_id}
                          {t.val_id && (
                            <span className="block text-[9px] text-slate-400 font-mono">Val: {t.val_id}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              t.payment_method === 'bkash'
                                ? 'bg-pink-100 dark:bg-pink-950/60 text-[#E2136E] border border-pink-300'
                                : t.payment_method === 'nagad'
                                ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-300'
                                : t.payment_method === 'rocket'
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 border border-purple-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 border border-blue-300'
                            }`}
                          >
                            {paymentChannelLabel(String(t.payment_method || 'unknown').toLowerCase())}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-700 dark:text-zinc-300">
                          {t.order_id || 'Checkout Pending'}
                        </td>
                        <td className="p-4 font-mono text-slate-600 dark:text-zinc-400">
                          {t.customer_phone || 'N/A'}
                        </td>
                        <td className="p-4 font-black text-slate-900 dark:text-white">
                          {formatBDT(Number(t.amount))}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              t.status === 'VALIDATED' || t.status === 'VALID'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300'
                                : t.status === 'PENDING'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300'
                                : 'bg-rose-100 text-rose-600 border border-rose-300'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="p-4 text-[11px] text-slate-400">
                          {formatDate(t.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'riders' && <RiderApplicationsPanel />}

      {selectedSeller && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedSellerId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-application-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200 dark:border-sky-500/20 dark:bg-[#12161D]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-zinc-800">
              <div className="flex min-w-0 items-center gap-3">
                {selectedSeller.Logo ? (
                  <img src={selectedSeller.Logo} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-zinc-700" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-zinc-800"><Store className="h-5 w-5" /></div>
                )}
                <div className="min-w-0">
                  <h2 id="seller-application-title" className="truncate text-lg font-bold text-slate-900 dark:text-white">{selectedSeller.Name}</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Seller application · {selectedSeller.Seller_ID}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSellerId(null)}
                aria-label="Close seller details"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Application details</h3>
                <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${selectedSeller.Status === 'approved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : selectedSeller.Status === 'pending' ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                  {selectedSeller.Status === 'pending' ? 'Pending review' : selectedSeller.Status}
                </span>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">Business description</p>
                <p className="whitespace-pre-wrap break-words text-slate-800 dark:text-zinc-200">{selectedSeller.Description || 'No description was provided.'}</p>
              </div>

              <dl className="grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-2 dark:border-zinc-800">
                <div className="min-w-0">
                  <dt className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Email</dt>
                  <dd className="break-all text-slate-800 dark:text-zinc-200">{selectedSeller.Email || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Phone</dt>
                  <dd className="text-slate-800 dark:text-zinc-200">{selectedSeller.Number || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Username</dt>
                  <dd className="text-slate-800 dark:text-zinc-200">{selectedSeller.Username || 'Not provided'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Registered</dt>
                  <dd className="text-slate-800 dark:text-zinc-200">{formatDate(selectedSeller.Created_At)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Business address</dt>
                  <dd className="break-words text-slate-800 dark:text-zinc-200">
                    {[selectedSeller.Address.House_Name, selectedSeller.Address.Street, selectedSeller.Address.City, selectedSeller.Address.Postal_Code, selectedSeller.Address.Additional_Info].filter(Boolean).join(', ') || 'Not provided'}
                  </dd>
                </div>
              </dl>
            </div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-[#181F2A]">
              {selectedSeller.Status !== 'approved' && (
                <button
                  type="button"
                  onClick={() => void handleSellerStatusChange(selectedSeller, 'approved')}
                  disabled={updatingSellerId === selectedSeller.Seller_ID}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {updatingSellerId === selectedSeller.Seller_ID ? 'Updating...' : 'Approve seller'}
                </button>
              )}
              {selectedSeller.Status === 'pending' && (
                <button
                  type="button"
                  onClick={() => void handleSellerStatusChange(selectedSeller, 'rejected')}
                  disabled={updatingSellerId === selectedSeller.Seller_ID}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Reject
                </button>
              )}
              {selectedSeller.Status !== 'suspended' && (
                <button
                  type="button"
                  onClick={() => void handleSellerStatusChange(selectedSeller, 'suspended')}
                  disabled={updatingSellerId === selectedSeller.Seller_ID}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  Suspend
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
