import React from 'react';

interface SectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headingAs?: 'h2' | 'h3';
  headingClassName?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  action,
  children,
  className = 'space-y-4',
  headingAs: Heading = 'h2',
  headingClassName = 'text-lg font-bold text-slate-900 dark:text-white',
}) => {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className={className}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading id={headingId} className={headingClassName}>{title}</Heading>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
};