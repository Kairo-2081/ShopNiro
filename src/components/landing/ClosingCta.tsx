import React from 'react';
import { MarketplaceClosing, MarketplaceStat } from '../MarketplaceClosing';
import { useLocale } from '../../lib/i18n';

export const ClosingCta: React.FC<{ stats: MarketplaceStat[]; onEnterAsGuest: () => void; onOpenSellerSignup: () => void }> = ({ stats, onEnterAsGuest, onOpenSellerSignup }) => {
  const { t } = useLocale();

  return (
    <section aria-labelledby="closing-cta-heading" className="py-12 md:py-20">
      <div className="rounded-[28px] bg-brand-800 px-6 py-8 text-center shadow-2xl md:px-10 md:py-10">
        <h2 id="closing-cta-heading" className="text-3xl font-medium tracking-[-0.04em] text-white md:text-4xl">{t('closingCtaHeading')}</h2>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={onEnterAsGuest} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50 cursor-pointer">
            {t('browseProducts')}
          </button>
          <button type="button" onClick={onOpenSellerSignup} className="rounded-full border border-white/25 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/8 cursor-pointer">
            {t('startSelling')}
          </button>
        </div>
        <p className="mt-4 text-sm text-brand-100">{t('closingCtaNote')}</p>
      </div>
      <div className="mt-8">
        <MarketplaceClosing stats={stats} />
      </div>
    </section>
  );
};
