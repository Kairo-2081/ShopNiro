import React from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { compactNumber } from './format';
import { useReducedMotion } from './useReducedMotion';

export interface TrendDatum {
  /** Short axis label, e.g. "Mar 26". */
  label: string;
  value: number;
}

interface TrendAreaChartProps {
  data: readonly TrendDatum[];
  /** Series name shown in the tooltip. */
  name: string;
  formatValue: (value: number) => string;
  /** Plain-language summary for assistive tech; the same numbers are in the table view next to the chart. */
  ariaLabel: string;
  height?: number;
}

/**
 * One measure over time: a smooth line with a soft fill, faint horizontal guides, a crosshair on hover and a marker
 * on the best point. One y-axis only, so the line can never be read against the wrong scale.
 */
export const TrendAreaChart: React.FC<TrendAreaChartProps> = ({ data, name, formatValue, ariaLabel, height = 280 }) => {
  const reducedMotion = useReducedMotion();
  const gradientId = `trend-${React.useId().replace(/:/g, '')}`;
  const rows = React.useMemo(() => data.map((datum) => ({ ...datum })), [data]);
  const peak = React.useMemo(() => {
    let best: TrendDatum | null = null;
    for (const datum of data) if (datum.value > 0 && (!best || datum.value > best.value)) best = datum;
    return best;
  }, [data]);

  return (
    <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 14, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <filter id={`${gradientId}-glow`} x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.36} />
              <stop offset="70%" stopColor="var(--chart-primary)" stopOpacity={0.06} />
              <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={4} tick={{ fill: 'var(--chart-axis)', fontSize: 13 }} />
          <YAxis tickLine={false} axisLine={false} width={40} tickCount={5} allowDecimals={false} tickFormatter={(value: number) => compactNumber(value)} tick={{ fill: 'var(--chart-axis)', fontSize: 13 }} />
          <Tooltip
            cursor={{ stroke: 'var(--chart-primary)', strokeWidth: 1, strokeDasharray: '3 4', strokeOpacity: 0.7 }}
            content={<ChartTooltip formatValue={(value) => formatValue(value)} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--chart-primary)"
            strokeWidth={2.5}
            style={{ filter: `url(#${gradientId}-glow)` }}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: 'var(--chart-primary)', stroke: 'var(--chart-ring)', strokeWidth: 2.5 }}
            isAnimationActive={!reducedMotion}
            animationDuration={800}
            animationEasing="ease-out"
          />
          {peak && <ReferenceDot x={peak.label} y={peak.value} r={4.5} fill="var(--chart-primary)" stroke="var(--chart-ring)" strokeWidth={2.5} ifOverflow="visible" />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
