import React from 'react';
import { Check } from 'lucide-react';
import adminSellerReviewDark from '../../assets/landing/app-admin-seller-review.jpg';
import adminSellerReviewLight from '../../assets/landing/app-admin-seller-review-light.jpg';
import customerCheckoutDark from '../../assets/landing/app-customer-checkout.jpg';
import customerCheckoutLight from '../../assets/landing/app-customer-checkout-light.jpg';
import shipmentTrackingDark from '../../assets/landing/app-customer-orders-confirm.jpg';
import shipmentTrackingLight from '../../assets/landing/app-customer-orders-confirm-light.jpg';
import riderActiveDark from '../../assets/landing/app-rider-active.jpg';
import riderActiveLight from '../../assets/landing/app-rider-active-light.jpg';
import { useLocale } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

// Each screenshot exists once per theme, so the page never shows a dark app inside a light page or the reverse.
const screenshots = {
  adminSellerReview: { light: adminSellerReviewLight, dark: adminSellerReviewDark },
  customerCheckout: { light: customerCheckoutLight, dark: customerCheckoutDark },
  shipmentTracking: { light: shipmentTrackingLight, dark: shipmentTrackingDark },
  riderActive: { light: riderActiveLight, dark: riderActiveDark },
} as const;

export const FeatureBlocks: React.FC = () => {
  const { t } = useLocale();
  const { theme } = useTheme();

  const featureBlocks = [
    {
      eyebrow: t('approvedSellersOnlyEyebrow'),
      title: t('approvedSellersOnlyTitle'),
      description: t('approvedSellersOnlyCopy'),
      bullets: [t('approvedSellersOnlyBullet1'), t('approvedSellersOnlyBullet2'), t('approvedSellersOnlyBullet3')],
      image: screenshots.adminSellerReview,
      alt: t('approvedSellersOnlyAlt'),
      caption: t('screensShowSampleData'),
      flip: false,
    },
    {
      eyebrow: t('checkoutClearEyebrow'),
      title: t('checkoutClearTitle'),
      description: t('checkoutClearCopy'),
      bullets: [t('checkoutClearBullet1'), t('checkoutClearBullet2'), t('checkoutClearBullet3')],
      image: screenshots.customerCheckout,
      alt: t('checkoutClearAlt'),
      flip: true,
    },
    {
      eyebrow: t('trackingEyebrow'),
      title: t('trackingTitle'),
      description: t('trackingCopy'),
      bullets: [t('trackingBullet1'), t('trackingBullet2'), t('trackingBullet3')],
      image: screenshots.shipmentTracking,
      imageHeight: 630,
      alt: t('trackingAlt'),
      flip: false,
    },
    {
      eyebrow: t('deliveryCodeEyebrow'),
      title: t('deliveryCodeTitle'),
      description: t('deliveryCodeCopy'),
      bullets: [t('deliveryCodeBullet1'), t('deliveryCodeBullet2'), t('deliveryCodeBullet3')],
      image: screenshots.riderActive,
      alt: t('deliveryCodeAlt'),
      flip: true,
    },
  ];

  return (
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
                  src={feature.image[theme]}
                  alt={feature.alt}
                  width={1440}
                  height={feature.imageHeight ?? 900}
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
  );
};
