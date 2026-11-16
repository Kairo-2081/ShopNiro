import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLocale } from '../../lib/i18n';

export const HowItWorks: React.FC<{ onOpenSellerSignup: () => void }> = ({ onOpenSellerSignup }) => {
  const { t } = useLocale();

  const howItWorksSteps = [
    { title: t('step1Title'), text: t('step1Desc'), tone: 'bg-brand-600' },
    { title: t('step2Title'), text: t('step2Desc'), tone: 'bg-teal-600' },
    { title: t('step3Title'), text: t('step3Desc'), tone: 'bg-warning-600' },
  ];

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="scroll-mt-24 py-12 md:py-20">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{t('simpleSteps')}</p>
        <h2 id="how-it-works-heading" className="mt-2 text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('howShopNiroWorks')}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {howItWorksSteps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white/75 dark:bg-[#10161e]/75 p-5 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-surface-900 dark:text-white ${step.tone}`}>
                {index + 1}
              </div>
              <span className="text-lg font-semibold text-surface-900 dark:text-white">{step.title}</span>
            </div>
            <p className="text-sm leading-relaxed text-surface-600 dark:text-surface-300">{step.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-white/80 to-brand-50/70 dark:from-[#111a1b] dark:to-[#1a1d15] px-5 py-4 text-center md:flex-row md:text-left">
        <p className="text-base text-surface-800 dark:text-surface-100">{t('sellerBandText')}</p>
        <button type="button" onClick={onOpenSellerSignup} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-surface-900 dark:text-white transition-colors hover:bg-brand-500 cursor-pointer">
          {t('applyAsSeller')}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};
