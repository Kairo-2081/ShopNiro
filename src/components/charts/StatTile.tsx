import React from 'react';
import { DeltaChip } from './DeltaChip';
import { Sparkline } from './Sparkline';

interface StatTileProps {
  label: string;
  value: string;
  /** Small line under the number: the period, or what is excluded. */
  note?: string;
  /** Series for the line under the number. Omit it for a tile that is just a figure. */
  trend?: readonly number[];
  /** Percent change against the previous period; null hides the chip. */
  change?: number | null;
  comparison?: string;
}

/** A headline figure with an optional change chip and a small trend line, like the tiles at the top of a store dashboard. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, note, trend, change = null, comparison = '' }) => (
  <article className="flex min-w-0 flex-col rounded-2xl border border-surface-200 bg-white p-4 shadow-[0_1px_2px_rgba(21,21,16,0.04),0_14px_32px_rgba(74,62,38,0.06)] dark:border-white/10 dark:bg-[#12161D] dark:shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <p className="text-micro font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{label}</p>
      <DeltaChip change={change} comparison={comparison} />
    </div>
    <p className="mt-2 break-words text-xl font-extrabold tabular-nums leading-tight tracking-tight text-surface-900 dark:text-white sm:text-2xl">{value}</p>
    {note && <p className="mt-0.5 text-micro text-surface-500 dark:text-surface-400">{note}</p>}
    {trend && trend.length > 1 && <Sparkline values={trend} className="mt-3" />}
  </article>
);
