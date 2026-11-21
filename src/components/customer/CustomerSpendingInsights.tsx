import React from 'react';
import { formatBDT } from '../../lib/api';
import { useLocale } from '../../lib/i18n';
import { Category, Order, OrderStatus, Product } from '../../types';
import { ChartPanel } from '../charts/ChartPanel';
import { RangeMonths, RangeSelector } from '../charts/RangeSelector';
import { ShareBreakdown, ShareSlice } from '../charts/ShareBreakdown';
import { StatTile } from '../charts/StatTile';
import { TrendAreaChart } from '../charts/TrendAreaChart';
import { percentChange, sum } from '../charts/format';
import { monthBuckets, placedMonthKey } from '../charts/months';

interface CustomerSpendingInsightsProps {
  orders: Order[];
  products?: Product[];
  categories?: Category[];
  onViewOrders?: () => void;
}

const orderValue = (order: Order) => Math.max(0, Number(order.Subtotal) || 0) + Math.max(0, Number(order.Shipping_Fee) || 0);
const counts = (order: Order) => order.Status !== 'cancelled' && order.Payment_Status !== 'refunded';
const whole = (value: number) => formatBDT(value).replace(/\.\d+$/, '');

const STEPS: Record<OrderStatus, number> = { placed: 1, processing: 2, shipped: 3, delivered: 4, cancelled: 0 };
const CATEGORY_COLORS = ['var(--chart-cat-1)', 'var(--chart-cat-2)', 'var(--chart-cat-3)', 'var(--chart-cat-4)', 'var(--chart-cat-5)'];

/**
 * Where the customer's money went: four headline figures, the month-by-month line, a split by product category and the
 * most recent orders. Everything is read from the customer's own orders, so nothing is fetched and nothing is invented.
 */
export const CustomerSpendingInsights: React.FC<CustomerSpendingInsightsProps> = ({ orders, products = [], categories = [], onViewOrders }) => {
  const { t, locale } = useLocale();
  const [range, setRange] = React.useState<RangeMonths>(6);
  const intl = locale === 'bn' ? 'bn-BD' : 'en-BD';

  const data = React.useMemo(() => {
    const now = new Date();
    const buckets = monthBuckets(range, now, 0, intl);
    const index = new Map(buckets.map((bucket, position) => [bucket.key, position]));
    const monthly = buckets.map(() => ({ value: 0, orders: 0 }));
    const previousBuckets = monthBuckets(range, now, range);
    const previous = { value: 0, billable: 0 };
    const previousKeys = new Set(previousBuckets.map((bucket) => bucket.key));
    const productById = new Map(products.map((product) => [product.Product_ID, product]));
    const categoryName = new Map(categories.map((category) => [category.Category_ID, category.Name]));
    const byCategory = new Map<string, number>();
    let delivered = 0;
    let billable = 0;
    let windowOrders = 0;

    orders.forEach((order) => {
      const key = placedMonthKey(order.Order_Placed_At);
      if (!key) return;
      const slot = index.get(key);
      if (slot === undefined) {
        if (previousKeys.has(key) && counts(order)) {
          previous.value += orderValue(order);
          previous.billable += 1;
        }
        return;
      }
      windowOrders += 1;
      if (order.Status === 'delivered') delivered += 1;
      if (!counts(order)) return;
      billable += 1;
      monthly[slot].value += orderValue(order);
      monthly[slot].orders += 1;
      (order.Items || []).forEach((item) => {
        const categoryId = productById.get(item.Product_ID)?.Category_ID;
        const name = (categoryId && categoryName.get(categoryId)) || t('spendOtherCategory');
        byCategory.set(name, (byCategory.get(name) || 0) + Math.max(0, Number(item.Price) || 0) * Math.max(0, Number(item.Quantity) || 0));
      });
    });

    // Categories add up the item prices; the monthly total is what was actually paid, delivery included and vouchers
    // taken off. The difference is shown as its own slice, so the ring and the line always tell the same total.
    const spent = sum(monthly.map((month) => month.value));
    const itemTotal = sum(Array.from(byCategory.values()));
    const scale = itemTotal > spent && itemTotal > 0 ? spent / itemTotal : 1;
    const ranked = Array.from(byCategory.entries()).map(([name, value]) => [name, value * scale] as const).sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, ranked.length > 3 ? 2 : 3);
    const rest = ranked.slice(top.length);
    const slices: ShareSlice[] = top.map(([name, value], position) => ({ key: name, name, value, color: CATEGORY_COLORS[position] }));
    if (rest.length) slices.push({ key: 'other', name: t('spendOtherCategory'), value: sum(rest.map(([, value]) => value)), color: CATEGORY_COLORS[slices.length] });
    const remainder = spent - sum(slices.map((slice) => slice.value));
    if (remainder > 0.5) slices.push({ key: 'delivery', name: t('spendDeliveryCategory'), value: remainder, color: CATEGORY_COLORS[slices.length] });

    const last = monthly.length - 1;
    const total = sum(monthly.map((month) => month.value));
    const averageOf = (value: number, count: number) => (count > 0 ? value / count : 0);
    return {
      labels: buckets.map((bucket) => bucket.label),
      monthly,
      slices,
      total,
      thisMonth: monthly[last],
      lastMonth: monthly[last - 1],
      average: averageOf(total, billable),
      averageChange: percentChange(averageOf(total, billable), averageOf(previous.value, previous.billable)),
      billable,
      delivered,
      windowOrders,
      thisMonthName: new Intl.DateTimeFormat(intl, { month: 'long' }).format(now),
      lastMonthName: new Intl.DateTimeFormat(intl, { month: 'long' }).format(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    };
  }, [orders, products, categories, range, intl, t]);

  const recent = React.useMemo(
    () => [...orders].sort((a, b) => new Date(b.Order_Placed_At).getTime() - new Date(a.Order_Placed_At).getTime()).slice(0, 5),
    [orders],
  );

  if (!orders.length) return null;

  const formatCount = (value: number) => Math.round(value).toLocaleString(intl);
  const statusLabel = (status: OrderStatus) => (status === 'delivered' ? t('delivered') : status === 'shipped' ? t('shipped') : status === 'processing' ? t('processingOrder') : status === 'cancelled' ? t('cancelled') : t('orderRegistered'));
  const statusTone = (status: OrderStatus) => (status === 'delivered' ? 'positive' : status === 'shipped' ? 'cat-3' : status === 'cancelled' ? 'negative' : 'primary');
  const chip = (status: OrderStatus) => {
    const tone = statusTone(status);
    const base = tone === 'primary' ? 'var(--chart-primary)' : `var(--chart-${tone})`;
    return (
      <span
        className="inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium"
        style={{ color: tone === 'primary' ? 'var(--chart-primary-hi)' : base, borderColor: `color-mix(in srgb, ${base} 40%, transparent)`, background: `color-mix(in srgb, ${base} 12%, transparent)` }}
      >
        {statusLabel(status)}
      </span>
    );
  };

  return (
    <section aria-labelledby="customer-spending-title" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="customer-spending-title" className="font-display text-3xl font-normal text-[var(--chart-ink)] sm:text-4xl">{t('spendInsightsTitle')}</h2>
          <p className="mt-1.5 text-base text-[var(--chart-axis)]">{t('spendSubtitleRange', { count: range })}</p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={t('spendInMonth', { month: data.thisMonthName })}
          value={formatBDT(data.thisMonth.value)}
          count={{ value: data.thisMonth.value, format: formatBDT }}
          trend={data.monthly.map((month) => month.value)}
          change={data.lastMonth ? percentChange(data.thisMonth.value, data.lastMonth.value) : null}
          comparison={t('spendVsMonth', { month: data.lastMonthName })}
          accent="var(--chart-primary)"
        />
        <StatTile
          label={t('spendOrdersPlaced')}
          value={formatCount(data.thisMonth.orders)}
          count={{ value: data.thisMonth.orders, format: formatCount }}
          trend={data.monthly.map((month) => month.orders)}
          change={data.lastMonth ? percentChange(data.thisMonth.orders, data.lastMonth.orders) : null}
          comparison={t('spendThisMonth')}
          accent="var(--chart-cat-2)"
        />
        <StatTile
          label={t('spendAverageOrder')}
          value={formatBDT(data.average)}
          count={{ value: data.average, format: formatBDT }}
          trend={data.monthly.map((month) => (month.orders ? month.value / month.orders : 0))}
          change={data.averageChange}
          comparison={t('spendAcrossOrders', { count: formatCount(data.billable) })}
          accent="var(--chart-cat-3)"
        />
        <StatTile
          label={t('chartDelivered')}
          value={data.windowOrders ? `${((data.delivered / data.windowOrders) * 100).toFixed(0)}%` : '0%'}
          progress={data.windowOrders ? (data.delivered / data.windowOrders) * 100 : 0}
          accent="var(--chart-positive)"
          note={t('chartDeliveredNote', { count: formatCount(data.delivered), total: formatCount(data.windowOrders) })}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <ChartPanel headingId="customer-spend-month-title" title={t('spendMonthlyTitle')} subtitle={t('spendTotalOver', { amount: whole(data.total), count: range })} className="lg:col-span-3" featured>
          {data.total > 0 ? (
            <TrendAreaChart
              data={data.labels.map((label, index) => ({ label, value: data.monthly[index].value }))}
              name={t('spendTotalSpent')}
              formatValue={formatBDT}
              ariaLabel={t('spendByMonthAria')}
              height={300}
            />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('spendNoSpending')}</p>
          )}
        </ChartPanel>
        <ChartPanel headingId="customer-spend-category-title" title={t('spendWhereTitle')} subtitle={t('spendByCategory')} className="lg:col-span-2">
          {data.slices.length > 0 ? (
            <ShareBreakdown
              slices={data.slices}
              centerValue={formatCount(data.total)}
              centerLabel={t('spendInTotal')}
              ariaLabel={t('spendCategoryAria')}
              unit="BDT"
              formatValue={whole}
            />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('spendNoSpending')}</p>
          )}
        </ChartPanel>
      </div>

      <ChartPanel
        headingId="customer-recent-orders-title"
        title={t('recentOrdersTitle')}
        subtitle={t('recentOrdersSub')}
        actions={onViewOrders && (
          <button type="button" onClick={onViewOrders} className="min-h-10 rounded-full border border-[var(--chart-line)] px-4 text-sm font-medium text-[var(--chart-ink)] hover:bg-[var(--chart-track)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-primary)]">
            {t('viewAllOrders')}
          </button>
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">{t('recentOrdersTitle')}</caption>
            <thead>
              <tr className="border-b border-[var(--chart-line)] text-sm text-[var(--chart-axis)]">
                {(['colOrder', 'colItem', 'colPlaced', 'colProgress', 'colTotal'] as const).map((key) => (
                  <th key={key} scope="col" className="px-2 pb-3 font-medium">{t(key)}</th>
                ))}
                <th scope="col" className="px-2 pb-3"><span className="sr-only">Status</span></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => {
                const first = order.Items?.[0];
                const extra = (order.Items?.length || 0) - 1;
                const step = STEPS[order.Status];
                return (
                  <tr key={order.Order_ID} className="border-b border-[var(--chart-hair)] last:border-0">
                    <th scope="row" className="px-2 py-3.5 font-semibold tabular-nums text-[var(--chart-ink)]">#{order.Order_ID.replace(/^ORD-/, '').slice(-8)}</th>
                    <td className="px-2 py-3.5 text-[var(--chart-ink)]">
                      {first?.Name ?? '-'}
                      {extra > 0 && <span className="ml-2 text-sm text-[var(--chart-axis)]">{t('moreItemsCount', { count: extra })}</span>}
                    </td>
                    <td className="px-2 py-3.5 text-[var(--chart-axis)]">{new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric' }).format(new Date(order.Order_Placed_At))}</td>
                    <td className="px-2 py-3.5">
                      <span role="img" aria-label={statusLabel(order.Status)} className="flex w-44 gap-1.5">
                        {[1, 2, 3, 4].map((part) => (
                          <span key={part} className="h-1.5 flex-1 rounded-full" style={{ background: part <= step ? 'var(--chart-primary)' : 'var(--chart-track)' }} />
                        ))}
                      </span>
                    </td>
                    <td className="px-2 py-3.5 font-semibold tabular-nums text-[var(--chart-ink)]">{whole(orderValue(order))}</td>
                    <td className="px-2 py-3.5 text-right">{chip(order.Status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartPanel>
    </section>
  );
};
