import React from 'react';
import { CreditCard, MapPinned, PackageCheck, ShieldCheck } from 'lucide-react';
import { PolicyLinks } from '../legal/PolicyLinks';
import { useLocale } from '../../lib/i18n';

export const TrustRow: React.FC = () => {
  const { t } = useLocale();

  const shopCardData = [
    { icon: CreditCard, title: t('trustPayYourWay'), text: t('trustPayYourWayCopy') },
    { icon: PackageCheck, title: t('trustServerSideTotals'), text: t('trustServerSideTotalsCopy') },
    { icon: MapPinned, title: t('trustDeliveryCode'), text: t('trustDeliveryCodeCopy') },
    { icon: ShieldCheck, title: t('trustYourData'), text: <><span>{t('trustYourDataCopy')}</span> <PolicyLinks ids={['privacy']} className="font-semibold text-brand-300 underline" /></> },
  ];

  return (
    <section aria-labelledby="trust-title" className="py-12 md:py-20">
      <h2 id="trust-title" className="mb-8 text-center text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('trustTitle')}</h2>
      <div className="grid gap-4 md:grid-cols-4">
        {shopCardData.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white/75 dark:bg-[#10161e]/75 p-4 text-center shadow-lg">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/10 text-brand-700 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-surface-600 dark:text-surface-300">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
