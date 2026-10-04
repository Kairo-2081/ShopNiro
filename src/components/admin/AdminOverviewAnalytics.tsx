import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
  Area,
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

const statusPresentation: Record<OrderStatus, { label: string; color: string; shade: string }> = {
  placed: { label: 'Placed', color: '#38bdf8', shade: '#0ea5e9' },
  processing: { label: 'Processing', color: '#f59e0b', shade: '#d97706' },
  shipped: { label: 'Shipped', color: '#8b5cf6', shade: '#7c3aed' },
  delivered: { label: 'Delivered', color: '#34d399', shade: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#fb7185', shade: '#f43f5e' },
};

const paymentPresentation: Record<string, { label: string; color: string; shade: string }> = {
  bkash: { label: 'bKash', color: '#f472b6', shade: '#ec4899' },
  nagad: { label: 'Nagad', color: '#2dd4bf', shade: '#14b8a6' },
  rocket: { label: 'Rocket', color: '#a78bfa', shade: '#8b5cf6' },
  visa_mastercard: { label: 'Cards', color: '#60a5fa', shade: '#3b82f6' },
  sslcommerz: { label: 'SSLCommerz', color: '#fbbf24', shade: '#f59e0b' },
  cash_on_delivery: { label: 'COD', color: '#4ade80', shade: '#22c55e' },
};

const compactValue = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
};

const AdminChartTooltip: React.FC<Partial<TooltipContentProps<number, string>>> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/20 bg-slate-900/85 p-3.5 shadow-2xl backdrop-blur-md text-xs text-white space-y-1.5 animate-in fade-in duration-150">
      <p className="font-bold text-slate-300 border-b border-white/10 pb-1">{label}</p>
      {payload.map((entry, index) => {
        const name = String(entry.name || entry.dataKey || 'Metric');
        const value = Number(entry.value) || 0;
        const color = typeof entry.color === 'string' ? entry.color : typeof entry.fill === 'string' ? entry.fill : '#94a3b8';
        return (
          <div key={`${name}-${index}`} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-slate-400 capitalize">{name}:</span>
            <span className="ml-auto font-semibold tabular-nums text-white">
              {name.toLowerCase().includes('value') ? formatBDT(value) : value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const AdminOverviewAnalytics: React.FC<AdminOverviewAnalyticsProps> = ({ orders }) => {
  const { monthlyMetrics, statusMetrics, paymentMetrics, hasRecentOrders, trailingOrderCount, trailingOrderValue } = React.useMemo(() => {
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
    const paymentCounts = new Map<string, number>();
    let recentCount = 0;

    orders.forEach((order) => {
      counts.set(order.Status, (counts.get(order.Status) || 0) + 1);

      const methodKey = String(order.Payment_Method || 'cash_on_delivery').toLowerCase();
      paymentCounts.set(methodKey, (paymentCounts.get(methodKey) || 0) + 1);

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
        shade: statusPresentation[status].shade,
      }))
      .filter((status) => status.value > 0);

    const payments = Array.from(paymentCounts.entries())
      .map(([method, value]) => ({
        method,
        name: paymentPresentation[method]?.label || method.replace(/_/g, ' '),
        value,
        color: paymentPresentation[method]?.color || '#64748b',
        shade: paymentPresentation[method]?.shade || '#475569',
      }))
      .sort((a, b) => b.value - a.value);

    return {
      monthlyMetrics: monthly,
      statusMetrics: statuses,
      paymentMetrics: payments,
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

      <div className="flex flex-col gap-5">
        <section className="w-full rounded-3xl border border-sky-100 dark:border-sky-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-sky-950/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.38)] transition-all duration-300 hover:shadow-[0_26px_70px_rgba(59,130,246,0.14)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">Monthly Orders &amp; Volume</h3>
              <p className="text-[11px] text-slate-300">Order revenue trends against completed order count</p>
            </div>
            <div className="text-right rounded-2xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 shadow-inner shadow-sky-500/10">
              <span className="text-lg font-black text-sky-300 block">{formatBDT(trailingOrderValue)}</span>
              <span className="text-[10px] text-slate-300 font-medium">
                {trailingOrderCount.toLocaleString()} total orders (12 mo)
              </span>
            </div>
          </div>

          {hasRecentOrders ? (
            <div role="img" aria-label="Monthly order count and order value for the past 12 months" className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyMetrics} margin={{ top: 8, right: 8, bottom: 4, left: -14 }}>
                  <defs>
                    <linearGradient id="barBlueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.95} />
                      <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.82} />
                      <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.26} />
                    </linearGradient>
                    <linearGradient id="areaAmberGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.45} />
                      <stop offset="50%" stopColor="#F59E0B" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#94a3b8" strokeDasharray="3 5" strokeOpacity={0.16} vertical={false} />
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
                  <Tooltip content={<AdminChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                  <Area
                    yAxisId="value"
                    type="monotone"
                    dataKey="orderValue"
                    name="Order Value"
                    stroke="#FBBF24"
                    strokeWidth={3}
                    fill="url(#areaAmberGradient)"
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#FBBF24' }}
                    animationDuration={900}
                  />
                  <Bar
                    yAxisId="orders"
                    dataKey="orderCount"
                    name="Orders"
                    fill="url(#barBlueGradient)"
                    radius={[7, 7, 0, 0]}
                    maxBarSize={22}
                    animationDuration={900}
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

        <section className="w-full min-w-0 rounded-2xl border border-sky-100 dark:border-sky-500/20 bg-white dark:bg-[#12161D] p-5 shadow-xs transition-all hover:shadow-md">
          <div className="mb-1">
            <h3 className="text-sm font-bold text-white">Order Status Mix</h3>
            <p className="mt-1 text-[11px] text-slate-300">Lifecycle distribution across all orders</p>
          </div>

          {statusMetrics.length > 0 ? (
            <>
              <div className="relative my-2 mx-auto h-[220px] w-full max-w-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusMetrics}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={4}
                      stroke="rgba(15, 23, 42, 0.75)"
                      strokeWidth={2}
                      isAnimationActive={true}
                      animationDuration={900}
                    >
                      {statusMetrics.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} stroke={entry.shade} strokeWidth={1} className="transition-all duration-300 hover:opacity-80" />
                      ))}
                    </Pie>
                    <Tooltip content={<AdminChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-white">{orders.length.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider">Orders</span>
                </div>
              </div>

              <ul className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-zinc-800/80 pt-3">
                {statusMetrics.map((status) => (
                  <li key={status.status} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-200 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_12px_rgba(255,255,255,0.25)]" style={{ backgroundColor: status.color }} />
                      <span className="truncate">{status.name}</span>
                    </span>
                    <span className="font-bold text-white ml-1">{status.value}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="my-2 flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-[11px] text-slate-500 dark:border-zinc-700 dark:bg-slate-900/40 dark:text-zinc-400">
              No order status data available yet.
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="w-full rounded-2xl border border-sky-100 dark:border-sky-500/20 bg-white dark:bg-[#12161D] p-5 shadow-xs transition-all hover:shadow-md">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-white">Revenue by Month</h3>
              <p className="mt-1 text-[11px] text-slate-300">Order value trend over the last 12 months</p>
            </div>
            <div className="h-[220px] w-full rounded-2xl bg-slate-950/20 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyMetrics} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#94a3b8" strokeDasharray="3 5" strokeOpacity={0.12} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#94a3b8', strokeOpacity: 0.3 }} />
                  <YAxis tickFormatter={(value: number) => compactValue(value)} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip content={<AdminChartTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                  <Bar
                    dataKey="orderValue"
                    name="Order Value"
                    fill="#60a5fa"
                    radius={[7, 7, 0, 0]}
                    maxBarSize={28}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="w-full min-w-0 rounded-2xl border border-sky-100 dark:border-sky-500/20 bg-white dark:bg-[#12161D] p-5 shadow-xs transition-all hover:shadow-md">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-white">Payment Method Mix</h3>
              <p className="mt-1 text-[11px] text-slate-300">How customer orders are being paid for</p>
            </div>

            {paymentMetrics.length > 0 ? (
              <>
                <div className="relative mx-auto h-[220px] w-full max-w-[290px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMetrics}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={3}
                        stroke="rgba(15, 23, 42, 0.75)"
                        strokeWidth={2}
                        isAnimationActive={true}
                        animationDuration={900}
                      >
                        {paymentMetrics.map((entry) => (
                          <Cell key={entry.method} fill={entry.color} stroke={entry.shade} strokeWidth={1} className="transition-all duration-300 hover:opacity-80" />
                        ))}
                      </Pie>
                      <Tooltip content={<AdminChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <ul className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-zinc-800/80 pt-3">
                  {paymentMetrics.map((method) => (
                    <li key={method.method} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-200 truncate">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-[0_0_12px_rgba(255,255,255,0.25)]" style={{ backgroundColor: method.color }} />
                        <span className="truncate">{method.name}</span>
                      </span>
                      <span className="ml-1 font-bold text-white">{method.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-[11px] text-slate-500 dark:border-zinc-700 dark:bg-slate-900/40 dark:text-zinc-400">
                No payment data yet.
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
};