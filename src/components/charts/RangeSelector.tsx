import React from 'react';
import { useLocale } from '../../lib/i18n';

export type RangeMonths = 3 | 6 | 12;

export const RANGE_OPTIONS: readonly RangeMonths[] = [3, 6, 12];

interface RangeSelectorProps {
  value: RangeMonths;
  onChange: (value: RangeMonths) => void;
  className?: string;
}

/** The 3, 6 or 12 month switch at the top of a dashboard. One choice at a time, shown as pressed buttons. */
export const RangeSelector: React.FC<RangeSelectorProps> = ({ value, onChange, className = '' }) => {
  const { t } = useLocale();
  return (
    <div role="group" aria-label={t('rangeGroup')} className={`inline-flex shrink-0 rounded-full border border-[var(--chart-line)] bg-[var(--chart-track)] p-1 text-sm font-medium ${className}`}>
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`min-h-9 rounded-full px-4 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chart-primary)] ${
            value === option
              ? 'bg-[var(--chart-card)] text-[var(--chart-ink)] shadow-[0_1px_0_var(--chart-hair)_inset,0_2px_10px_rgba(0,0,0,0.18)] ring-1 ring-[var(--chart-line)]'
              : 'text-[var(--chart-axis)] hover:text-[var(--chart-ink)]'
          }`}
        >
          {t('rangeMonths', { count: option })}
        </button>
      ))}
    </div>
  );
};
