import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatPercent, trendOf } from './format';

interface DeltaChipProps {
  /** Percent change, or null when there is no earlier period to compare with (then nothing is drawn). */
  change: number | null;
  /** Short comparison, e.g. "vs previous 6 months". Read out by screen readers, shown on wide chips. */
  comparison: string;
  className?: string;
}

const TONE = {
  up: 'bg-[color-mix(in_srgb,var(--chart-positive)_14%,transparent)] text-[var(--chart-positive)]',
  down: 'bg-[color-mix(in_srgb,var(--chart-negative)_14%,transparent)] text-[var(--chart-negative)]',
  flat: 'bg-[var(--chart-track)] text-[var(--chart-axis)]',
} as const;

/** A small up/down pill. The arrow and the signed number carry the meaning; colour only reinforces it. */
export const DeltaChip: React.FC<DeltaChipProps> = ({ change, comparison, className = '' }) => {
  if (change === null) return null;
  const trend = trendOf(change);
  const Icon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const text = formatPercent(change);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-micro font-semibold tabular-nums ${TONE[trend]} ${className}`}
      title={`${text} ${comparison}`}
    >
      <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{`${trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'No change,'} ${text} ${comparison}`}</span>
    </span>
  );
};
