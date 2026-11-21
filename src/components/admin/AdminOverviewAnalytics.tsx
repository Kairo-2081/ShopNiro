import React from 'react';
import { formatBDT } from '../../lib/api';
import { Order, OrderStatus } from '../../types';
import { useLocale } from '../../lib/i18n';
import { ChartPanel } from '../charts/ChartPanel';
import { ShareBreakdown, ShareSlice } from '../charts/ShareBreakdown';
import { StatTile } from '../charts/StatTile';
import { TrendAreaChart } from '../charts/TrendAreaChart';
import { percentChange, sum } from '../charts/format';

interface AdminOverviewAnalyticsProps {
  orders: Order[];
  isLoading?: boolean;
  /** Sits next to the order status ring, for example the weekday chart. */
  children?: React.ReactNode;
}

interface MonthlyMetric {
  month: string;
  orderCount: number;
  billableCount: number;
  orderValue: number;
}

type TrendMeasure = 'revenue' | 'orders' | 'average';

// Colour follows the entity, never its rank: the same status or payment method has the same colour in every chart and
// in every theme. The slots are the validated --chart-cat-N tokens from index.css.
const statusPresentation: Record<OrderStatus, { label: string; color: string }> = {
  placed: { label: 'Placed', color: 'var(--chart-cat-5)' },
  processing: { label: 'Processing', color: 'var(--chart-cat-3)' },
  shipped: { label: 'Shipped', color: 'var(--chart-cat-1)' },
  delivered: { label: 'Delivered', color: 'var(--chart-positive)' },
  cancelled: { label: 'Cancelled', color: 'var(--chart-cat-4)' },
};

const paymentPresentation: Record<string, { label: string; color: string }> = {
  cash_on_delivery: { label: 'COD', color: 'var(--chart-cat-1)' },
  bkash: { label: 'bKash', color: 'var(--chart-cat-2)' },
  nagad: { label: 'Nagad', color: 'var(--chart-cat-3)' },
  rocket: { label: 'Rocket', color: 'var(--chart-cat-4)' },
  visa_mastercard: { label: 'Cards', color: 'var(--chart-cat-5)' },
  sslcommerz: { label: 'SSLCommerz', color: 'var(--chart-cat-6)' },
};

export const AdminOverviewAnalytics: React.FC<AdminOverviewAnalyticsProps> = ({ orders, isLoading = false, children }) => {
  const { t } = useLocale();
  const [measure, setMeasure] = React.useState<TrendMeasure>('revenue');

  const analytics = React.useMemo(() => {
    const now = new Date();
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const byMonth = new Map<string, MonthlyMetric>();
    const monthly: MonthlyMetric[] = [];

    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + offset, 1);
      const metric: MonthlyMetric = {
        month: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        orderCount: 0,
        billableCount: 0,
        orderValue: 0,
      };
      byMonth.set(`${date.getFullYear()}-${date.getMonth()}`, metric);
      monthly.push(metric);
    }

    const statusCounts = new Map<OrderStatus, number>();
    const paymentCounts = new Map<string, number>();
    let recentCount = 0;

    orders.forEach((order) => {
      statusCounts.set(order.Status, (statusCounts.get(order.Status) || 0) + 1);

      const methodKey = String(order.Payment_Method || 'cash_on_delivery').toLowerCase();
      paymentCounts.set(methodKey, (paymentCounts.get(methodKey) || 0) + 1);

      const placedAt = new Date(order.Order_Placed_At);
      if (Number.isNaN(placedAt.getTime())) return;
      const month = byMonth.get(`${placedAt.getFullYear()}-${placedAt.getMonth()}`);
      if (!month) return;

      recentCount += 1;
      month.orderCount += 1;
      if (order.Status !== 'cancelled' && order.Payment_Status !== 'refunded') {
        month.billableCount += 1;
        month.orderValue += Math.max(0, Number(order.Subtotal) || 0) + Math.max(0, Number(order.Shipping_Fee) || 0);
      }
    });

    const statusSlices: ShareSlice[] = (Object.keys(statusPresentation) as OrderStatus[])
      .map((status) => ({ key: status, name: statusPresentation[status].label, value: statusCounts.get(status) || 0, color: statusPresentation[status].color }))
      .filter((slice) => slice.value > 0);

    const paymentSlices: ShareSlice[] = Array.from(paymentCounts.entries())
      .map(([method, value]) => ({
        key: method,
        name: paymentPresentation[method]?.label || method.replace(/_/g, ' '),
        value,
        color: paymentPresentation[method]?.color || 'var(--chart-axis)',
      }))
      .sort((a, b) => b.value - a.value);

    // Last six months against the six before them: long enough to smooth out one odd month, short enough to be current.
    const previous = monthly.slice(0, 6);
    const recent = monthly.slice(6);
    const averageOrder = (rows: MonthlyMetric[]) => {
      const billable = sum(rows.map((row) => row.billableCount));
      return billable > 0 ? sum(rows.map((row) => row.orderValue)) / billable : 0;
    };

    return {
      monthly,
      statusSlices,
      paymentSlices,
      hasRecentOrders: recentCount > 0,
      revenue: sum(monthly.map((row) => row.orderValue)),
      orderCount: recentCount,
      averageOrder: averageOrder(monthly),
      revenueChange: percentChange(sum(recent.map((row) => row.orderValue)), sum(previous.map((row) => row.orderValue))),
      orderChange: percentChange(sum(recent.map((row) => row.orderCount)), sum(previous.map((row) => row.orderCount))),
      averageOrderChange: percentChange(averageOrder(recent), averageOrder(previous)),
      deliveredCount: statusCounts.get('delivered') || 0,
    };
  }, [orders]);

  const trendData = React.useMemo(
    () => analytics.monthly.map((row) => ({
      label: row.month.split(' ')[0],
      value: measure === 'revenue' ? row.orderValue : measure === 'orders' ? row.orderCount : row.billableCount ? row.orderValue / row.billableCount : 0,
    })),
    [analytics.monthly, measure],
  );
  const best = React.useMemo(() => {
    let top: { label: string; value: number } | null = null;
    for (const datum of trendData) if (datum.value > 0 && (!top || datum.value > top.value)) top = datum;
    return top;
  }, [trendData]);

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
  const comparison = t('chartVsPrevious6');

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
              ? 'bg-[var(--chart-primary-hi)] text-[var(--chart-on-primary)] shadow-xs'
              : 'text-[var(--chart-axis)] hover:text-[var(--chart-ink)]'
          }`}
        >
          {option === 'revenue' ? t('chartRevenue') : option === 'orders' ? t('chartOrders') : t('chartAverageOrder')}
        </button>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="admin-overview-analytics-title" className="space-y-5">
      <header>
        <h2 id="admin-overview-analytics-title" className="font-display text-3xl font-normal text-[var(--chart-ink)] sm:text-4xl">
          {t('overallPlatformMetrics')}
        </h2>
        <p className="mt-1.5 text-base text-[var(--chart-axis)]">{t('orderActivityPast12Months')}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={t('chartRevenue')}
          value={formatBDT(analytics.revenue)}
          count={{ value: analytics.revenue, format: formatBDT }}
          note={t('chartLast12Months')}
          trend={analytics.monthly.map((row) => row.orderValue)}
          change={analytics.revenueChange}
          comparison={comparison}
        />
        <StatTile
          label={t('chartOrders')}
          value={analytics.orderCount.toLocaleString()}
          count={{ value: analytics.orderCount, format: (n) => Math.round(n).toLocaleString() }}
          note={t('chartLast12Months')}
          trend={analytics.monthly.map((row) => row.orderCount)}
          accent="var(--chart-cat-2)"
          change={analytics.orderChange}
          comparison={comparison}
        />
        <StatTile
          label={t('chartAverageOrder')}
          value={formatBDT(analytics.averageOrder)}
          count={{ value: analytics.averageOrder, format: formatBDT }}
          note={t('chartLast12Months')}
          trend={analytics.monthly.map((row) => (row.billableCount ? row.orderValue / row.billableCount : 0))}
          accent="var(--chart-cat-3)"
          change={analytics.averageOrderChange}
          comparison={comparison}
        />
        <StatTile
          label={t('chartDelivered')}
          value={orders.length ? `${((analytics.deliveredCount / orders.length) * 100).toFixed(1)}%` : '0%'}
          progress={orders.length ? (analytics.deliveredCount / orders.length) * 100 : 0}
          accent="var(--chart-positive)"
          note={t('chartDeliveredNote', { count: analytics.deliveredCount.toLocaleString(), total: orders.length.toLocaleString() })}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <ChartPanel
        className="lg:col-span-2"
        headingId="admin-trend-title"
        title={t('chartTrendTitle')}
        subtitle={t('chartTrendSubtitle', { measure: measureName.toLowerCase() })}
        actions={toggle}
        featured
      >
        {analytics.hasRecentOrders ? (
          <>
            <TrendAreaChart
              data={trendData}
              name={measureName}
              formatValue={formatTrendValue}
              ariaLabel={measure === 'orders' ? t('chartOrdersAria') : t('chartRevenueAria')}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-[var(--chart-axis)]">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-[var(--chart-primary)]" />
                {measureName}
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
                    {analytics.monthly.map((month) => (
                      <tr key={month.month} className="border-b border-[var(--chart-hair)]">
                        <th scope="row" className="p-2 font-medium">{month.month}</th>
                        <td className="p-2 tabular-nums">{month.orderCount.toLocaleString()}</td>
                        <td className="p-2 tabular-nums">{formatBDT(month.orderValue)}</td>
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

        <ChartPanel headingId="admin-payment-title" title={t('paymentMethodMix')} subtitle={t('howOrdersPaidFor')}>
          {analytics.paymentSlices.length > 0 ? (
            <ShareBreakdown
              slices={analytics.paymentSlices}
              centerValue={orders.length.toLocaleString()}
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartPanel headingId="admin-status-title" title={t('orderStatusMix')} subtitle={t('lifecycleDistribution')}>
          {analytics.statusSlices.length > 0 ? (
            <ShareBreakdown
              slices={analytics.statusSlices}
              centerValue={orders.length.toLocaleString()}
              centerLabel={t('chartOrders')}
              ariaLabel={t('chartStatusAria')}
              unit={t('chartOrdersUnit')}
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--chart-line)] text-center text-micro text-[var(--chart-axis)]">
              {t('noOrderStatusData')}
            </div>
          )}
        </ChartPanel>

        {children && <div className="min-w-0 lg:col-span-2">{children}</div>}
      </div>
    </section>
  );
};
