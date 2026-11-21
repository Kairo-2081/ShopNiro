import React from 'react';
import { Customer, Seller, Admin } from '../types';
import type { MarketplaceStat } from './MarketplaceClosing';
import { LandingHeader } from './landing/LandingHeader';
import { LandingHero } from './landing/LandingHero';
import { FeatureBlocks } from './landing/FeatureBlocks';
import { TrustRow } from './landing/TrustRow';
import { LandingFaq } from './landing/LandingFaq';
import { ClosingCta } from './landing/ClosingCta';
import { LandingFooter } from './landing/LandingFooter';
import { PaymentStrip } from './landing/PaymentStrip';
import { SellersShowcase } from './landing/SellersShowcase';
import { HowItWorks } from './landing/HowItWorks';
import { ChartsShowcase } from './landing/ChartsShowcase';
import { Reveal } from './motion/Reveal';
import { MAIN_CONTENT_ID } from './SkipLink';

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
}

export const LandingPage: React.FC<LandingPageProps> = ({
  sellers,
  stats,
  onOpenLogin,
  onEnterAsGuest,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenRiderSignup,
}) => {
  return (
    <div className="min-h-screen text-surface-900 transition-colors duration-200 selection:bg-[#80734f] selection:text-white dark:text-surface-100">
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 md:px-8 md:pt-5">
        <LandingHeader onOpenLogin={onOpenLogin} onOpenSellerSignup={onOpenSellerSignup} />

        <LandingHero onEnterAsGuest={onEnterAsGuest} onOpenSellerSignup={onOpenSellerSignup} />

        <PaymentStrip />

        <Reveal><SellersShowcase sellers={sellers} onEnterAsGuest={onEnterAsGuest} /></Reveal>

        <Reveal><HowItWorks onOpenSellerSignup={onOpenSellerSignup} /></Reveal>

        <Reveal><FeatureBlocks /></Reveal>

        <Reveal><ChartsShowcase /></Reveal>

        <Reveal><TrustRow /></Reveal>

        <Reveal><LandingFaq /></Reveal>

        <Reveal><ClosingCta stats={stats} onEnterAsGuest={onEnterAsGuest} onOpenSellerSignup={onOpenSellerSignup} /></Reveal>
      </main>

      <LandingFooter onEnterAsGuest={onEnterAsGuest} onOpenLogin={onOpenLogin} onOpenCustomerSignup={onOpenCustomerSignup} onOpenSellerSignup={onOpenSellerSignup} onOpenRiderSignup={onOpenRiderSignup} />
    </div>
  );
};
