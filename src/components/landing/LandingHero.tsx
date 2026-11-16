import React from 'react';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useLocale } from '../../lib/i18n';

const OrbitGlobe = React.lazy(() => import('./OrbitGlobe').then((module) => ({ default: module.OrbitGlobe })));

export const LandingHero: React.FC<{ onEnterAsGuest: () => void; onOpenSellerSignup: () => void }> = ({ onEnterAsGuest, onOpenSellerSignup }) => {
  const { t } = useLocale();

  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative overflow-hidden rounded-[28px] border border-[#d0c8a5]/20 bg-[radial-gradient(circle_at_50%_18%,rgba(208,200,165,0.2),transparent_16%),radial-gradient(circle_at_50%_100%,rgba(119,119,90,0.48),transparent_36%),linear-gradient(135deg,#77775a_0%,#514c38_24%,#292820_52%,#11110f_100%)] p-6 shadow-[0_35px_90px_rgba(3,3,2,0.42)] md:px-12 md:py-12">
      <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative z-10 min-w-0 text-left">
          <span className="inline-flex rounded-full border border-[#d0c8a5]/25 bg-white/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-100 md:text-[11px]">
            {t('bangladeshMarketplaceApprovedSellers')}
          </span>
          <h1 id="hero-heading" className="mt-4 max-w-xl text-4xl font-medium leading-[0.92] tracking-[-0.04em] text-white sm:text-5xl md:text-[4.2rem]">
            {t('shopSmartShipFast')}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-surface-300 md:text-base">
            {t('heroSubtitle')}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onEnterAsGuest} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(52,40,20,0.3)] transition-transform hover:-translate-y-0.5 hover:bg-brand-500 cursor-pointer">
              <ShoppingBag className="h-4 w-4" />
              {t('browseProducts')}
            </button>
            <button type="button" onClick={onOpenSellerSignup} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d0c8a5]/25 bg-white/8 px-5 py-3 text-sm font-semibold text-surface-100 transition-colors hover:bg-white/12 cursor-pointer">
              {t('startSelling')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 text-sm text-surface-200">{t('heroReassurance')}</p>
        </div>

        <div className="relative z-10 min-w-0">
          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -left-2 top-7 z-20 rounded-full border border-[#d0c8a5]/20 bg-[#141922]/80 px-3 py-1 text-[11px] font-semibold text-surface-100 shadow-xl backdrop-blur md:-left-6">{t('shopProducts')}</div>
            <div className="absolute -right-2 bottom-16 z-20 rounded-full border border-[#d0c8a5]/20 bg-[#141922]/80 px-3 py-1 text-[11px] font-semibold text-surface-100 shadow-xl backdrop-blur md:-right-6">{t('approvedSellers')}</div>
            <div className="flex justify-center rounded-[28px] border border-[#d0c8a5]/12 bg-[#0d1115]/40 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
              <React.Suspense fallback={<div aria-hidden="true" className="h-[284px] w-full max-w-[420px] md:h-[374px]" />}>
                <OrbitGlobe />
              </React.Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
