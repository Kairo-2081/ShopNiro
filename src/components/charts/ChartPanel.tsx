import React from 'react';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  /** Right-hand side of the header: a toggle, a headline number, a filter. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingId?: string;
}

/** The card every chart sits in: quiet border, soft depth, theme-aware, one consistent header. */
export const ChartPanel: React.FC<ChartPanelProps> = ({ title, subtitle, actions, children, className = '', headingId }) => (
  <section
    aria-labelledby={headingId}
    className={`min-w-0 rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_1px_2px_rgba(21,21,16,0.04),0_18px_40px_rgba(74,62,38,0.07)] dark:border-white/10 dark:bg-[#12161D] dark:shadow-[0_24px_56px_rgba(0,0,0,0.32)] sm:p-6 ${className}`}
  >
    <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h3 id={headingId} className="text-sm font-bold text-surface-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-micro text-surface-500 dark:text-surface-400">{subtitle}</p>}
      </div>
      {actions}
    </header>
    {children}
  </section>
);
