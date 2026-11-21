import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  /** Which bar is drawn in the brand colour when nothing is hovered: the newest period, or the biggest one. */
  highlight?: 'latest' | 'max';
}

/**
 * Bars for a handful of periods. The latest period is drawn in the brand colour and earlier ones in a quiet tint, so
 * the eye lands on "now"; hovering any bar brings it forward. Tops are rounded, the base stays on the axis.
 */
export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ data, name, formatValue, ariaLabel, height = 220, highlight = 'latest' }) => {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = React.useState<number | null>(null);
  const gradientId = `bar-${React.useId().replace(/:/g, '')}`;
  const rows = React.useMemo(() => data.map((datum) => ({ ...datum })), [data]);
  const focus = React.useMemo(() => {
    if (highlight === 'latest') return rows.length - 1;
    let best = -1;
    rows.forEach((row, index) => { if (row.value > 0 && (best < 0 || row.value > rows[best].value)) best = index; });
    return best;
  }, [rows, highlight]);
  const shown = hovered ?? focus;

  return (
    <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 6, bottom: 0, left: 0 }} onMouseLeave={() => setHovered(null)}>
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
            background={{ fill: 'var(--chart-track)', radius: 7 }}
            isAnimationActive={!reducedMotion}
            animationDuration={700}
            onMouseEnter={(_, index) => setHovered(index)}
          >
            {rows.map((row, index) => {
              const active = index === shown;
              return <Cell key={row.label} fill={active ? `url(#${gradientId})` : 'var(--chart-muted-bar)'} style={{ transition: 'fill 160ms ease' }} />;
            })}
            <LabelList
              dataKey="value"
              content={(props) => {
                const { x, y, width, index, value } = props as { x?: number; y?: number; width?: number; index?: number; value?: number };
                if (index !== shown || x === undefined || y === undefined || width === undefined || !value) return null;
                return (
                  <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--chart-ink)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatValue(value)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
