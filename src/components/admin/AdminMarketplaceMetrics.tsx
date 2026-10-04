import React from 'react';
import {
  fetchTopRatedProducts,
  fetchTopRatedSellers,
  fetchTrendingProducts,
} from '../../lib/api';
import { api } from '../../lib/api';
import { Order, Product, Rider, Seller } from '../../types';
import {
  BarChart3,
  Package,
  RefreshCw,
  Store,
  Truck,
  UserRound,
} from 'lucide-react';

interface AdminMarketplaceMetricsProps {
  products: Product[];
  sellers: Seller[];
  orders: Order[];
}

type MetricGroup = 'products' | 'vendors' | 'riders';

interface MetricEntry {
  id: string;
  name: string;
  detail: string;
  value: string;
  image?: string;
  measure?: number;
  progressScale?: number;
  progress?: number;
}

interface Leaderboard {
  title: string;
  description: string;
  entries: MetricEntry[];
}

const formatMetricDate = (value?: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date unavailable';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const AdminMarketplaceMetrics: React.FC<AdminMarketplaceMetricsProps> = ({
  products,
  sellers,
  orders,
}) => {
  const [activeGroup, setActiveGroup] = React.useState<MetricGroup>('products');
  const [trendingProducts, setTrendingProducts] = React.useState<Awaited<ReturnType<typeof fetchTrendingProducts>>>([]);
  const [topRatedProducts, setTopRatedProducts] = React.useState<Awaited<ReturnType<typeof fetchTopRatedProducts>>>([]);
  const [topRatedSellers, setTopRatedSellers] = React.useState<Awaited<ReturnType<typeof fetchTopRatedSellers>>>([]);
  const [riders, setRiders] = React.useState<Rider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadErrors, setLoadErrors] = React.useState<string[]>([]);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let isMounted = true;

    const loadRankings = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        fetchTrendingProducts(5),
        fetchTopRatedProducts(5),
        fetchTopRatedSellers(5),
        api.getRiderLeaderboard(),
      ]);
      if (!isMounted) return;

      const errors: string[] = [];
      const [trendingResult, ratedProductsResult, ratedSellersResult, ridersResult] = results;
      if (trendingResult.status === 'fulfilled') setTrendingProducts(trendingResult.value);
      else errors.push('Top trend products');
      if (ratedProductsResult.status === 'fulfilled') setTopRatedProducts(ratedProductsResult.value);
      else errors.push('Top rated products');
      if (ratedSellersResult.status === 'fulfilled') setTopRatedSellers(ratedSellersResult.value);
      else errors.push('Top rated vendors');
      if (ridersResult.status === 'fulfilled') setRiders(ridersResult.value);
      else errors.push('Rider metrics');
      setLoadErrors(errors);
      setLoading(false);
    };

    void loadRankings();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const vendorSales = React.useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => {
      if (order.Status === 'cancelled') return;
      order.Items.forEach((item) => {
        totals.set(item.Seller_ID, (totals.get(item.Seller_ID) || 0) + Math.max(0, Number(item.Quantity) || 0));
      });
    });
    return totals;
  }, [orders]);

  const sellerById = React.useMemo(
    () => new Map(sellers.map((seller) => [seller.Seller_ID, seller])),
    [sellers]
  );

  const productLeaderboards: Leaderboard[] = [
    {
      title: 'Top Rated Products',
      description: 'Average rating · minimum 3 reviews',
      entries: topRatedProducts.map((product) => ({
        id: product.product_id,
        name: product.product_name,
        detail: `${product.total_reviews} reviews`,
        value: `${Number(product.average_rating).toFixed(1)} / 5`,
        image: product.image,
        measure: Number(product.average_rating),
        progressScale: 5,
      })),
    },
    {
      title: 'Top Trends',
      description: 'Ranked by units sold',
      entries: trendingProducts.map((product) => ({
        id: product.product_id,
        name: product.product_name,
        detail: product.category_name,
        value: `${Number(product.total_units_sold).toLocaleString()} sold`,
        image: product.image,
        measure: Number(product.total_units_sold),
      })),
    },
    {
      title: 'Latest Added',
      description: 'Most recently listed active products',
      entries: products
        .filter((product) => product.Product_Status?.toLowerCase() === 'active')
        .slice()
        .sort((a, b) => Date.parse(b.Created_At || '') - Date.parse(a.Created_At || ''))
        .slice(0, 5)
        .map((product) => ({
          id: product.Product_ID,
          name: product.Name,
          detail: sellerById.get(product.Seller_ID)?.Name || 'Vendor unavailable',
          value: formatMetricDate(product.Created_At),
          image: product.Image,
        })),
    },
  ];

  const vendorLeaderboards: Leaderboard[] = [
    {
      title: 'Top Rated Vendors',
      description: 'Ranked by customer reviews',
      entries: topRatedSellers.map((seller) => ({
        id: seller.seller_id,
        name: seller.seller_name,
        detail: `${seller.total_reviews} product reviews`,
        value: `${Number(seller.average_rating).toFixed(1)} / 5`,
        image: seller.logo,
        measure: Number(seller.average_rating),
        progressScale: 5,
      })),
    },
    {
      title: 'Top Selling Vendors',
      description: 'Units sold across non-cancelled orders',
      entries: Array.from(vendorSales.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .flatMap(([sellerId, units]) => {
          const seller = sellerById.get(sellerId);
          return seller ? [{
            id: sellerId,
            name: seller.Name,
            detail: `${seller.Status} vendor`,
            value: `${units.toLocaleString()} sold`,
            image: seller.Logo,
            measure: units,
          }] : [];
        }),
    },
    {
      title: 'Latest Vendors',
      description: 'Most recently registered vendors',
      entries: sellers
        .slice()
        .sort((a, b) => Date.parse(b.Created_At || '') - Date.parse(a.Created_At || ''))
        .slice(0, 5)
        .map((seller) => ({
          id: seller.Seller_ID,
          name: seller.Name,
          detail: `${seller.Status} vendor`,
          value: formatMetricDate(seller.Created_At),
          image: seller.Logo,
        })),
    },
  ];

  const approvedRiders = riders.filter((rider) => rider.Status === 'approved');
  const riderLeaderboards: Leaderboard[] = [
    {
      title: 'Top Timely Riders',
      description: 'Ranked by on-time deliveries · rate shown',
      entries: approvedRiders
        .filter((rider) => rider.Timely_Deliveries > 0)
        .slice()
        .sort((a, b) => b.Timely_Deliveries - a.Timely_Deliveries)
        .slice(0, 5)
        .map((rider) => ({
          id: rider.Rider_ID,
          name: rider.Name,
          detail: `${rider.Total_Deliveries > 0 ? Math.round((rider.Timely_Deliveries / rider.Total_Deliveries) * 100) : 0}% on time`,
          value: `${rider.Timely_Deliveries.toLocaleString()} on time`,
          image: rider.Profile_Image,
          measure: rider.Timely_Deliveries,
        })),
    },
    {
      title: 'Top Delivery Makers',
      description: 'Ranked by completed deliveries',
      entries: approvedRiders
        .filter((rider) => rider.Total_Deliveries > 0)
        .slice()
        .sort((a, b) => b.Total_Deliveries - a.Total_Deliveries)
        .slice(0, 5)
        .map((rider) => ({
          id: rider.Rider_ID,
          name: rider.Name,
          detail: `${rider.Timely_Deliveries.toLocaleString()} on-time deliveries`,
          value: `${rider.Total_Deliveries.toLocaleString()} deliveries`,
          image: rider.Profile_Image,
          measure: rider.Total_Deliveries,
        })),
    },
    {
      title: 'Top Rated Riders',
      description: 'Customer rating average',
      entries: approvedRiders
        .filter((rider) => Number(rider.Average_Rating) > 0)
        .slice()
        .sort((a, b) => Number(b.Average_Rating) - Number(a.Average_Rating))
        .slice(0, 5)
        .map((rider) => ({
          id: rider.Rider_ID,
          name: rider.Name,
          detail: `${rider.Total_Deliveries.toLocaleString()} deliveries`,
          value: `${Number(rider.Average_Rating).toFixed(1)} / 5`,
          image: rider.Profile_Image,
          measure: Number(rider.Average_Rating),
          progressScale: 5,
        })),
    },
  ];

  const groupOptions: { id: MetricGroup; label: string; icon: React.ElementType }[] = [
    { id: 'products', label: 'Products', icon: Package },
    { id: 'vendors', label: 'Vendors', icon: Store },
    { id: 'riders', label: 'Riders', icon: Truck },
  ];
  const selectedLeaderboards = activeGroup === 'products'
    ? productLeaderboards
    : activeGroup === 'vendors'
      ? vendorLeaderboards
      : riderLeaderboards;
  const activeLeaderboards = selectedLeaderboards.map((leaderboard) => {
    const maximumMeasure = Math.max(0, ...leaderboard.entries.map((entry) => entry.measure || 0));
    return {
      ...leaderboard,
      entries: leaderboard.entries.map((entry) => {
        const scale = entry.progressScale || maximumMeasure;
        return {
          ...entry,
          progress: entry.measure !== undefined && scale > 0
            ? Math.min(100, Math.max(0, (entry.measure / scale) * 100))
            : undefined,
        };
      }),
    };
  });
  const FallbackIcon = activeGroup === 'products' ? Package : activeGroup === 'vendors' ? Store : UserRound;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Marketplace Metrics</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Ranked product, vendor, and rider performance.</p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh metrics
        </button>
      </header>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-zinc-800 dark:bg-[#181F2A]">
        {groupOptions.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeGroup === id}
            onClick={() => setActiveGroup(id)}
            className={`inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activeGroup === id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-[#252E3A] dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loadErrors.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Some rankings could not be loaded: {loadErrors.join(', ')}. Refresh to try again.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#12161D]">
        {loading ? (
          <div role="status" aria-label="Loading marketplace rankings" className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-zinc-800 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {activeLeaderboards.map((leaderboard) => (
              <section key={leaderboard.title} className="min-w-0 p-4 sm:p-5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{leaderboard.title}</h3>
                <div aria-hidden="true" className="mt-4 animate-pulse space-y-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="flex items-center gap-2.5 py-2">
                      <span className="h-6 w-6 shrink-0 rounded-md bg-slate-200 dark:bg-zinc-800" />
                      <span className="h-9 w-9 shrink-0 rounded-md bg-slate-200 dark:bg-zinc-800" />
                      <span className="min-w-0 flex-1 space-y-2">
                        <span className="block h-2.5 w-3/4 rounded bg-slate-200 dark:bg-zinc-800" />
                        <span className="block h-2 w-1/2 rounded bg-slate-100 dark:bg-zinc-900" />
                      </span>
                      <span className="h-2.5 w-10 shrink-0 rounded bg-slate-200 dark:bg-zinc-800" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-zinc-800 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {activeLeaderboards.map((leaderboard) => (
              <section key={leaderboard.title} className="min-w-0 p-4 sm:p-5">
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{leaderboard.title}</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">{leaderboard.description}</p>
                  </div>
                  <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-sky-400" />
                </header>
                {leaderboard.entries.length > 0 ? (
                  <ol className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {leaderboard.entries.map((entry, index) => (
                      <li key={entry.id} className="group relative isolate flex min-w-0 items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-slate-50 dark:hover:bg-[#181F2A]/80 first:pt-2 last:pb-2">
                        {entry.progress !== undefined && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 -z-10 rounded-lg bg-gradient-to-r from-sky-500/10 to-blue-500/10 transition-[width] duration-500 dark:from-sky-400/8 dark:to-blue-400/8"
                            style={{ width: `${entry.progress}%` }}
                          />
                        )}
                        <span
                          className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black shadow-xs ${
                            index === 0
                              ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-amber-500/20'
                              : index === 1
                              ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-slate-400/20'
                              : index === 2
                              ? 'bg-gradient-to-br from-amber-700 to-orange-800 text-amber-100'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                          }`}
                        >
                          {index + 1}
                        </span>
                        {entry.image ? (
                          <img src={entry.image} alt="" className="relative z-10 h-10 w-10 shrink-0 rounded-xl border border-slate-200 dark:border-zinc-700 object-cover" />
                        ) : (
                          <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-400">
                            <FallbackIcon className="h-5 w-5" />
                          </span>
                        )}
                        <div className="relative z-10 min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-sky-400">{entry.name}</p>
                          <p className="truncate text-[10px] text-slate-500 dark:text-zinc-400">{entry.detail}</p>
                        </div>
                        <div className="relative z-10 shrink-0 text-right">
                          <p className="text-xs font-bold tabular-nums text-slate-800 dark:text-zinc-200">{entry.value}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-zinc-400">No ranking data available yet.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
