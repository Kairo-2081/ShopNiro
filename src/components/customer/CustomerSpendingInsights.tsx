import React from 'react';
import { formatBDT } from '../../lib/api';
import { useLocale } from '../../lib/i18n';
import { Order, OrderStatus } from '../../types';
import { ChartPanel } from '../charts/ChartPanel';
import { DonutChart, DonutSlice } from '../charts/DonutChart';
import { MonthlyBarChart } from '../charts/MonthlyBarChart';
import { StatTile } from '../charts/StatTile';
import { percentChange, sum } from '../charts/format';

interface CustomerSpendingInsightsProps {
  orders: Order[];
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  placed: 'var(--chart-cat-5)',
  processing: 'var(--chart-cat-1)',
  shipped: 'var(--chart-cat-2)',
  delivered: 'var(--chart-cat-6)',
  cancelled: 'var(--chart-cat-4)',
};

const orderValue = (order: Order) => Math.max(0, Number(order.Subtotal) || 0) + Math.max(0, Number(order.Shipping_Fee) || 0);
const counts = (order: Order) => order.Status !== 'cancelled' && order.Payment_Status !== 'refunded';

/**
 * A short summary above the order list: how much has been spent, how it was spread over the last six months and where
 * the orders are now. It only reads the customer's own orders, so there is nothing to fetch and nothing invented.
 */
export const CustomerSpendingInsights: React.FC<CustomerSpendingInsightsProps> = ({ orders }) => {
  const { t, locale } = useLocale();

  const summary = React.useMemo(() => {
    const now = new Date();
    const monthFormat = new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { month: 'short' });
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: monthFormat.format(date), value: 0, orders: 0 };
    });
    const byKey = new Map(months.map((month) => [month.key, month]));
    const statusCounts = new Map<OrderStatus, number>();
    let allTimeSpent = 0;

    orders.forEach((order) => {
      statusCounts.set(order.Status, (statusCounts.get(order.Status) || 0) + 1);
      if (!counts(order)) return;
      allTimeSpent += orderValue(order);
      const placed = new Date(order.Order_Placed_At);
      const month = Number.isNaN(placed.getTime()) ? undefined : byKey.get(`${placed.getFullYear()}-${placed.getMonth()}`);
      if (month) {
        month.value += orderValue(order);
        month.orders += 1;
      }
    });

    const slices: DonutSlice[] = (['delivered', 'shipped', 'processing', 'placed', 'cancelled'] as OrderStatus[])
      .map((status) => ({
        key: status,
        name: status === 'delivered' ? t('delivered') : status === 'shipped' ? t('shipped') : status === 'processing' ? t('processingOrder') : status === 'cancelled' ? t('cancelled') : t('orderRegistered'),
        value: statusCounts.get(status) || 0,
        color: STATUS_COLOR[status],
      }))
      .filter((slice) => slice.value > 0);

    const recent = months.slice(3);
    const earlier = months.slice(0, 3);
    return {
      months,
      slices,
      allTimeSpent,
      delivered: statusCounts.get('delivered') || 0,
      sixMonthSpent: sum(months.map((month) => month.value)),
      sixMonthOrders: sum(months.map((month) => month.orders)),
      change: percentChange(sum(recent.map((month) => month.value)), sum(earlier.map((month) => month.value))),
    };
  }, [orders, locale, t]);

  if (!orders.length) return null;

  const formatCount = (value: number) => Math.round(value).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD');

  return (
    <section aria-labelledby="customer-spending-title" className="space-y-4">
      <header>
        <h2 id="customer-spending-title" className="text-lg font-bold text-surface-900 dark:text-white">{t('spendInsightsTitle')}</h2>
        <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{t('spendInsightsSubtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label={t('spendTotalSpent')}
          value={formatBDT(summary.allTimeSpent)}
          count={{ value: summary.allTimeSpent, format: formatBDT }}
          note={t('spendAllTime')}
        />
        <StatTile
          label={t('spendLast6Months')}
          value={formatBDT(summary.sixMonthSpent)}
          count={{ value: summary.sixMonthSpent, format: formatBDT }}
          trend={summary.months.map((month) => month.value)}
          change={summary.change}
          comparison={t('chartVsPrevious3')}
        />
        <StatTile
          label={t('spendOrdersPlaced')}
          value={formatCount(orders.length)}
          count={{ value: orders.length, format: formatCount }}
          note={t('chartDeliveredNote', { count: formatCount(summary.delivered), total: formatCount(orders.length) })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <ChartPanel headingId="customer-spend-month-title" title={t('spendByMonthTitle')} subtitle={t('spendByMonthSubtitle')} className="lg:col-span-3">
          {summary.sixMonthSpent > 0 ? (
            <MonthlyBarChart
              data={summary.months.map((month) => ({ label: month.label, value: month.value }))}
              name={t('spendTotalSpent')}
              formatValue={formatBDT}
              ariaLabel={t('spendByMonthAria')}
            />
          ) : (
            <p className="py-12 text-center text-sm text-surface-500 dark:text-surface-400">{t('spendNoSpending')}</p>
          )}
        </ChartPanel>
        <ChartPanel headingId="customer-spend-status-title" title={t('spendStatusTitle')} subtitle={t('spendStatusSubtitle')} className="lg:col-span-2">
          <DonutChart
            slices={summary.slices}
            centerValue={formatCount(orders.length)}
            centerLabel={t('chartOrders')}
            ariaLabel={t('spendStatusAria')}
            unit={t('chartOrdersUnit')}
          />
        </ChartPanel>
      </div>
    </section>
  );
};
