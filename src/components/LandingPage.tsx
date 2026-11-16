import React, { useMemo } from 'react';
import { Customer, Seller, Admin } from '../types';
import { MarketplaceClosing, MarketplaceStat } from './MarketplaceClosing';
import { ArrowRight, BadgeCheck, Check, ChevronDown, CreditCard, MapPinned, PackageCheck, ShieldCheck } from 'lucide-react';
import { LandingHeader } from './landing/LandingHeader';
import { LandingHero } from './landing/LandingHero';
import { useLocale } from '../lib/i18n';
import { MAIN_CONTENT_ID } from './SkipLink';
import { PolicyLinks } from './legal/PolicyLinks';
import { BUSINESS } from './legal/business';
import adminSellerReview from '../assets/landing/app-admin-seller-review.jpg';
import customerCheckout from '../assets/landing/app-customer-checkout.jpg';
import shipmentTracking from '../assets/landing/app-customer-orders-confirm.jpg';
import riderActive from '../assets/landing/app-rider-active.jpg';

interface LandingPageProps {
  customers: Customer[];
  sellers: Seller[];
  stats: MarketplaceStat[];
  admin: Admin;
  admins?: Admin[];
  dbStatus: { connected: boolean; provider: string; database: string };
  onOpenLogin: () => void;
  onEnterAsGuest: () => void;
  onOpenCustomerSignup?: () => void;
  onOpenSellerSignup: () => void;
  onOpenRiderSignup?: () => void;
  onOpenAdminSignup?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

// A seller's logo, or the first letter of their name when the picture is missing or fails to load.
const SellerLogo: React.FC<{ logo?: string; name: string }> = ({ logo, name }) => {
  const [failed, setFailed] = React.useState(false);
  if (!logo || failed) {
    return (
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-sm font-bold text-brand-800 dark:text-brand-200">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img src={logo} alt="" loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl object-cover" onError={() => setFailed(true)} />;
};

export const LandingPage: React.FC<LandingPageProps> = ({
  sellers,
  stats,
  onOpenLogin,
  onEnterAsGuest,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenRiderSignup,
  theme = 'dark',
  onToggleTheme,
}) => {
  const { t } = useLocale();

  const approvedSellers = useMemo(
    () =>
      sellers
        .filter((seller) => seller.Status === 'approved')
        .sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' }))
        .slice(0, 8),
    [sellers],
  );

  const featureBlocks = [
    {
      eyebrow: t('approvedSellersOnlyEyebrow'),
      title: t('approvedSellersOnlyTitle'),
      description: t('approvedSellersOnlyCopy'),
      bullets: [t('approvedSellersOnlyBullet1'), t('approvedSellersOnlyBullet2'), t('approvedSellersOnlyBullet3')],
      image: adminSellerReview,
      alt: t('approvedSellersOnlyAlt'),
      caption: t('screensShowSampleData'),
      flip: false,
    },
    {
      eyebrow: t('checkoutClearEyebrow'),
      title: t('checkoutClearTitle'),
      description: t('checkoutClearCopy'),
      bullets: [t('checkoutClearBullet1'), t('checkoutClearBullet2'), t('checkoutClearBullet3')],
      image: customerCheckout,
      alt: t('checkoutClearAlt'),
      flip: true,
    },
    {
      eyebrow: t('trackingEyebrow'),
      title: t('trackingTitle'),
      description: t('trackingCopy'),
      bullets: [t('trackingBullet1'), t('trackingBullet2'), t('trackingBullet3')],
      image: shipmentTracking,
      alt: t('trackingAlt'),
      flip: false,
    },
    {
      eyebrow: t('deliveryCodeEyebrow'),
      title: t('deliveryCodeTitle'),
      description: t('deliveryCodeCopy'),
      bullets: [t('deliveryCodeBullet1'), t('deliveryCodeBullet2'), t('deliveryCodeBullet3')],
      image: riderActive,
      alt: t('deliveryCodeAlt'),
      flip: true,
    },
  ];

  const shopCardData = [
    { icon: CreditCard, title: t('trustPayYourWay'), text: t('trustPayYourWayCopy') },
    { icon: PackageCheck, title: t('trustServerSideTotals'), text: t('trustServerSideTotalsCopy') },
    { icon: MapPinned, title: t('trustDeliveryCode'), text: t('trustDeliveryCodeCopy') },
    { icon: ShieldCheck, title: t('trustYourData'), text: <><span>{t('trustYourDataCopy')}</span> <PolicyLinks ids={['privacy']} className="font-semibold text-brand-300 underline" /></> },
  ];

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

  const currentYear = new Date().getFullYear();

  const howItWorksSteps = [
    { title: t('step1Title'), text: t('step1Desc'), tone: 'bg-brand-600' },
    { title: t('step2Title'), text: t('step2Desc'), tone: 'bg-teal-600' },
    { title: t('step3Title'), text: t('step3Desc'), tone: 'bg-warning-600' },
  ];

  return (
    <div className="min-h-screen text-surface-900 transition-colors duration-200 selection:bg-[#80734f] selection:text-white dark:text-surface-100">
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 md:px-8 md:pt-5">
        <LandingHeader theme={theme} onToggleTheme={onToggleTheme} onOpenLogin={onOpenLogin} onOpenSellerSignup={onOpenSellerSignup} />

        <LandingHero onEnterAsGuest={onEnterAsGuest} onOpenSellerSignup={onOpenSellerSignup} />

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

        {approvedSellers.length >= 3 && (
          <section id="sellers" aria-labelledby="sellers-heading" className="scroll-mt-24 py-12 md:py-20">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{t('sellersSectionEyebrow')}</p>
              <h2 id="sellers-heading" className="mt-2 text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('sellersAlreadyOnShopNiro')}</h2>
              <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{t('sellersReviewedBeforeListing')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {approvedSellers.map((seller) => (
                <button
                  key={seller.Seller_ID}
                  type="button"
                  onClick={onEnterAsGuest}
                  className="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white/75 dark:bg-[#10161e]/75 p-4 text-left transition-colors hover:border-brand-500/60 hover:bg-white dark:hover:bg-[#121b26] cursor-pointer"
                >
                  <SellerLogo logo={seller.Logo} name={seller.Name} />
                  <span className="truncate text-sm font-semibold text-surface-900 dark:text-white">{seller.Name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

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

        <section id="features" aria-labelledby="features-heading" className="scroll-mt-24 py-12 md:py-20">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{t('featuresHeadingEyebrow')}</p>
            <h2 id="features-heading" className="mt-2 text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('featuresHeading')}</h2>
          </div>

          <div className="space-y-8">
            {featureBlocks.map((feature) => (
              <article key={feature.title} className="grid gap-6 lg:grid-cols-2 lg:items-center">
                <div className={feature.flip ? 'lg:order-2' : ''}>
                  <div className="mb-3 inline-flex rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{feature.eyebrow}</div>
                  <h3 className="text-2xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-3xl">{feature.title}</h3>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-surface-600 dark:text-surface-300">{feature.description}</p>
                  <ul className="mt-5 space-y-3">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-sm text-surface-800 dark:text-surface-100">
                        <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600/20 text-brand-800 dark:text-brand-200">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={feature.flip ? 'lg:order-1' : ''}>
                  <div className="overflow-hidden rounded-[24px] border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-[#0e1218] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff6a6a]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#f6c65b]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#56d66d]" />
                    </div>
                    <img
                      src={feature.image}
                      alt={feature.alt}
                      width={1440}
                      height={1000}
                      loading="lazy"
                      decoding="async"
                      className="h-auto w-full rounded-xl border border-surface-200 dark:border-surface-700 object-cover"
                    />
                  </div>
                  {feature.caption && <p className="mt-3 text-center text-xs text-surface-500 dark:text-surface-400">{feature.caption}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>

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
      </main>

      <footer className="border-t border-surface-200 dark:border-surface-800 bg-white/60 dark:bg-[#0a0d12] text-surface-600 dark:text-surface-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerProduct')}</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><button type="button" onClick={onEnterAsGuest} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('browseProducts')}</button></li>
              <li><a href="#how-it-works" className="hover:text-surface-900 dark:hover:text-white">{t('howItWorksNav')}</a></li>
              <li><a href="#faq" className="hover:text-surface-900 dark:hover:text-white">{t('faqNav')}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerSellAndDeliver')}</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><button type="button" onClick={onOpenSellerSignup} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('startSelling')}</button></li>
              {onOpenRiderSignup && (
                <li><button type="button" onClick={onOpenRiderSignup} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('becomeRider')}</button></li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerAccount')}</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><button type="button" onClick={onOpenLogin} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('signIn')}</button></li>
              <li><button type="button" onClick={onOpenCustomerSignup || onOpenLogin} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('createAnAccount')}</button></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerLegal')}</p>
            <div className="mt-4 text-sm text-surface-600 dark:text-surface-300">
              <PolicyLinks ids={['terms', 'privacy', 'refunds', 'delivery']} className="text-brand-700 dark:text-brand-300 underline hover:text-brand-800 dark:hover:text-brand-200" />
            </div>
          </div>
        </div>
        <div className="border-t border-surface-200 dark:border-surface-800 text-center text-sm text-surface-500 dark:text-surface-400">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6 md:px-8">
            <p>© {currentYear} {BUSINESS.name}. {t('madeInBangladesh')}</p>
            <button type="button" onClick={onOpenLogin} className="cursor-pointer text-xs text-surface-600 transition-colors hover:text-brand-800 dark:text-surface-300 dark:hover:text-brand-200">
                {t('adminSignIn')}
              </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
