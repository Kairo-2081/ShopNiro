import React, { useState, useEffect } from 'react';
import {
  TrendingProduct,
  TopRatedProduct,
  fetchTrendingProducts,
  fetchTopRatedProducts,
  formatCurrency,
} from '../../lib/api';
import { Product } from '../../types';
import { Star, Flame, Sparkles, ShoppingBag } from 'lucide-react';
import { useLocale } from '../../lib/i18n';

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
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<'trends' | 'top-rated' | 'new-arrivals'>('trends');
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [topRated, setTopRated] = useState<TopRatedProduct[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [trendData, ratedData] = await Promise.all([
          fetchTrendingProducts(3).catch(() => []),
          fetchTopRatedProducts(3).catch(() => []),
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

  const newArrivals = allProducts
    .filter((product) => product.Product_Status === 'active')
    .sort((a, b) => {
      const dateDifference = Date.parse(b.Created_At || '') - Date.parse(a.Created_At || '');
      return Number.isNaN(dateDifference) || dateDifference === 0
        ? b.Product_ID.localeCompare(a.Product_ID)
        : dateDifference;
    })
    .slice(0, 3);

  return (
    <section className="bg-white dark:bg-[#12161D] rounded-3xl p-6 sm:p-8 border border-brand-100 dark:border-surface-800 shadow-xl space-y-6">
      {/* Header and Filter Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-100 dark:border-surface-800/80 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-white flex items-center gap-2">
            {t('chartTitle')}
          </h2>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {t('chartDescription')}
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-100 dark:bg-[#18202D] rounded-2xl overflow-x-auto scrollbar-none text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('trends')}
            aria-pressed={activeTab === 'trends'}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'trends'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-surface-900 hover:bg-surface-50 hover:text-surface-950 dark:bg-[#12161D] dark:text-surface-100 dark:hover:bg-[#18202D] dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-warning-300" />
            <span>{t('topTrends')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('top-rated')}
            aria-pressed={activeTab === 'top-rated'}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'top-rated'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-surface-900 hover:bg-surface-50 hover:text-surface-950 dark:bg-[#12161D] dark:text-surface-100 dark:hover:bg-[#18202D] dark:hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-warning-300 fill-warning-300" />
            <span>{t('topRated')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('new-arrivals')}
            aria-pressed={activeTab === 'new-arrivals'}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'new-arrivals'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-surface-900 hover:bg-surface-50 hover:text-surface-950 dark:bg-[#12161D] dark:text-surface-100 dark:hover:bg-[#18202D] dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-300" />
            <span>{t('newArrivals')}</span>
          </button>

        </div>
      </div>

      {/* Tab 1: Top Trends (Trending Products View) */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
            <span>{t('rankedBySales')}</span>
            <span className="font-mono text-success-600 dark:text-success-400 font-bold">
              {trending.length} {t('bestSellers')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((item, idx) => {
              const fullProd = resolveFullProduct(item.product_id);
              return (
                <div
                  key={item.product_id || idx}
                  className="group relative p-4 rounded-2xl bg-surface-50/70 dark:bg-[#161E2A] border border-surface-200/80 dark:border-surface-800 hover:border-brand-400 dark:hover:border-brand-500/60 transition-all hover:shadow-lg flex flex-col justify-between"
                >
                  {/* Top Rank Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-warning-500/10 text-warning-600 dark:text-warning-400 text-micro font-black font-mono">
                      #{idx + 1} {t('bestSellers').toUpperCase()}
                    </span>
                    <span className="text-micro font-bold text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-950/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShoppingBag className="w-2.5 h-2.5" />
                      {item.total_units_sold} {t('sold')}
                    </span>
                  </div>

                  {/* Product Image & Info */}
                  <button
                    type="button"
                    disabled={!fullProd || !onSelectProduct}
                    onClick={() => fullProd && onSelectProduct?.(fullProd)}
                    aria-label={`${t('viewProduct')}: ${item.product_name}`}
                    className="block w-full overflow-hidden rounded-xl text-left disabled:cursor-default"
                  >
                    <img
                      src={item.image || fullProd?.Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-36 w-full rounded-xl bg-surface-200 object-cover transition-transform duration-300 group-hover:scale-105 dark:bg-[#0C1014]"
                    />
                    <span className="mt-2 block text-micro font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                      {item.category_name}
                    </span>
                    <span className="block truncate text-xs font-bold text-surface-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                      {item.product_name}
                    </span>
                  </button>

                  {/* Price & Action */}
                  <div className="mt-3 pt-2.5 border-t border-surface-200/60 dark:border-surface-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-surface-900 dark:text-white">
                        {formatCurrency(Number(item.price))}
                      </span>
                      <span className="block text-micro text-surface-500 dark:text-surface-400">
                        {item.available_stock <= 0 ? 'Stock Out' : `Stock: ${item.available_stock}`}
                      </span>
                    </div>

                    {fullProd && onAddToCart && (
                      <button
                        type="button"
                        disabled={item.available_stock <= 0 || Number(fullProd.Stock) <= 0 || fullProd.Product_Status !== 'active'}
                        onClick={() => onAddToCart(fullProd, 1)}
                        aria-label={item.available_stock <= 0 || Number(fullProd.Stock) <= 0 ? `${item.product_name}: Out of stock` : `${t('addToCart')}: ${item.product_name}`}
                        className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-xs cursor-pointer disabled:bg-surface-200 disabled:text-brand-900 disabled:cursor-not-allowed dark:disabled:bg-surface-800 dark:disabled:text-brand-200"
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
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
            <span>Products with 3+ reviews and an average rating of 4.0 or higher</span>
            <span className="font-mono text-warning-500 font-bold">
              {topRated.length} of 3 Products
            </span>
          </div>

          {topRated.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topRated.map((item, idx) => {
              const fullProd = resolveFullProduct(item.product_id);
              return (
                <div
                  key={item.product_id || idx}
                  className="group relative p-4 rounded-2xl bg-surface-50/70 dark:bg-[#161E2A] border border-surface-200/80 dark:border-surface-800 hover:border-warning-400 dark:hover:border-warning-500/60 transition-all hover:shadow-lg flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-warning-500/10 text-warning-600 dark:text-warning-400 text-micro font-black font-mono">
                      ★ {item.average_rating} RATING
                    </span>
                    <span className="text-micro text-surface-500 dark:text-surface-400 font-semibold">
                      {item.total_reviews} reviews
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!fullProd || !onSelectProduct}
                    onClick={() => fullProd && onSelectProduct?.(fullProd)}
                    aria-label={`${t('viewProduct')}: ${item.product_name}`}
                    className="block w-full overflow-hidden rounded-xl text-left disabled:cursor-default"
                  >
                    <img
                      src={item.image || fullProd?.Image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-36 w-full rounded-xl bg-surface-200 object-cover transition-transform duration-300 group-hover:scale-105 dark:bg-[#0C1014]"
                    />
                    <span className="mt-2 block truncate text-micro font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                      {item.category_name} • {item.seller_name}
                    </span>
                    <span className="block truncate text-xs font-bold text-surface-900 transition-colors group-hover:text-warning-500 dark:text-white">
                      {item.product_name}
                    </span>
                  </button>

                  <div className="mt-3 pt-2.5 border-t border-surface-200/60 dark:border-surface-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-surface-900 dark:text-white">
                        {formatCurrency(Number(item.price))}
                      </span>
                    </div>

                    {fullProd && onAddToCart && (
                      <button
                        type="button"
                        disabled={Number(fullProd.Stock) <= 0 || fullProd.Product_Status !== 'active'}
                        onClick={() => onAddToCart(fullProd, 1)}
                        aria-label={Number(fullProd.Stock) <= 0 ? `${item.product_name}: Out of stock` : `${t('addToCart')}: ${item.product_name}`}
                        className="p-2 rounded-xl bg-warning-500 hover:bg-warning-400 text-white transition-all shadow-xs cursor-pointer disabled:bg-surface-200 disabled:text-brand-900 disabled:cursor-not-allowed dark:disabled:bg-surface-800 dark:disabled:text-brand-200"
                        title={Number(fullProd.Stock) <= 0 ? 'Out of stock' : 'Add to cart'}
                      >
                        {Number(fullProd.Stock) <= 0 ? 'Out' : <ShoppingBag className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div> : <p className="py-8 text-center text-sm text-surface-500 dark:text-surface-400">No products meet the 4.0 rating and 3-review minimum yet.</p>}
        </div>
      )}

      {activeTab === 'new-arrivals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
            <span>Recently added active products</span>
            <span className="font-mono text-brand-600 dark:text-brand-400 font-bold">
              {newArrivals.length} Latest Listings
            </span>
          </div>

          {newArrivals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {newArrivals.map((product, idx) => (
                <div
                  key={product.Product_ID}
                  className="group relative p-4 rounded-2xl bg-surface-50/70 dark:bg-[#161E2A] border border-surface-200/80 dark:border-surface-800 hover:border-brand-400 dark:hover:border-brand-500/60 transition-all hover:shadow-lg flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-micro font-black font-mono">
                      #{idx + 1} NEW ARRIVAL
                    </span>
                    <span className="text-micro text-surface-500 dark:text-surface-400 font-semibold">
                      {product.Created_At && !Number.isNaN(Date.parse(product.Created_At))
                        ? new Date(product.Created_At).toLocaleDateString()
                        : 'Recently added'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectProduct?.(product)}
                    aria-label={`${t('viewProduct')}: ${product.Name}`}
                    className="block w-full overflow-hidden rounded-xl text-left"
                  >
                    <img
                      src={product.Image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-36 w-full rounded-xl bg-surface-200 object-cover transition-transform duration-300 group-hover:scale-105 dark:bg-[#0C1014]"
                    />
                    <span className="mt-2 block truncate text-xs font-bold text-surface-900 transition-colors group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
                      {product.Name}
                    </span>
                  </button>

                  <div className="mt-3 pt-2.5 border-t border-surface-200/60 dark:border-surface-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-surface-900 dark:text-white">
                        {formatCurrency(Number(product.Price))}
                      </span>
                      <span className="block text-micro text-surface-500 dark:text-surface-400">
                        {Number(product.Stock) <= 0 ? 'Stock Out' : `Stock: ${product.Stock}`}
                      </span>
                    </div>

                    {onAddToCart && (
                      <button
                        type="button"
                        disabled={Number(product.Stock) <= 0}
                        onClick={() => onAddToCart(product, 1)}
                        aria-label={Number(product.Stock) <= 0 ? `${product.Name}: Out of stock` : `${t('addToCart')}: ${product.Name}`}
                        className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-xs cursor-pointer disabled:bg-surface-200 disabled:text-brand-900 disabled:cursor-not-allowed dark:disabled:bg-surface-800 dark:disabled:text-brand-200"
                        title={Number(product.Stock) <= 0 ? 'Out of stock' : 'Add to cart'}
                      >
                        {Number(product.Stock) <= 0 ? 'Out' : <ShoppingBag className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
              No new products are available yet.
            </p>
          )}
        </div>
      )}

    </section>
  );
};
