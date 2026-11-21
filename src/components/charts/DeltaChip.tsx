import React from 'react';
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
  const text = formatPercent(change);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${TONE[trend]} ${className}`}
      title={`${text} ${comparison}`}
    >
      <svg aria-hidden="true" viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0" fill="currentColor">
        {trend === 'up' ? <path d="M5 1.5 9 8.5H1z" /> : trend === 'down' ? <path d="M5 8.5 1 1.5h8z" /> : <rect x="1" y="4" width="8" height="2" rx="1" />}
      </svg>
      <span aria-hidden="true">{text.replace(/^[+-]/, '')}</span>
      <span className="sr-only">{`${trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'No change,'} ${text} ${comparison}`}</span>
    </span>
  );
};
