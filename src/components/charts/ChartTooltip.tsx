import React from 'react';
import type { TooltipContentProps } from 'recharts';

interface ChartTooltipProps extends Partial<TooltipContentProps<number, string>> {
  /** Turns a series value into text, e.g. money for revenue, a plain count for orders. */
  formatValue: (value: number, name: string) => string;
  /** Replaces the raw axis label (for example a full month name instead of "Mar 26"). */
  formatLabel?: (label: string) => string;
}

/** The hover card shared by every chart: a clean panel that follows the light/dark theme. */
export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label, formatValue, formatLabel }) => {
  if (!active || !payload?.length) return null;
  const title = label === undefined ? undefined : formatLabel ? formatLabel(String(label)) : String(label);
  return (
    <div className="min-w-[9rem] rounded-xl border border-surface-200 bg-white/95 px-3 py-2.5 text-xs shadow-[0_12px_32px_rgba(21,21,16,0.16)] backdrop-blur-md dark:border-white/10 dark:bg-[#1b1b15]/95 dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
      {title && <p className="mb-1.5 font-semibold text-surface-900 dark:text-white">{title}</p>}
      <ul className="space-y-1">
        {payload.map((entry, index) => {
          const name = String(entry.name ?? entry.dataKey ?? '');
          const color = (entry.payload as { color?: string } | undefined)?.color ?? (typeof entry.color === 'string' ? entry.color : 'var(--chart-primary)');
          return (
            <li key={`${name}-${index}`} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-surface-600 dark:text-surface-300">{name}</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums text-surface-900 dark:text-white">{formatValue(Number(entry.value) || 0, name)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
