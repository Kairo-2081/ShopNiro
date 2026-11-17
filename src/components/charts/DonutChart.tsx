import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { shareOf } from './format';
import { useReducedMotion } from './useReducedMotion';

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
  /** A CSS colour, normally one of the --chart-cat-N tokens so the slice follows the theme. */
  color: string;
}

interface DonutChartProps {
  slices: readonly DonutSlice[];
  /** Big number in the hole, usually the total. */
  centerValue: string;
  centerLabel: string;
  ariaLabel: string;
  /** What the value in each tooltip and legend row is called, e.g. "orders". */
  unit: string;
}

/**
 * Parts of a whole. Slices are separated by a gap in the card colour, and every slice is also named in the legend
 * with its share and count, so the chart never depends on telling colours apart.
 */
export const DonutChart: React.FC<DonutChartProps> = ({ slices, centerValue, centerLabel, ariaLabel, unit }) => {
  const reducedMotion = useReducedMotion();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const data = React.useMemo(() => slices.map((slice) => ({ ...slice })), [slices]);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div role="img" aria-label={ariaLabel} className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={slices.length > 1 ? 3 : 0}
              cornerRadius={6}
              startAngle={90}
              endAngle={-270}
              stroke="var(--chart-ring)"
              strokeWidth={2}
              isAnimationActive={!reducedMotion}
              animationDuration={800}
            >
              {data.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatValue={(value) => `${value.toLocaleString()} ${unit} · ${shareOf(value, total)}%`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold tabular-nums leading-none text-surface-900 dark:text-white">{centerValue}</span>
          <span className="mt-1 text-micro font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-3 text-xs">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="min-w-0 flex-1 truncate font-medium text-surface-800 dark:text-surface-100">{slice.name}</span>
            <span className="tabular-nums text-surface-500 dark:text-surface-400">{shareOf(slice.value, total)}%</span>
            <span className="w-10 text-right font-semibold tabular-nums text-surface-900 dark:text-white">{slice.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
