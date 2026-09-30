import React, { useState, useEffect } from 'react';
import {
  TrendingProduct,
  TopRatedProduct,
  fetchTrendingProducts,
  fetchTopRatedProducts,
  formatCurrency,
} from '../../lib/api';
import { Product } from '../../types';
import {
  TrendingUp,
  Star,
  Flame,
  ShoppingBag,
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
  const [activeTab, setActiveTab] = useState<'trends' | 'top-rated'>('trends');
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [topRated, setTopRated] = useState<TopRatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [trendData, ratedData] = await Promise.all([
          fetchTrendingProducts(3).catch(() => []),
          fetchTopRatedProducts(8).catch(() => []),
        ]);

        if (isMounted) {
          setTrending(trendData || []);
          setTopRated(ratedData || []);
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
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            Marketplace Charts &amp; Trends
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Top products ranked by lifetime units sold across all customer orders.
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

        </div>
      </div>

      {/* Tab 1: Top Trends (Trending Products View) */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>Ranked by lifetime units sold across all accounts</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              {trending.length} Best Sellers
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      #{idx + 1} BEST SELLER
                    </span>
                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShoppingBag className="w-2.5 h-2.5" />
                      {item.total_units_sold} sold
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
                        {item.available_stock <= 0 ? 'Stock Out' : `Stock: ${item.available_stock}`}
                      </span>
                    </div>

                    {fullProd && onAddToCart && (
                      <button
                        type="button"
                        disabled={item.available_stock <= 0 || Number(fullProd.Stock) <= 0 || fullProd.Product_Status !== 'active'}
                        onClick={() => onAddToCart(fullProd, 1)}
                        className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                        title={item.available_stock <= 0 || Number(fullProd.Stock) <= 0 ? 'Out of stock' : 'Add to cart'}
                      >
                        {item.available_stock <= 0 || Number(fullProd.Stock) <= 0 ? 'Out' : <ShoppingBag className="w-3.5 h-3.5" />}
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
                        disabled={Number(fullProd.Stock) <= 0 || fullProd.Product_Status !== 'active'}
                        onClick={() => onAddToCart(fullProd, 1)}
                        className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition-all shadow-xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                        title={Number(fullProd.Stock) <= 0 ? 'Out of stock' : 'Add to cart'}
                      >
                        {Number(fullProd.Stock) <= 0 ? 'Out' : <ShoppingBag className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </section>
  );
};
