import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { useLocale } from '../../lib/i18n';

export const PaymentStrip: React.FC = () => {
  const { t } = useLocale();

  return (
    <section id="payment-strip" aria-labelledby="payment-strip-title" className="scroll-mt-24 py-12 md:py-20">
      <h2 id="payment-strip-title" className="mb-6 text-center text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200 md:text-base">
        {t('payYourWayTitle')}
      </h2>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {[t('cashOnDelivery'), t('onlinePaymentText'), t('riderDelivery'), t('orderTracking'), t('deliveryCodeConfirmation'), t('productReviews')].map((item) => (
          <div key={item} className="inline-flex items-center gap-2 rounded-full border border-[#d0c8a5]/15 bg-white/70 dark:bg-[#11161d]/70 px-4 py-2 text-sm text-surface-700 dark:text-surface-200">
            <BadgeCheck className="h-4 w-4 text-brand-700 dark:text-brand-300" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
