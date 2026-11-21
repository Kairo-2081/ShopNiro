import React from 'react';
import { DeltaChip } from './DeltaChip';
import { Sparkline } from './Sparkline';
import { CountUp } from '../motion/CountUp';

interface StatTileProps {
  label: string;
  /** The figure as text. Ignored when `count` is given. */
  value: string;
  /** Give the figure as a number to have it count up when it scrolls into view. */
  count?: { value: number; format: (value: number) => string };
  /** Small line under the number: the period, or what is excluded. */
  note?: string;
  /** Series for the line beside the number. Omit it for a tile that is just a figure. */
  trend?: readonly number[];
  /** Percent change against the previous period; null hides the chip. */
  change?: number | null;
  comparison?: string;
  /** CSS colour for the sparkline and the top accent. Defaults to the theme's gold. */
  accent?: string;
}

/** A headline figure with a change chip and a small trend line. Same structure in light and dark; only the tokens differ. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, count, note, trend, change = null, comparison = '', accent = 'var(--chart-primary)' }) => {
  const hasTrend = !!trend && trend.length > 1;
  return (
    <article className="chart-card group/tile relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-4 transition-[transform] duration-300 motion-safe:hover:-translate-y-0.5 sm:p-5">
      <span aria-hidden="true" className="absolute inset-x-5 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <p className="text-xs font-semibold text-[var(--chart-axis)]">{label}</p>
      <p className="mt-2 break-words font-display text-[1.75rem] font-normal tabular-nums leading-none tracking-tight text-[var(--chart-ink)] sm:text-[2rem]">
        {count ? <CountUp value={count.value} format={count.format} /> : value}
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <DeltaChip change={change} comparison={comparison} />
          {note && <p className="text-micro text-[var(--chart-axis)]">{note}</p>}
        </div>
        {hasTrend && <Sparkline values={trend} color={accent} className="w-full sm:w-28 sm:shrink-0" />}
      </div>
    </article>
  );
};
