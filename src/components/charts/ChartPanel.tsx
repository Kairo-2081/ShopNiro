import React from 'react';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  /** Right-hand side of the header: a toggle, a headline number, a filter. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingId?: string;
  /** Gold hairline and a faint glow, for the one chart on a page that carries the story. */
  featured?: boolean;
}

/** The card every chart sits in. Surface, line and shadow come from the chart tokens, so light and dark share one structure. */
export const ChartPanel: React.FC<ChartPanelProps> = ({ title, subtitle, actions, children, className = '', headingId, featured = false }) => (
  <section aria-labelledby={headingId} className={`chart-card ${featured ? 'chart-card-featured' : ''} min-w-0 rounded-3xl p-5 sm:p-7 ${className}`}>
    <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h3 id={headingId} className="font-display text-xl font-normal leading-tight text-[var(--chart-ink)]">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-[var(--chart-axis)]">{subtitle}</p>}
      </div>
      {actions}
    </header>
    {children}
  </section>
);
