import React, { useMemo } from 'react';
import { Customer, Seller, Admin } from '../types';
import { shopNiroLogoSmall } from '../lib/branding';
import { MarketplaceClosing, MarketplaceStat } from './MarketplaceClosing';
import { ArrowRight, BadgeCheck, Check, ChevronDown, CreditCard, MapPinned, Moon, PackageCheck, ShieldCheck, ShoppingBag, Sun } from 'lucide-react';
import { useLocale } from '../lib/i18n';
import { MAIN_CONTENT_ID } from './SkipLink';
import { PolicyLinks } from './legal/PolicyLinks';
import { BUSINESS } from './legal/business';
import adminSellerReview from '../assets/landing/app-admin-seller-review.jpg';
import customerCheckout from '../assets/landing/app-customer-checkout.jpg';
import shipmentTracking from '../assets/landing/app-customer-orders-confirm.jpg';
import riderActive from '../assets/landing/app-rider-active.jpg';

const OrbitGlobe = React.lazy(() => import('./landing/OrbitGlobe').then((module) => ({ default: module.OrbitGlobe })));

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

export const LandingPage: React.FC<LandingPageProps> = ({
  sellers,
  stats,
  onOpenLogin,
  onEnterAsGuest,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenRiderSignup,
  onOpenAdminSignup,
  theme = 'dark',
  onToggleTheme,
}) => {
  const { t, locale } = useLocale();

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
  const navItems = [
    { href: '#features', label: t('featuresNav') },
    { href: '#how-it-works', label: t('howItWorksNav') },
    { href: '#sellers', label: t('sellersNav') },
    { href: '#faq', label: t('faqNav') },
  ];

  const howItWorksSteps = [
    { title: t('step1Title'), text: t('step1Desc'), tone: 'bg-brand-600' },
    { title: t('step2Title'), text: t('step2Desc'), tone: 'bg-teal-600' },
    { title: t('step3Title'), text: t('step3Desc'), tone: 'bg-warning-600' },
  ];

  return (
    <div className="min-h-screen text-surface-900 transition-colors duration-200 selection:bg-[#80734f] selection:text-white dark:text-surface-100">
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 md:px-8 md:pt-5">
        <header className="sticky top-0 z-30 mb-6 rounded-full border border-[#d0c8a5]/15 bg-white/80 dark:bg-[#10100f]/75 px-3 py-2 shadow-[0_12px_32px_rgba(6,6,4,0.24)] backdrop-blur-xl md:rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img src={shopNiroLogoSmall} alt="ShopNiro" className="h-10 w-10 rounded-full border border-brand-100 object-cover shadow-md shadow-brand-600/20 dark:border-surface-700" />
              <p className="font-display text-xl font-normal leading-none text-surface-900 dark:text-white">ShopNiro</p>
            </div>

            <nav className="hidden items-center gap-1 md:flex lg:gap-2" aria-label="Main navigation">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="rounded-full px-2 py-2 text-xs font-semibold text-surface-700 dark:text-surface-200 transition-colors hover:bg-black/5 hover:text-surface-900 dark:hover:bg-white/8 dark:hover:text-surface-900 dark:hover:text-white lg:px-4 lg:text-sm">
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={theme === 'dark' ? t('changeThemeToLight') : t('changeThemeToDark')}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-[#161C24] text-surface-600 dark:text-surface-300 transition-colors hover:bg-surface-800 cursor-pointer"
                  title={theme === 'dark' ? t('changeThemeToLight') : t('changeThemeToDark')}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4 text-warning-400" /> : <Moon className="h-4 w-4 text-brand-400" />}
                </button>
              )}
              <button
                type="button"
                onClick={onOpenLogin}
                aria-label={t('signInOrManageAccounts')}
                title={t('signInOrManageAccounts')}
                className="hidden rounded-full border border-[#d0c8a5]/25 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-semibold text-surface-800 dark:text-surface-100 transition-colors hover:bg-white/10 sm:inline-flex cursor-pointer"
              >
                {t('signIn')}
              </button>
              <button type="button" onClick={onOpenSellerSignup} className="rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-surface-900 dark:text-white shadow-[0_12px_25px_rgba(91,79,41,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-brand-500 cursor-pointer sm:text-sm">
                {t('startSelling')}
              </button>
            </div>
          </div>
        </header>

        <section id="hero" aria-labelledby="hero-heading" className="relative overflow-hidden rounded-[28px] border border-[#d0c8a5]/20 bg-[radial-gradient(circle_at_50%_18%,rgba(208,200,165,0.2),transparent_16%),radial-gradient(circle_at_50%_100%,rgba(119,119,90,0.48),transparent_36%),linear-gradient(135deg,#77775a_0%,#514c38_24%,#292820_52%,#11110f_100%)] p-6 shadow-[0_35px_90px_rgba(3,3,2,0.42)] md:px-12 md:py-12">
          <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10 text-left">
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

            <div className="relative z-10">
              <div className="relative mx-auto w-full max-w-[560px]">
                <div className="absolute -left-4 top-7 rounded-full border border-[#d0c8a5]/20 bg-[#141922]/80 px-3 py-1 text-[11px] font-semibold text-surface-100 shadow-xl backdrop-blur md:-left-8">{t('shopProducts')}</div>
                <div className="absolute -right-2 bottom-10 rounded-full border border-[#d0c8a5]/20 bg-[#141922]/80 px-3 py-1 text-[11px] font-semibold text-surface-100 shadow-xl backdrop-blur md:-right-8">{t('approvedSellers')}</div>
                <div className="flex justify-center rounded-[28px] border border-[#d0c8a5]/12 bg-[#0d1115]/40 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
                  <React.Suspense fallback={<div aria-hidden="true" className="h-[284px] w-full max-w-[420px] md:h-[374px]" />}>
                    <OrbitGlobe />
                  </React.Suspense>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="payment-strip" aria-labelledby="payment-strip-title" className="py-12 md:py-20">
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
          <section id="sellers" aria-labelledby="sellers-heading" className="py-12 md:py-20">
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
                  <img
                    src={seller.Logo || shopNiroLogoSmall}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-12 w-12 rounded-xl object-cover"
                    onError={(event) => {
                      const target = event.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.className = 'flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/20 text-sm font-bold text-brand-800 dark:text-brand-200';
                      fallback.textContent = seller.Name.charAt(0).toUpperCase();
                      target.parentElement?.appendChild(fallback);
                    }}
                  />
                  <span className="truncate text-sm font-semibold text-surface-900 dark:text-white">{seller.Name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section id="how-it-works" aria-labelledby="how-it-works-heading" className="py-12 md:py-20">
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

        <section id="features" aria-labelledby="features-heading" className="py-12 md:py-20">
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
                      width={1200}
                      height={800}
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

        <section id="faq" aria-labelledby="faq-heading" className="py-12 md:py-20">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{t('faqEyebrow')}</p>
            <h2 id="faq-heading" className="mt-2 text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('faqHeading')}</h2>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <details key={item.q} open={index === 0} className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-white/75 dark:bg-[#10161e]/75 p-4 text-left">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-surface-900 dark:text-white">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                </summary>
                <div className="mt-3 pt-3 text-sm leading-relaxed text-surface-600 dark:text-surface-300">{item.a}</div>
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
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerProduct')}</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li><button type="button" onClick={onEnterAsGuest} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('browseProducts')}</button></li>
              <li><a href="#how-it-works" className="hover:text-surface-900 dark:hover:text-white">{t('howItWorksNav')}</a></li>
              <li><a href="#faq" className="hover:text-surface-900 dark:hover:text-white">{t('faqNav')}</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerSellAndDeliver')}</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li><button type="button" onClick={onOpenSellerSignup} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('startSelling')}</button></li>
              {onOpenRiderSignup && (
                <li><button type="button" onClick={onOpenRiderSignup} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('becomeRider')}</button></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerAccount')}</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li><button type="button" onClick={onOpenLogin} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('signIn')}</button></li>
              <li><button type="button" onClick={onOpenCustomerSignup || onOpenLogin} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('createAnAccount')}</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerLegal')}</h3>
            <div className="mt-4 text-sm text-surface-600 dark:text-surface-300">
              <PolicyLinks ids={['terms', 'privacy', 'refunds', 'delivery']} className="text-brand-700 dark:text-brand-300 underline hover:text-brand-800 dark:hover:text-brand-200" />
            </div>
          </div>
        </div>
        <div className="border-t border-surface-200 dark:border-surface-800 text-center text-sm text-surface-500 dark:text-surface-400">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6 md:px-8">
            <p>© {currentYear} {BUSINESS.name}. {locale === 'bn' ? t('madeInBangladesh') : t('madeInBangladesh')}</p>
            {onOpenAdminSignup && (
              <button type="button" onClick={onOpenAdminSignup} className="text-xs text-surface-600 dark:text-surface-300 transition-colors hover:text-brand-800 dark:hover:text-brand-200 cursor-pointer">
                {t('adminSignIn')}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
