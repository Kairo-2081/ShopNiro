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
    <div className="min-w-[9rem] rounded-xl border border-[var(--chart-tip-line)] bg-[var(--chart-tip-bg)] px-3 py-2.5 text-xs shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur-md">
      {title && <p className="mb-1.5 font-semibold text-[var(--chart-ink)]">{title}</p>}
      <ul className="space-y-1">
        {payload.map((entry, index) => {
          const name = String(entry.name ?? entry.dataKey ?? '');
          const color = (entry.payload as { color?: string } | undefined)?.color ?? (typeof entry.color === 'string' ? entry.color : 'var(--chart-primary)');
          return (
            <li key={`${name}-${index}`} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[var(--chart-axis)]">{name}</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums text-[var(--chart-ink)]">{formatValue(Number(entry.value) || 0, name)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
