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
  /** Series for the line under the number. Omit it for a tile that is just a figure. */
  trend?: readonly number[];
  /** Percent change against the previous period; null hides the chip. */
  change?: number | null;
  comparison?: string;
}

/** A headline figure with an optional change chip and a small trend line, like the tiles at the top of a store dashboard. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, count, note, trend, change = null, comparison = '' }) => (
  <article className="group/tile flex min-w-0 flex-col rounded-2xl transition-[transform,box-shadow] duration-300 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(21,21,16,0.05),0_22px_44px_rgba(74,62,38,0.12)]  border border-surface-200 bg-white p-4 shadow-[0_1px_2px_rgba(21,21,16,0.04),0_14px_32px_rgba(74,62,38,0.06)] dark:border-white/10 dark:bg-[#12161D] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <p className="text-micro font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
      <DeltaChip change={change} comparison={comparison} />
    </div>
    <p className="mt-2 break-words text-xl font-extrabold tabular-nums leading-tight tracking-tight text-surface-900 dark:text-white sm:text-2xl">{count ? <CountUp value={count.value} format={count.format} /> : value}</p>
    {note && <p className="mt-0.5 text-micro text-surface-500 dark:text-surface-400">{note}</p>}
    {trend && trend.length > 1 && <Sparkline values={trend} className="mt-3" />}
  </article>
);
