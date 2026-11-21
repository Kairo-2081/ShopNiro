import React from 'react';
import { formatBDT } from '../../lib/api';
import { Order, Seller } from '../../types';
import { useLocale } from '../../lib/i18n';
import { ChartPanel } from '../charts/ChartPanel';
import { RangeMonths, RangeSelector } from '../charts/RangeSelector';
import { ShareBreakdown, ShareSlice } from '../charts/ShareBreakdown';
import { Sparkline } from '../charts/Sparkline';
import { StatTile } from '../charts/StatTile';
import { TrendAreaChart } from '../charts/TrendAreaChart';
import { percentChange, sum } from '../charts/format';
import { monthBuckets, placedMonthKey } from '../charts/months';

interface AdminOverviewAnalyticsProps {
  orders: Order[];
  sellers?: Seller[];
  isLoading?: boolean;
  /** Draws the weekday chart for the orders in the chosen range. */
  renderWeekday?: (orders: Order[]) => React.ReactNode;
  onViewMerchants?: () => void;
}

interface MonthTotals {
  orders: number;
  billable: number;
  value: number;
  delivered: number;
}

type TrendMeasure = 'revenue' | 'orders' | 'average';

const paymentPresentation: Record<string, { label: string; color: string }> = {
  cash_on_delivery: { label: 'COD', color: 'var(--chart-cat-1)' },
  bkash: { label: 'bKash', color: 'var(--chart-cat-2)' },
  nagad: { label: 'Nagad', color: 'var(--chart-cat-3)' },
  rocket: { label: 'Rocket', color: 'var(--chart-cat-4)' },
  visa_mastercard: { label: 'Cards', color: 'var(--chart-cat-5)' },
  sslcommerz: { label: 'SSLCommerz', color: 'var(--chart-cat-6)' },
};

// Soft tiles for the merchant initials. Fixed per merchant so a merchant keeps its colour between visits.
const AVATARS = ['#e0cd8e', '#9ad6b8', '#9db8e8', '#dba17c', '#c9b2e6', '#e6a9b4'];
const avatarFor = (id: string) => AVATARS[Array.from(id).reduce((total, char) => total + char.charCodeAt(0), 0) % AVATARS.length];

const orderValue = (order: Order) => Math.max(0, Number(order.Subtotal) || 0) + Math.max(0, Number(order.Shipping_Fee) || 0);
const counts = (order: Order) => order.Status !== 'cancelled' && order.Payment_Status !== 'refunded';
const emptyTotals = (): MonthTotals => ({ orders: 0, billable: 0, value: 0, delivered: 0 });

export const AdminOverviewAnalytics: React.FC<AdminOverviewAnalyticsProps> = ({ orders, sellers = [], isLoading = false, renderWeekday, onViewMerchants }) => {
  const { t, locale } = useLocale();
  const [measure, setMeasure] = React.useState<TrendMeasure>('revenue');
  const [range, setRange] = React.useState<RangeMonths>(12);

  const analytics = React.useMemo(() => {
    const now = new Date();
    const intl = locale === 'bn' ? 'bn-BD' : undefined;
    const current = monthBuckets(range, now, 0, intl);
    const previousPeriod = monthBuckets(range, now, range);
    const lastYear = monthBuckets(range, now, 12);

    const totals = new Map<string, MonthTotals>();
    const inWindow = new Set(current.map((bucket) => bucket.key));
    const windowOrders: Order[] = [];
    orders.forEach((order) => {
      const key = placedMonthKey(order.Order_Placed_At);
      if (!key) return;
      const month = totals.get(key) ?? emptyTotals();
      month.orders += 1;
      if (counts(order)) {
        month.billable += 1;
        month.value += orderValue(order);
      }
      if (order.Status === 'delivered') month.delivered += 1;
      totals.set(key, month);
      if (inWindow.has(key)) windowOrders.push(order);
    });

    const pick = (buckets: { key: string }[]) => buckets.map((bucket) => totals.get(bucket.key) ?? emptyTotals());
    const now12 = pick(current);
    const before = pick(previousPeriod);
    const year = pick(lastYear);
    const total = (rows: MonthTotals[]) => ({
      orders: sum(rows.map((row) => row.orders)),
      billable: sum(rows.map((row) => row.billable)),
      value: sum(rows.map((row) => row.value)),
      delivered: sum(rows.map((row) => row.delivered)),
    });
    const now_ = total(now12);
    const prev_ = total(before);
    const average = (value: number, billable: number) => (billable > 0 ? value / billable : 0);

    const paymentCounts = new Map<string, number>();
    const merchants = new Map<string, { revenue: number; orderIds: Set<string>; series: number[] }>();
    const indexOf = new Map(current.map((bucket, index) => [bucket.key, index]));
    windowOrders.forEach((order) => {
      const method = String(order.Payment_Method || 'cash_on_delivery').toLowerCase();
      paymentCounts.set(method, (paymentCounts.get(method) || 0) + 1);
      if (!counts(order)) return;
      const slot = indexOf.get(placedMonthKey(order.Order_Placed_At) ?? '') ?? 0;
      (order.Items || []).forEach((item) => {
        const entry = merchants.get(item.Seller_ID) ?? { revenue: 0, orderIds: new Set<string>(), series: new Array(range).fill(0) };
        const line = Math.max(0, Number(item.Price) || 0) * Math.max(0, Number(item.Quantity) || 0);
        entry.revenue += line;
        entry.series[slot] += line;
        entry.orderIds.add(order.Order_ID);
        merchants.set(item.Seller_ID, entry);
      });
    });

    const paymentSlices: ShareSlice[] = Array.from(paymentCounts.entries())
      .map(([method, value]) => ({
        key: method,
        name: paymentPresentation[method]?.label || method.replace(/_/g, ' '),
        value,
        color: paymentPresentation[method]?.color || 'var(--chart-axis)',
      }))
      .sort((a, b) => b.value - a.value);

    return {
      labels: current.map((bucket) => bucket.label),
      now12,
      year,
      windowOrders,
      paymentSlices,
      merchants: Array.from(merchants.entries())
        .map(([id, entry]) => ({ id, revenue: entry.revenue, orders: entry.orderIds.size, series: entry.series }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      revenue: now_.value,
      orderCount: now_.orders,
      averageOrder: average(now_.value, now_.billable),
      delivered: now_.delivered,
      revenueChange: percentChange(now_.value, prev_.value),
      orderChange: percentChange(now_.orders, prev_.orders),
      averageChange: percentChange(average(now_.value, now_.billable), average(prev_.value, prev_.billable)),
      hasYear: year.some((row) => row.orders > 0),
    };
  }, [orders, range, locale]);

  const valueOf = (row: MonthTotals) => (measure === 'revenue' ? row.value : measure === 'orders' ? row.orders : row.billable ? row.value / row.billable : 0);
  const trendData = analytics.labels.map((label, index) => ({ label, value: valueOf(analytics.now12[index]) }));
  const lastYearValues = analytics.hasYear ? analytics.year.map(valueOf) : undefined;
  const best = trendData.reduce<{ label: string; value: number } | null>((top, datum) => (datum.value > 0 && (!top || datum.value > top.value) ? datum : top), null);
  const sellerName = (id: string) => sellers.find((seller) => seller.Seller_ID === id)?.Name || t('seller');
  const sellerStatus = (id: string) => sellers.find((seller) => seller.Seller_ID === id)?.Status;

  if (isLoading) {
    return (
      <section aria-label="Loading platform metrics" aria-busy="true" className="space-y-4">
        <div className="premium-skeleton h-6 w-56 rounded-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="premium-skeleton h-36 rounded-2xl" />
          ))}
        </div>
        <div className="premium-skeleton h-[360px] rounded-2xl" />
      </section>
    );
  }

  const measureName = measure === 'revenue' ? t('chartRevenue') : measure === 'orders' ? t('chartOrders') : t('chartAverageOrder');
  const formatTrendValue = (value: number) => (measure === 'orders' ? `${value.toLocaleString()} ${t('chartOrdersUnit')}` : formatBDT(value));
  const comparison = range === 12 ? t('chartVsPreviousYear') : t('chartVsPreviousN', { count: range });
  const periodNote = t('rangeMonths', { count: range });

  const toggle = (
    <div role="group" aria-label={t('chartMeasureGroup')} className="inline-flex rounded-full border border-[var(--chart-line)] bg-[var(--chart-track)] p-0.5 text-xs font-semibold">
      {(['revenue', 'orders', 'average'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={measure === option}
          onClick={() => setMeasure(option)}
          className={`min-h-8 rounded-full px-3.5 py-1 transition-colors ${
            measure === option
              ? 'bg-[var(--chart-card)] text-[var(--chart-ink)] shadow-xs ring-1 ring-[var(--chart-line)]'
              : 'text-[var(--chart-axis)] hover:text-[var(--chart-ink)]'
          }`}
        >
          {option === 'revenue' ? t('chartRevenue') : option === 'orders' ? t('chartOrders') : t('chartAverageOrder')}
        </button>
      ))}
    </div>
  );

  const statusChip = (status?: string) => {
    const tone = status === 'approved' ? 'positive' : status === 'pending' ? 'primary' : 'negative';
    const label = status === 'approved' ? t('merchantActive') : status === 'pending' ? t('merchantPending') : status === 'suspended' ? t('merchantSuspended') : status === 'rejected' ? t('merchantRejected') : '';
    if (!label) return null;
    return (
      <span
        className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
        style={{
          color: `var(--chart-${tone === 'primary' ? 'primary-hi' : tone})`,
          borderColor: `color-mix(in srgb, var(--chart-${tone === 'primary' ? 'primary' : tone}) 40%, transparent)`,
          background: `color-mix(in srgb, var(--chart-${tone === 'primary' ? 'primary' : tone}) 12%, transparent)`,
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <section aria-labelledby="admin-overview-analytics-title" className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="admin-overview-analytics-title" className="font-display text-3xl font-normal text-[var(--chart-ink)] sm:text-4xl">
            {t('marketplaceOverview')}
          </h2>
          <p className="mt-1.5 text-base text-[var(--chart-axis)]">{t('marketplaceOverviewSub', { count: range })}</p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={t('chartRevenue')}
          value={formatBDT(analytics.revenue)}
          count={{ value: analytics.revenue, format: formatBDT }}
          note={periodNote}
          trend={analytics.now12.map((row) => row.value)}
          change={analytics.revenueChange}
          comparison={comparison}
        />
        <StatTile
          label={t('chartOrders')}
          value={analytics.orderCount.toLocaleString()}
          count={{ value: analytics.orderCount, format: (n) => Math.round(n).toLocaleString() }}
          note={periodNote}
          trend={analytics.now12.map((row) => row.orders)}
          accent="var(--chart-cat-2)"
          change={analytics.orderChange}
          comparison={comparison}
        />
        <StatTile
          label={t('chartAverageOrder')}
          value={formatBDT(analytics.averageOrder)}
          count={{ value: analytics.averageOrder, format: formatBDT }}
          note={periodNote}
          trend={analytics.now12.map((row) => (row.billable ? row.value / row.billable : 0))}
          accent="var(--chart-cat-3)"
          change={analytics.averageChange}
          comparison={comparison}
        />
        <StatTile
          label={t('chartDelivered')}
          value={analytics.orderCount ? `${((analytics.delivered / analytics.orderCount) * 100).toFixed(1)}%` : '0%'}
          progress={analytics.orderCount ? (analytics.delivered / analytics.orderCount) * 100 : 0}
          accent="var(--chart-positive)"
          note={t('chartDeliveredNote', { count: analytics.delivered.toLocaleString(), total: analytics.orderCount.toLocaleString() })}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartPanel
          className="lg:col-span-2"
          headingId="admin-trend-title"
          title={t('chartTrendTitle')}
          subtitle={lastYearValues ? t('chartTrendSubtitleLastYear', { measure: measureName.toLowerCase() }) : t('chartTrendSubtitle', { measure: measureName.toLowerCase() })}
          actions={toggle}
          featured
        >
          {analytics.orderCount > 0 ? (
            <>
              <TrendAreaChart
                data={trendData}
                name={measureName}
                formatValue={formatTrendValue}
                ariaLabel={measure === 'orders' ? t('chartOrdersAria') : t('chartRevenueAria')}
                previous={lastYearValues}
                previousName={t('chartLastYear')}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-[var(--chart-axis)]">
                <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-[var(--chart-primary)]" />
                    {lastYearValues ? t('chartThisYear') : measureName}
                  </span>
                  {lastYearValues && (
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className="w-6 border-t-2 border-dotted border-[var(--chart-axis)]" />
                      {t('chartLastYear')}
                    </span>
                  )}
                </span>
                {best && (
                  <span>
                    {t('chartBestMonth')} · <span className="font-bold text-[var(--chart-ink)]">{best.label}</span> · <span className="tabular-nums">{formatTrendValue(best.value)}</span>
                  </span>
                )}
              </div>
              <details className="mt-1 text-xs">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold text-[var(--chart-primary-hi)] underline decoration-[var(--chart-line)] underline-offset-4">
                  {t('viewMonthlyDataAsTable')}
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-left">
                    <caption className="sr-only">{t('monthlyOrderValueTitle')}</caption>
                    <thead>
                      <tr className="border-b border-[var(--chart-line)]">
                        <th scope="col" className="p-2">{t('monthCol')}</th>
                        <th scope="col" className="p-2">{t('ordersCol')}</th>
                        <th scope="col" className="p-2">{t('orderValueCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.labels.map((label, index) => (
                        <tr key={`${label}-${index}`} className="border-b border-[var(--chart-hair)]">
                          <th scope="row" className="p-2 font-medium">{label}</th>
                          <td className="p-2 tabular-nums">{analytics.now12[index].orders.toLocaleString()}</td>
                          <td className="p-2 tabular-nums">{formatBDT(analytics.now12[index].value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-center text-xs text-[var(--chart-axis)]">
              {t('noOrdersPast12Months')}
            </div>
          )}
        </ChartPanel>

        <ChartPanel headingId="admin-payment-title" title={t('adminPaymentTitle')} subtitle={t('adminPaymentSub', { count: analytics.orderCount.toLocaleString() })}>
          {analytics.paymentSlices.length > 0 ? (
            <ShareBreakdown
              slices={analytics.paymentSlices}
              centerValue={analytics.orderCount.toLocaleString()}
              centerLabel={t('chartOrders')}
              ariaLabel={t('chartPaymentAria')}
              unit={t('chartOrdersUnit')}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--chart-line)] text-center text-micro text-[var(--chart-axis)]">
              {t('noPaymentData')}
            </div>
          )}
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {renderWeekday && <div className="min-w-0 lg:col-span-2">{renderWeekday(analytics.windowOrders)}</div>}

        <ChartPanel
          className="lg:col-span-3"
          headingId="admin-merchants-title"
          title={t('topMerchants')}
          subtitle={t('topMerchantsSub', { count: range })}
          actions={onViewMerchants && (
            <button type="button" onClick={onViewMerchants} className="min-h-10 rounded-full border border-[var(--chart-line)] px-4 text-sm font-medium text-[var(--chart-ink)] hover:bg-[var(--chart-track)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-primary)]">
              {t('viewAllMerchants')}
            </button>
          )}
        >
          {analytics.merchants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <caption className="sr-only">{t('topMerchants')}</caption>
                <thead>
                  <tr className="border-b border-[var(--chart-line)] text-sm font-medium text-[var(--chart-axis)]">
                    <th scope="col" className="px-2 pb-3 font-medium">{t('merchantCol')}</th>
                    <th scope="col" className="px-2 pb-3 font-medium">{t('ordersCol')}</th>
                    <th scope="col" className="px-2 pb-3 font-medium">{t('chartRevenue')}</th>
                    <th scope="col" className="px-2 pb-3 font-medium">{t('trendCol')}</th>
                    <th scope="col" className="px-2 pb-3"><span className="sr-only">Status</span></th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.merchants.map((merchant) => (
                    <tr key={merchant.id} className="border-b border-[var(--chart-hair)] last:border-0">
                      <th scope="row" className="px-2 py-3 font-medium text-[var(--chart-ink)]">
                        <span className="flex items-center gap-3">
                          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-[#1a1a17]" style={{ background: avatarFor(merchant.id) }}>
                            {sellerName(merchant.id).charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 truncate">{sellerName(merchant.id)}</span>
                        </span>
                      </th>
                      <td className="px-2 py-3 tabular-nums text-[var(--chart-axis)]">{merchant.orders.toLocaleString()}</td>
                      <td className="px-2 py-3 font-semibold tabular-nums text-[var(--chart-ink)]">{formatBDT(merchant.revenue)}</td>
                      <td className="px-2 py-3"><Sparkline values={merchant.series} className="w-24" /></td>
                      <td className="px-2 py-3 text-right">{statusChip(sellerStatus(merchant.id))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('topMerchantsEmpty')}</p>
          )}
        </ChartPanel>
      </div>
    </section>
  );
};
