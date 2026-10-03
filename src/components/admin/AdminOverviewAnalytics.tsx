import React from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBDT } from '../../lib/api';
import { Order, OrderStatus } from '../../types';

interface AdminOverviewAnalyticsProps {
  orders: Order[];
}

interface MonthlyMetric {
  month: string;
  orderCount: number;
  orderValue: number;
}

const statusPresentation: Record<OrderStatus, { label: string; color: string }> = {
  placed: { label: 'Placed', color: '#0284c7' },
  processing: { label: 'Processing', color: '#d97706' },
  shipped: { label: 'Shipped', color: '#4f46e5' },
  delivered: { label: 'Delivered', color: '#059669' },
  cancelled: { label: 'Cancelled', color: '#e11d48' },
};

const compactValue = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
};

export const AdminOverviewAnalytics: React.FC<AdminOverviewAnalyticsProps> = ({ orders }) => {
  const { monthlyMetrics, statusMetrics, hasRecentOrders, trailingOrderCount, trailingOrderValue } = React.useMemo(() => {
    const now = new Date();
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const byMonth = new Map<string, MonthlyMetric>();
    const monthly: MonthlyMetric[] = [];

    for (let offset = 0; offset < 12; offset += 1) {
      const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + offset, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const metric = {
        month: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        orderCount: 0,
        orderValue: 0,
      };
      byMonth.set(key, metric);
      monthly.push(metric);
    }

    const counts = new Map<OrderStatus, number>();
    let recentCount = 0;

    orders.forEach((order) => {
      counts.set(order.Status, (counts.get(order.Status) || 0) + 1);
      const placedAt = new Date(order.Order_Placed_At);
      if (Number.isNaN(placedAt.getTime())) return;

      const month = byMonth.get(`${placedAt.getFullYear()}-${placedAt.getMonth()}`);
      if (!month) return;

      recentCount += 1;
      month.orderCount += 1;
      if (order.Status !== 'cancelled' && order.Payment_Status !== 'refunded') {
        month.orderValue += Math.max(0, Number(order.Subtotal) || 0) + Math.max(0, Number(order.Shipping_Fee) || 0);
      }
    });

    const statuses = (Object.keys(statusPresentation) as OrderStatus[])
      .map((status) => ({
        status,
        name: statusPresentation[status].label,
        value: counts.get(status) || 0,
        color: statusPresentation[status].color,
      }))
      .filter((status) => status.value > 0);

    return {
      monthlyMetrics: monthly,
      statusMetrics: statuses,
      hasRecentOrders: recentCount > 0,
      trailingOrderCount: recentCount,
      trailingOrderValue: monthly.reduce((sum, metric) => sum + metric.orderValue, 0),
    };
  }, [orders]);

  return (
    <section aria-labelledby="admin-overview-analytics-title" className="space-y-4">
      <header>
        <h2 id="admin-overview-analytics-title" className="text-lg font-bold text-slate-900 dark:text-white">
          Overall Platform Metrics
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Order activity for the past 12 months and the current order status mix.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,1fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#151B23] sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Orders &amp; order value</h3>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                Order value excludes cancelled and refunded orders.
              </p>
            </div>
            <div className="flex flex-col items-start gap-0.5 sm:items-end">
              <span className="whitespace-nowrap text-xl font-bold tabular-nums text-slate-900 dark:text-white">{formatBDT(trailingOrderValue)}</span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                {trailingOrderCount.toLocaleString()} orders · trailing 12 months
              </span>
            </div>
          </div>

          {hasRecentOrders ? (
            <div role="img" aria-label="Monthly order count and order value for the past 12 months" className="h-[280px] min-w-0 w-full overflow-hidden sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyMetrics} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
                  <CartesianGrid stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.3 }}
                    minTickGap={8}
                  />
                  <YAxis
                    yAxisId="orders"
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <YAxis
                    yAxisId="value"
                    orientation="right"
                    tickFormatter={(value: number) => compactValue(value)}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'Order value' ? formatBDT(Number(value)) : Number(value).toLocaleString(),
                      name,
                    ]}
                    contentStyle={{ borderRadius: 12, borderColor: '#334155', backgroundColor: '#151B23', color: '#f4f4f5', fontSize: 12 }}
                    labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar
                    yAxisId="orders"
                    dataKey="orderCount"
                    name="Orders"
                    fill="#0284c7"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                  <Line
                    yAxisId="value"
                    type="monotone"
                    dataKey="orderValue"
                    name="Order value"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-center text-xs text-slate-500 dark:text-zinc-400 sm:h-[320px]">
              No orders were placed in the past 12 months.
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#151B23] sm:p-5">
          <div className="mb-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order status mix</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">All orders, including cancelled.</p>
          </div>

          {statusMetrics.length > 0 ? (
            <>
              <div role="img" aria-label="Donut chart showing the number of orders by status" className="relative h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusMetrics}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {statusMetrics.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [Number(value).toLocaleString(), name]}
                      contentStyle={{ borderRadius: 12, borderColor: '#334155', backgroundColor: '#151B23', color: '#f4f4f5', fontSize: 12 }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{orders.length.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">total orders</span>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                {statusMetrics.map((status) => (
                  <li key={status.status} className="flex min-w-0 items-center justify-between gap-2 text-[11px]">
                    <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-zinc-300">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: status.color }} />
                      <span className="truncate">{status.name}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1.5">
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{status.value.toLocaleString()}</span>
                      <span className="text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">
                        {Math.round((status.value / orders.length) * 100)}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-center text-xs text-slate-500 dark:text-zinc-400">
              No order status data is available yet.
            </div>
          )}
        </section>
      </div>
    </section>
  );
};