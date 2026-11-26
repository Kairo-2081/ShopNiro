import React from 'react';
import { ChevronDown } from 'lucide-react';
import { PolicyLinks } from '../legal/PolicyLinks';
import { useLocale } from '../../lib/i18n';

export const LandingFaq: React.FC = () => {
  const { t } = useLocale();

  const faqItems = [
    { q: t('faqFreeQuestion'), a: t('faqFreeAnswer') },
    { q: t('faqHowPayQuestion'), a: t('faqHowPayAnswer') },
    { q: t('faqSellerGenuineQuestion'), a: t('faqSellerGenuineAnswer') },
    { q: t('faqDeliveryCodeQuestion'), a: t('faqDeliveryCodeAnswer') },
    { q: t('faqCancelReturnQuestion'), a: <><span>{t('faqCancelReturnAnswer')}</span> <PolicyLinks ids={['refunds', 'delivery']} className="font-semibold text-brand-300 underline" /></> },
    { q: t('faqBecomeSellerQuestion'), a: t('faqBecomeSellerAnswer') },
    { q: t('faqBecomeRiderQuestion'), a: t('faqBecomeRiderAnswer') },
    { q: t('faqDataSafeQuestion'), a: <><span>{t('faqDataSafeAnswer')}</span> <PolicyLinks ids={['privacy']} className="font-semibold text-brand-300 underline" /></> },
  ];

  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-24 py-12 md:py-20">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{t('faqEyebrow')}</p>
        <h2 id="faq-heading" className="mt-2 text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('faqHeading')}</h2>
      </div>

      <div className="space-y-3">
        {faqItems.map((item, index) => (
          <details key={item.q} open={index === 0} className="group rounded-2xl border border-surface-200 dark:border-surface-700 bg-white/75 dark:bg-[#10161e]/75 p-4 text-left">
            <summary className="flex cursor-pointer list-none [&::-webkit-details-marker]:hidden items-center justify-between gap-4 text-left text-base font-semibold text-surface-900 dark:text-white">
              <span>{item.q}</span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-700 transition-transform group-open:rotate-180 motion-reduce:transition-none dark:text-brand-300" />
            </summary>
            <div className="mt-3 border-t border-surface-200 pt-3 text-sm leading-relaxed text-surface-600 dark:border-surface-700 dark:text-surface-300">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
};
