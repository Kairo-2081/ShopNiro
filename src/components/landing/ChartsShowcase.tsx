import React from 'react';
import { useLocale } from '../../lib/i18n';

type View = 'seller' | 'admin' | 'customer';

const VIEWS: Array<{ id: View; width: number; height: number }> = [
  { id: 'seller', width: 1150, height: 1300 },
  { id: 'admin', width: 1150, height: 1240 },
  { id: 'customer', width: 1150, height: 630 },
];

/**
 * Real screenshots of the dashboards, taken on invented sample data, one tab per role. Each tab has a light and a dark
 * picture and the page's own theme decides which one shows. Images load lazily and have fixed sizes, so the section
 * never shifts the page or costs anything until it is near the screen.
 */
export const ChartsShowcase: React.FC = () => {
  const { t } = useLocale();
  const [active, setActive] = React.useState<View>('seller');
  const labels: Record<View, { tab: string; caption: string; alt: string }> = {
    seller: { tab: t('landingChartsTabSeller'), caption: t('landingChartsCaptionSeller'), alt: t('landingChartsAltSeller') },
    admin: { tab: t('landingChartsTabAdmin'), caption: t('landingChartsCaptionAdmin'), alt: t('landingChartsAltAdmin') },
    customer: { tab: t('landingChartsTabCustomer'), caption: t('landingChartsCaptionCustomer'), alt: t('landingChartsAltCustomer') },
  };
  const current = VIEWS.find((view) => view.id === active) ?? VIEWS[0];

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = VIEWS.findIndex((view) => view.id === active);
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = VIEWS[(next + VIEWS.length) % VIEWS.length].id;
    setActive(target);
    document.getElementById(`charts-tab-${target}`)?.focus();
  };

  return (
    <section id="charts" aria-labelledby="charts-heading" className="scroll-mt-24 py-12 md:py-20">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h2 id="charts-heading" className="text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('landingChartsTitle')}</h2>
        <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{t('landingChartsSubtitle')}</p>
      </div>

      <div role="tablist" aria-label={t('landingChartsTablist')} className="mx-auto mb-6 flex w-fit max-w-full gap-1 rounded-full border border-surface-200 bg-white/70 p-1 dark:border-surface-700 dark:bg-white/5">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            id={`charts-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={active === view.id}
            aria-controls={`charts-panel-${view.id}`}
            tabIndex={active === view.id ? 0 : -1}
            onClick={() => setActive(view.id)}
            onKeyDown={onKeyDown}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
              active === view.id
                ? 'bg-[#80734f] text-white dark:bg-brand-300 dark:text-brand-950'
                : 'text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-white'
            }`}
          >
            {labels[view.id].tab}
          </button>
        ))}
      </div>

      <figure id={`charts-panel-${current.id}`} role="tabpanel" aria-labelledby={`charts-tab-${current.id}`} className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_24px_60px_-30px_rgba(60,50,20,0.35)] dark:border-white/10 dark:bg-[#12121a] dark:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]">
          <img
            key={`${current.id}-light`}
            src={`/landing/charts-${current.id}-light.webp`}
            alt={labels[current.id].alt}
            width={current.width}
            height={current.height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full dark:hidden"
          />
          <img
            key={`${current.id}-dark`}
            src={`/landing/charts-${current.id}-dark.webp`}
            alt={labels[current.id].alt}
            width={current.width}
            height={current.height}
            loading="lazy"
            decoding="async"
            className="hidden h-auto w-full dark:block"
          />
        </div>
        <figcaption className="mt-3 text-center text-xs text-surface-600 dark:text-surface-300">
          {labels[current.id].caption} <span className="font-semibold">{t('landingChartsSample')}</span>
        </figcaption>
      </figure>
    </section>
  );
};
