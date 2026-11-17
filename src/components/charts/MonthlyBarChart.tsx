import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { compactNumber } from './format';
import { useReducedMotion } from './useReducedMotion';

export interface BarDatum {
  label: string;
  value: number;
}

interface MonthlyBarChartProps {
  data: readonly BarDatum[];
  name: string;
  formatValue: (value: number) => string;
  ariaLabel: string;
  height?: number;
}

/**
 * Bars for a handful of periods. The latest period is drawn in the brand colour and earlier ones in a quiet tint, so
 * the eye lands on "now"; hovering any bar brings it forward. Tops are rounded, the base stays on the axis.
 */
export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ data, name, formatValue, ariaLabel, height = 220 }) => {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = React.useState<number | null>(null);
  const gradientId = `bar-${React.useId().replace(/:/g, '')}`;
  const rows = React.useMemo(() => data.map((datum) => ({ ...datum })), [data]);
  const latest = rows.length - 1;

  return (
    <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} onMouseLeave={() => setHovered(null)}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0.62} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} width={40} tickCount={4} allowDecimals={false} tickFormatter={(value: number) => compactNumber(value)} tick={{ fill: 'var(--chart-axis)', fontSize: 11 }} />
          <Tooltip cursor={false} content={<ChartTooltip formatValue={(value) => formatValue(value)} />} />
          <Bar
            dataKey="value"
            name={name}
            radius={[7, 7, 0, 0]}
            maxBarSize={34}
            isAnimationActive={!reducedMotion}
            animationDuration={700}
            onMouseEnter={(_, index) => setHovered(index)}
          >
            {rows.map((row, index) => {
              const active = hovered === null ? index === latest : index === hovered;
              return <Cell key={row.label} fill={active ? `url(#${gradientId})` : 'var(--chart-muted-bar)'} style={{ transition: 'fill 160ms ease' }} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
