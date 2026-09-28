import React, { useState, useEffect } from 'react';
import {
  TrendingProduct,
  TopRatedProduct,
  TopSeller,
  CategoryPerformance,
  TopCustomer,
  fetchTrendingProducts,
  fetchTopRatedProducts,
  fetchTopSellers,
  fetchCategoryPerformance,
  fetchTopCustomers,
  formatCurrency,
} from '../../lib/api';
import { Product } from '../../types';
import {
  TrendingUp,
  Star,
  Award,
  BarChart3,
  Flame,
  ShoppingBag,
  Store,
  Layers,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Package,
} from 'lucide-react';

interface MarketplaceTrendsTopChartsProps {
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
  allProducts?: Product[];
}

export const MarketplaceTrendsTopCharts: React.FC<MarketplaceTrendsTopChartsProps> = ({
  onSelectProduct,
  onAddToCart,
  allProducts = [],
}) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'top-rated' | 'top-sellers' | 'categories' | 'top-customers'>('trends');
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [topRated, setTopRated] = useState<TopRatedProduct[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [categoryPerf, setCategoryPerf] = useState<CategoryPerformance[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [trendData, ratedData, sellerData, catData, customerData] = await Promise.all([
          fetchTrendingProducts(8).catch(() => []),
          fetchTopRatedProducts(8).catch(() => []),
          fetchTopSellers(8).catch(() => []),
          fetchCategoryPerformance().catch(() => []),
          fetchTopCustomers(8).catch(() => []),
        ]);

        if (isMounted) {
          setTrending(trendData || []);
          setTopRated(ratedData || []);
          setTopSellers(sellerData || []);
          setCategoryPerf(catData || []);
          setTopCustomers(customerData || []);
        }
      } catch (err) {
        console.error('Error loading top charts analytics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const resolveFullProduct = (productId: string): Product | null => {
    return allProducts.find((p) => p.Product_ID === productId) || null;
  };

  return (
    <section className="bg-white dark:bg-[#12161D] rounded-3xl p-6 sm:p-8 border border-sky-100 dark:border-zinc-800 shadow-xl space-y-6">
      {/* Header and Filter Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 dark:bg-sky-950/80 text-blue-700 dark:text-sky-400 text-[10px] font-bold tracking-wider uppercase border border-blue-200 dark:border-sky-800/40 mb-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>SCHEMA-POWERED MARKET INTELLIGENCE</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            Marketplace Charts &amp; Trends
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Live database-driven insights: top seller rankings, cart demand velocity, and highest-rated products.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#18202D] rounded-2xl overflow-x-auto scrollbar-none text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trends'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            <span>Top Trends</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('top-rated')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'top-rated'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Top Rated</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('top-sellers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'top-sellers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-purple-300" />
            <span>Top Sellers</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Category Index</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('top-customers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'top-customers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-300" />
            <span>VIP Leaderboard</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Top Trends (Trending Products View) */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Ranked by real-time customer cart demand and buying interest</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {trending.length} Trending Products
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trending.map((item, idx) => {
              const fullProd = resolveFullProduct(item.product_id);
              return (
                <div
                  key={item.product_id || idx}
                  className="group relative p-4 rounded-2xl bg-slate-50/70 dark:bg-[#161E2A] border border-slate-200/80 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500/60 transition-all hover:shadow-lg flex flex-col justify-between"
                >
                  {/* Top Rank Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black font-mono">
                      #{idx + 1} ON RADAR
                    </span>
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShoppingBag className="w-2.5 h-2.5" />
                      {item.total_units_in_carts} in carts
                    </span>
                  </div>

                  {/* Product Image & Info */}
                  <div
                    onClick={() => fullProd && onSelectProduct && onSelectProduct(fullProd)}
                    className="cursor-pointer space-y-2.5"
                  >
                    <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-200 dark:bg-[#0C1014] relative">
                      <img
                        src={item.image || fullProd?.Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'}
                        alt={item.product_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {item.category_name}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
                        {item.product_name}
                      </h4>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrency(Number(item.price))}
                      </span>
                      <span className="block text-[10px] text-slate-400 dark:text-zinc-500">
                        Stock: {item.available_stock}
                      </span>
                    </div>

                    {fullProd && onAddToCart && (
                      <button
                        type="button"
                        onClick={() => onAddToCart(fullProd, 1)}
                        className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs cursor-pointer"
                        title="Add to cart"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Top Rated (Top Rated Products View) */}
      {activeTab === 'top-rated' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Verified buyer favorites with ratings of 4.0 and above</span>
            <span className="font-mono text-amber-500 font-bold">
              {topRated.length} Hall-of-Fame Items
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topRated.map((item, idx) => {
              const fullProd = resolveFullProduct(item.product_id);
              return (
                <div
                  key={item.product_id || idx}
                  className="group relative p-4 rounded-2xl bg-slate-50/70 dark:bg-[#161E2A] border border-slate-200/80 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all hover:shadow-lg flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black font-mono">
                      ★ {item.average_rating} RATING
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold">
                      {item.total_reviews} reviews
                    </span>
                  </div>

                  <div
                    onClick={() => fullProd && onSelectProduct && onSelectProduct(fullProd)}
                    className="cursor-pointer space-y-2.5"
                  >
                    <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-200 dark:bg-[#0C1014] relative">
                      <img
                        src={item.image || fullProd?.Image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'}
                        alt={item.product_name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {item.category_name} • {item.seller_name}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1 group-hover:text-amber-500 transition-colors">
                        {item.product_name}
                      </h4>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrency(Number(item.price))}
                      </span>
                    </div>

                    {fullProd && onAddToCart && (
                      <button
                        type="button"
                        onClick={() => onAddToCart(fullProd, 1)}
                        className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition-all shadow-xs cursor-pointer"
                        title="Add to cart"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Top Sellers Leaderboard */}
      {activeTab === 'top-sellers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Approved marketplace sellers sorted by ratings and lifetime customer reviews</span>
            <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
              {topSellers.length} Premier Vendors
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topSellers.map((seller, idx) => (
              <div
                key={seller.seller_id || idx}
                className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#161E2A] border border-slate-200/80 dark:border-zinc-800 space-y-3 hover:border-purple-400 dark:hover:border-purple-500/60 transition-all hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-xs flex items-center justify-center font-mono">
                    #{idx + 1}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800/40">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Vendor
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {seller.seller_name}
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    ID: {seller.seller_id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-[#111722] border border-slate-200/60 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400 block">Catalog</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {seller.total_active_products} active
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#111722] border border-slate-200/60 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400 block">Rating</span>
                    <span className="font-bold text-amber-500 flex items-center gap-1">
                      ★ {seller.overall_average_rating}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Customer reviews:</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{seller.total_lifetime_reviews}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Category Market Index */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Inventory metrics, average retail prices, and catalog capitalization</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {categoryPerf.length} Market Sectors
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryPerf.map((cat, idx) => (
              <div
                key={cat.category_id || idx}
                className="p-5 rounded-2xl bg-slate-50/70 dark:bg-[#161E2A] border border-slate-200/80 dark:border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">
                    {cat.category_name}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 text-[10px] font-bold font-mono">
                    {cat.total_unique_products} SKUs
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800/60">
                    <span className="text-slate-400">Available Stock:</span>
                    <span className="font-bold">{cat.total_units_in_stock} units</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-zinc-800/60">
                    <span className="text-slate-400">Avg. Product Price:</span>
                    <span className="font-bold text-blue-600 dark:text-sky-400 font-mono">
                      {formatCurrency(Number(cat.average_product_price))}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Sector Valuation:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatCurrency(Number(cat.total_inventory_value))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Top Customers VIP Leaderboard (from gocart_top_customers view) */}
      {activeTab === 'top-customers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Marketplace patron leaderboard sorted by completed order count and total spend</span>
            <span className="font-mono text-amber-500 font-bold">
              {topCustomers.length} Top Verified Patrons
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {topCustomers.map((cust, idx) => (
              <div
                key={cust.customer_id || idx}
                className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#161E2A] border border-slate-200/80 dark:border-zinc-800 space-y-3 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center font-mono">
                    #{idx + 1}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 text-[10px] font-bold flex items-center gap-1 border border-blue-200 dark:border-sky-800/40">
                    <CheckCircle2 className="w-3 h-3 text-sky-400" />
                    Verified VIP
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {cust.customer_name}
                  </h4>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 block truncate">
                    {cust.email || `Customer ID: ${cust.customer_id}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-[#111722] border border-slate-200/60 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400 block">Orders</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {cust.total_orders} completed
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-[#111722] border border-slate-200/60 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400 block">Spend</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                      {formatCurrency(Number(cust.total_lifetime_spent))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
