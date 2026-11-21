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
  /** CSS colour for the sparkline, the progress bar and the top accent. Defaults to the theme's gold. */
  accent?: string;
  /** A share from 0 to 100, drawn as a thin bar under the figure instead of a sparkline. */
  progress?: number;
  /** Small mark after the figure, for example a star next to a rating. */
  after?: React.ReactNode;
}

const CURRENCY = /^(BDT|৳)\s*/;

/**
 * Splits "BDT 6,591,000.50" into a small currency prefix and a big figure, and drops the paise from large amounts so
 * the headline stays short. "94.2%" keeps its percent sign as a small suffix.
 */
function present(text: string): { prefix: string; body: string; suffix: string } {
  const currency = text.match(CURRENCY);
  let body = currency ? text.slice(currency[0].length) : text;
  let suffix = '';
  if (body.endsWith('%')) {
    body = body.slice(0, -1);
    suffix = '%';
  }
  const numeric = Number(body.replace(/,/g, ''));
  if (currency && Number.isFinite(numeric) && Math.abs(numeric) >= 1000) body = body.replace(/\.\d+$/, '');
  return { prefix: currency ? currency[1] : '', body, suffix };
}

/** A headline figure with a change chip and a small trend line. Same structure in light and dark; only the tokens differ. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, count, note, trend, change = null, comparison = '', accent = 'var(--chart-primary)', progress, after }) => {
  const hasTrend = !!trend && trend.length > 1 && progress === undefined;
  // With a change to show, the comparison is the visible line under the chip ("vs October"); otherwise the plain note.
  const caption = change !== null && comparison ? comparison : note;
  const parts = present(count ? count.format(count.value) : value);
  return (
    <article className="chart-card group/tile relative flex min-w-0 flex-col overflow-hidden rounded-3xl p-5 transition-[transform] duration-300 motion-safe:hover:-translate-y-0.5 sm:p-6">
      <span aria-hidden="true" className="absolute inset-x-6 top-0 h-px opacity-80" style={{ background: `linear-gradient(90deg, ${accent}, transparent 85%)` }} />
      <p className="text-sm font-medium text-[var(--chart-axis)]">{label}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 break-words tabular-nums leading-none text-[var(--chart-ink)]">
        {parts.prefix && <span className="text-base font-medium text-[var(--chart-axis)]">{parts.prefix}</span>}
        <span className="text-[1.9rem] font-extrabold tracking-tight sm:text-[2.15rem]">
          {count ? <CountUp value={count.value} format={(n) => present(count.format(n)).body} /> : parts.body}
        </span>
        {parts.suffix && <span className="text-base font-medium text-[var(--chart-axis)]">{parts.suffix}</span>}
        {after}
      </p>
      {progress !== undefined && (
        <div aria-hidden="true" className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--chart-track)]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: accent }} />
        </div>
      )}
      <div className={`${progress !== undefined ? 'mt-3' : 'mt-3'} flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <DeltaChip change={change} comparison={comparison} />
          {caption && <p className="text-sm text-[var(--chart-axis)]">{caption}</p>}
        </div>
        {hasTrend && <Sparkline values={trend} color={accent} className="w-full sm:w-24 sm:shrink-0" />}
      </div>
    </article>
  );
};
