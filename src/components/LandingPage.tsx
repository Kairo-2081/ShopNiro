import React, { useState } from 'react';
import { UserRole, Customer, Seller, Admin } from '../types';
import { shopNiroLogo } from '../lib/branding';
import { OrbitGlobe } from './landing/OrbitGlobe';
import {
  ShoppingBag,
  SlidersHorizontal,
  User,
  Search,
  ScanLine,
  Zap,
  Leaf,
  Truck,
  ArrowRight,
  Sparkles,
  Users,
  Store,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Clock,
  Compass,
  Star,
  Tag,
  Radio,
  Package,
  Layers,
  Plus,
  Hand,
  Check,
  Sun,
  Moon,
  Ticket,
  ChevronRight,
  Shield,
  Box,
  BadgeCheck,
  ShoppingBag as CartIcon,
  Heart,
} from 'lucide-react';

interface LandingPageProps {
  customers: Customer[];
  sellers: Seller[];
  admin: Admin;
  admins?: Admin[];
  dbStatus: { connected: boolean; provider: string; database: string };
  onOpenLogin: () => void;
  onEnterAsGuest: () => void;
  onOpenCustomerSignup?: () => void;
  onOpenSellerSignup: () => void;
  onOpenAdminSignup?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  customers,
  sellers,
  admin,
  dbStatus,
  onOpenLogin,
  onEnterAsGuest,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenAdminSignup,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [hasWaved, setHasWaved] = useState<boolean>(false);
  const [activeNavTab, setActiveNavTab] = useState<'store' | 'orders' | 'vouchers' | 'hub'>('store');

  const handleWave = () => {
    setHasWaved(true);
    setTimeout(() => setHasWaved(false), 3000);
  };

  return (
    <div className="min-h-screen text-zinc-100 font-sans pb-28 transition-colors duration-200 selection:bg-[#80734f] selection:text-white">
      {/* Centered Mobile/Responsive Container matching the reference design */}
      <div className="max-w-md sm:max-w-xl mx-auto px-4 pt-3 pb-8 space-y-6">
        
        {/* 1. Header / Navbar */}
        <header className="flex items-center justify-between py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-3 shadow-[0_10px_35px_rgba(7,18,18,0.25)]">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <img
              src={shopNiroLogo}
              alt="ShopNiro"
              className="w-10 h-10 rounded-full object-cover border border-sky-100 dark:border-zinc-700 shadow-md shadow-blue-600/20"
            />
            <div>
              <h1 className="text-xl font-black tracking-tight text-white leading-none">
                ShopNiro
              </h1>
              <span className="text-[10px] font-bold text-sky-400 tracking-[0.2em] uppercase block">
                MARKETPLACE
              </span>
            </div>
          </div>

          {/* Right Controls: Filter Catalog & Profile Avatar */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle if available */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-9 h-9 rounded-full bg-[#161C24] border border-zinc-800 text-zinc-300 flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
              </button>
            )}

            {/* Filter / Sliders Button */}
            <button
              type="button"
              onClick={onEnterAsGuest}
              className="w-9 h-9 rounded-full bg-[#161C24] border border-zinc-800 text-zinc-300 flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
              title="Filter Catalog"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* User Profile Avatar (launches login modal) */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-10 h-10 rounded-full bg-[linear-gradient(135deg,#d0c8a5,#a99b72,#77775a)] text-white flex items-center justify-center shadow-[0_10px_25px_rgba(86,80,57,0.35)] hover:brightness-110 transition-all cursor-pointer"
              title="Sign In / Accounts"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 2. Hero Section */}
        <section className="rounded-[32px] p-6 sm:p-7 shadow-[0_35px_90px_rgba(3,3,2,0.42)] border border-[#d0c8a5]/20 text-center space-y-4 relative overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(208,200,165,0.2),transparent_16%),radial-gradient(circle_at_50%_100%,rgba(119,119,90,0.48),transparent_36%),linear-gradient(135deg,#77775a_0%,#514c38_24%,#292820_52%,#11110f_100%)]">
          {/* Atmospheric background glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />

          {/* Pill Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#24241d]/80 border border-[#d0c8a5]/35 text-[#e7e5d6] text-xs font-semibold tracking-wide shadow-[0_8px_20px_rgba(169,155,114,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d0c8a5] animate-pulse"></span>
            <span>VERIFIED MERCHANTS &amp; DIRECT CHECKOUT</span>
          </div>

          {/* Hero Headline */}
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-[1.18]">
            Curated goods. Delivered{' '}
            <span className="italic font-serif font-normal text-sky-400">
              with care.
            </span>
          </h2>

          {/* Subtitle Tailored to GoCart Marketplace */}
          <p className="text-zinc-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            Discover verified independent merchants, direct checkout, real-time inventory, and guaranteed buyer protection from storefront to your doorstep.
          </p>

          {/* 3D Interactive Marketplace Globe */}
          <div className="py-1">
            <OrbitGlobe onGreet={() => setHasWaved(true)} />
          </div>

          {/* Hero CTA Buttons */}
          <div className="flex items-center justify-center gap-3 pt-1">
            {/* Say Hello / Browse Button */}
            <button
              type="button"
              onClick={() => {
                setHasWaved(true);
                onEnterAsGuest();
              }}
              className="flex-1 py-3 px-5 rounded-full premium-button hover:brightness-110 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_14px_30px_rgba(235,127,45,0.38)] transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Explore Marketplace</span>
            </button>

            {/* Explore ↗ Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex-1 py-3 px-5 rounded-full bg-white/7 hover:bg-white/12 text-zinc-100 border border-[#d0c8a5]/20 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-[0_12px_25px_rgba(0,0,0,0.18)] transition-all cursor-pointer"
            >
              <span>Sign In</span>
              <span className="text-xs">➔</span>
            </button>
          </div>
        </section>

        {/* 3. Unified Commerce & Delivery Engine: Three Dedicated Portals */}
        <section className="space-y-4 pt-1">
          {/* Header Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              MULTI-VENDOR ARCHITECTURE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-950/60 border border-sky-800/60 text-sky-300 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              RAW SQL COMMERCE ENGINE · ACTIVE
            </span>
          </div>

          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              UNIFIED COMMERCE &amp; MARKETPLACE ENGINE
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              One Marketplace. Three Dedicated Portals.
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Engineered micro-interfaces designed specifically for everyday shoppers, verified merchants, and platform governance.
            </p>
          </div>

          {/* Portal Card 1: Customer Hub */}
          <div className="rounded-3xl p-5 bg-[#0F1E32] border border-blue-900/60 shadow-xl space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/40">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white leading-tight">
                    Customer Hub
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Direct checkout, cart &amp; live order tracking
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-blue-900/80 text-sky-300 text-[10px] font-semibold border border-blue-800/40">
                Shoppers &amp; Buyers
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Browse curated vendor catalogs, manage your shopping cart, apply promotional discount vouchers (<code className="text-sky-300 font-mono">SAVE20</code>, <code className="text-sky-300 font-mono">TECH10</code>), and track your packages with full buyer protection.
            </p>

            {/* Launch Customer Portal Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/40 transition-all cursor-pointer"
            >
              <span>➔ Launch Customer Portal ➔</span>
            </button>

            {/* Bottom link: Create Personal Account */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onOpenCustomerSignup || onOpenLogin}
                className="text-xs font-semibold text-zinc-400 hover:text-sky-300 transition-colors cursor-pointer"
              >
                New to GoCart? <strong className="text-sky-400 ml-1">+ Create Customer Account</strong>
              </button>
            </div>
          </div>

          {/* Portal Card 2: Merchant Studio */}
          <div className="rounded-3xl p-5 bg-[#0E251E] border border-emerald-900/60 shadow-xl space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/40">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white leading-tight">
                    Merchant Studio
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Inventory control, batch pricing &amp; order dispatch
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 text-[10px] font-semibold border border-emerald-800/40">
                Seller Operations
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              List products across verified categories, manage real-time inventory thresholds, fulfill customer orders with instant tracking IDs, and monitor store earnings.
            </p>

            {/* Enter Merchant Studio Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/40 transition-all cursor-pointer"
            >
              <span>🏪 Enter Merchant Studio ➔</span>
            </button>

            {/* Bottom link: Register as Brand Partner */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onOpenSellerSignup}
                className="text-xs font-semibold text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                Sell on GoCart? <strong className="text-emerald-400 ml-1">+ Register as Verified Merchant</strong>
              </button>
            </div>
          </div>

          {/* Portal Card 3: Admin Governance */}
          <div className="rounded-3xl p-5 bg-[#1F172E] border border-purple-900/60 shadow-xl space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/40">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white leading-tight">
                    Admin Governance
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Vendor auditing, catalog taxonomy &amp; dispute guard
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-purple-900/80 text-purple-300 text-[10px] font-semibold border border-purple-800/40">
                Marketplace Ops
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Review and approve new vendor onboarding, moderate catalog taxonomy, oversee platform promotional vouchers, and audit raw SQL database performance.
            </p>

            {/* Admin Access Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-600/40 transition-all cursor-pointer"
            >
              <span>🛡️ Admin Access &amp; Platform Guard 🔒</span>
            </button>

            {/* Biometrics badge */}
            <div className="flex items-center justify-between text-[10px] pt-1 text-purple-300 font-medium">
              <span>Secured via Role Permissions</span>
              <span className="font-bold tracking-wider uppercase text-purple-400">ROLE VERIFICATION REQUIRED</span>
            </div>
          </div>

          {/* Universal Unified Sign-In Banner */}
          <div
            onClick={onOpenLogin}
            className="p-3.5 rounded-2xl bg-[#12161D] border border-zinc-800 flex items-center justify-between hover:border-blue-500 transition-colors shadow-2xs cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-zinc-200">
                Universal Unified Sign-In
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-sky-400 group-hover:translate-x-0.5 transition-transform">
              <span>Sign in with credentials</span>
              <span>➔</span>
            </div>
          </div>
        </section>

        {/* 5. ENGINEERED FOR DELIGHT: Our marketplace powers */}
        <section className="space-y-3 pt-2">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              ENGINEERED FOR DELIGHT
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              Our marketplace powers
            </h3>
          </div>

          {/* Feature 1: Verified Merchant Quality */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-950 text-sky-400 flex items-center justify-center shrink-0 border border-sky-900/50">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">
                  Verified Merchant Quality
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 text-[10px] font-semibold border border-sky-800/40">
                  Zero Counterfeit
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Every independent vendor undergoes strict identity auditing and catalog review by Admin officers prior to listing products.
              </p>
            </div>
          </div>

          {/* Feature 2: Live Order Telemetry */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-950 text-purple-400 flex items-center justify-center shrink-0 border border-purple-900/50">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">
                  Live Planetary Route
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 text-[10px] font-semibold border border-purple-800/40">
                  Sub-meter GPS
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Zero guessing games. Watch your courier navigate streets with real-time 3D telemetry, tracking IDs, and doorstep alerts.
              </p>
            </div>
          </div>

          {/* Feature 3: Guaranteed Buyer Protection */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-950 text-orange-400 flex items-center justify-center shrink-0 border border-orange-900/50">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">
                  Guaranteed Buyer Protection
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-orange-950 text-orange-300 text-[10px] font-semibold border border-orange-800/40">
                  30-Day Money Back
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Secure checkout with funds held safely until contactless delivery is confirmed. Hassle-free dispute resolution and returns.
              </p>
            </div>
          </div>
        </section>

        {/* 6. LIVE NETWORK PULSE: Always moving forward */}
        <section className="bg-[#12161D] rounded-3xl p-5 shadow-xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
                LIVE MARKETPLACE PULSE
              </span>
              <h3 className="text-lg font-black text-white tracking-tight">
                Always moving forward
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-950/90 text-sky-300 text-[10px] font-bold border border-sky-800/50">
              ● SQL ENGINE OPTIMAL
            </span>
          </div>

          {/* 3 Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center py-1">
            <div className="p-2.5 rounded-2xl bg-[#161C24] border border-zinc-800">
              <div className="text-xl sm:text-2xl font-black text-sky-400">
                99.4%
              </div>
              <div className="text-[11px] font-medium text-zinc-400 mt-0.5">
                Punctual
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#161C24] border border-zinc-800">
              <div className="text-xl sm:text-2xl font-black text-sky-400">
                120k+
              </div>
              <div className="text-[11px] font-medium text-zinc-400 mt-0.5">
                Orders Delivered
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#161C24] border border-zinc-800">
              <div className="text-xl sm:text-2xl font-black text-sky-400">
                &lt;18m
              </div>
              <div className="text-[11px] font-medium text-zinc-400 mt-0.5">
                Avg Dispatch
              </div>
            </div>
          </div>

          {/* Active Merchant Dispatch: Apex Audio Lab */}
          <div className="p-3 rounded-2xl bg-[#0F1D2B] border border-blue-900/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                alt="Merchant Avatar"
                className="w-10 h-10 rounded-full object-cover border-2 border-zinc-800 shadow-xs"
              />
              <div>
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Apex Audio Lab (Vendor #1)</span>
                  <span className="text-amber-400 flex items-center gap-0.5 text-[11px]">
                    ★ 4.98
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Dispatched Sony WH-1000XM5 near Hudson Sq
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleWave}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                hasWaved
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-blue-600/30 hover:bg-blue-600/50 text-sky-300 border border-blue-500/40'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>{hasWaved ? 'Waved! ✋' : 'Wave ✋'}</span>
            </button>
          </div>
        </section>

        {/* 7. EFFORTLESS FLOW: How GoCart glides (Matching User Screenshot 3) */}
        <section className="space-y-3 pt-2">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              EFFORTLESS FLOW
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              How GoCart glides
            </h3>
          </div>

          {/* Step 1 */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-blue-600/40">
              1
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Discover &amp; Apply Vouchers
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Browse verified products across electronics, fashion, and home goods. Apply discount vouchers (<code className="text-sky-300">SAVE20</code>, <code className="text-sky-300">TECH10</code>) at direct checkout.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-teal-600/40">
              2
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Merchant Prepares &amp; Ships
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Independent merchants pack your items with thermal pods and issue instant waybill tracking numbers for verified dispatch.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-orange-600/40">
              3
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Delightful Safe Arrival
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Receive high-resolution photo proof upon delivery, unbox with peace of mind, and leave verified customer reviews.
              </p>
            </div>
          </div>
        </section>

        {/* 8. STORIES: Kind words from shoppers & merchants (Matching User Screenshot 2) */}
        <section className="space-y-3 pt-2">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              STORIES
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              Kind words from sender &amp; receiver
            </h3>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
            {/* Review Card 1 */}
            <div className="min-w-[280px] sm:min-w-[320px] p-4 rounded-3xl bg-[#12161D] border border-zinc-800 shadow-xl flex flex-col justify-between space-y-3 snap-center">
              <div className="space-y-2">
                <div className="flex text-amber-400 gap-0.5 text-xs">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
                <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                  "GoCart transformed our artisan bakery shipments. Zero crushed sourdough loaves, ever."
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                <img
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80"
                  alt="Elena Rostova"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="font-bold text-xs text-white">
                    Elena Rostova
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Founder, Hearth &amp; Crumb
                  </div>
                </div>
              </div>
            </div>

            {/* Review Card 2 */}
            <div className="min-w-[280px] sm:min-w-[320px] p-4 rounded-3xl bg-[#12161D] border border-zinc-800 shadow-xl flex flex-col justify-between space-y-3 snap-center">
              <div className="space-y-2">
                <div className="flex text-amber-400 gap-0.5 text-xs">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
                <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                  "The real-time sub-meter tracking and gentle handling makes luxury vintage drops effortless. Best courier network."
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
                  alt="Marcus Vance"
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <div className="font-bold text-xs text-white">
                    Marcus Vance
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Creative Director, Atelier Vance
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. SPECIAL INVITATION Banner Card (Matching User Screenshot 2) */}
        <section className="rounded-3xl p-6 sm:p-7 bg-blue-600 text-white text-center space-y-3.5 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/25 text-white text-[11px] font-semibold tracking-wide">
            <Tag className="w-3 h-3 text-sky-200" />
            <span>SPECIAL INVITATION • CODE: SAVE20</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Send your first parcel today.
          </h3>

          <p className="text-sky-100 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            Get 20% off your first 3 orders across audio, gadgets &amp; apparel. Transparent pricing, zero hidden fees, infinite peace of mind.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onEnterAsGuest}
              className="w-full py-3.5 px-6 rounded-full bg-white hover:bg-sky-50 text-blue-700 font-bold text-sm shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>Explore Catalog &amp; Shop</span>
              <span>➔</span>
            </button>
          </div>

          <p className="text-[11px] text-sky-200/90">
            No subscription or membership contract required
          </p>
        </section>
      </div>

      {/* 10. Bottom Mobile Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0C1014]/95 backdrop-blur-md border-t border-zinc-800/90 py-2.5 px-6 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between relative">
          {/* Store / Radar */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab('store');
              onEnterAsGuest();
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeNavTab === 'store'
                ? 'text-sky-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Radio className="w-5 h-5" />
            <span className="text-[10px]">Radar</span>
          </button>

          {/* Parcels */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab('orders');
              onEnterAsGuest();
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeNavTab === 'orders'
                ? 'text-sky-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px]">Parcels</span>
          </button>

          {/* Elevated Action Button in Center (+) */}
          <button
            type="button"
            onClick={onEnterAsGuest}
            className="w-12 h-12 -mt-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/50 hover:bg-blue-500 transition-all cursor-pointer transform hover:scale-105"
            title="Browse Catalog & Shop"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Routes */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab('vouchers');
              onEnterAsGuest();
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeNavTab === 'vouchers'
                ? 'text-sky-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px]">Routes</span>
          </button>

          {/* Hub */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab('hub');
              onOpenLogin();
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeNavTab === 'hub'
                ? 'text-sky-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px]">Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
};
