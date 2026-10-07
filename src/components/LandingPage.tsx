import React, { useState } from 'react';
import { UserRole, Customer, Seller, Admin } from '../types';
import { shopNiroLogo } from '../lib/branding';
import { OrbitGlobe } from './landing/OrbitGlobe';
import { MarketplaceClosing, MarketplaceStat } from './MarketplaceClosing';
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
  customers,
  sellers,
  stats,
  admin,
  dbStatus,
  onOpenLogin,
  onEnterAsGuest,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenRiderSignup,
  onOpenAdminSignup,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [activeNavTab, setActiveNavTab] = useState<'store' | 'orders' | 'vouchers' | 'hub'>('store');

  return (
    <div className="min-h-screen text-zinc-100 font-sans pb-28 transition-colors duration-200 selection:bg-[#80734f] selection:text-white">
      {/* Centered Mobile/Responsive Container matching the reference design */}
      <div className="max-w-md sm:max-w-xl md:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-3 md:pt-5 pb-8 md:pb-12 space-y-6 md:space-y-8">
        
        {/* 1. Header / Navbar */}
        <header className="flex items-center justify-between gap-3 md:gap-4 py-2.5 rounded-full md:rounded-2xl border border-[#d0c8a5]/15 bg-[#10100f]/75 backdrop-blur-xl px-3 sm:px-4 shadow-[0_12px_32px_rgba(6,6,4,0.24)]">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5">
            <img
              src={shopNiroLogo}
              alt="ShopNiro"
              className="w-10 h-10 rounded-full object-cover border border-sky-100 dark:border-zinc-700 shadow-md shadow-blue-600/20"
            />
            <div>
              <h1 className="font-display text-xl font-normal text-white leading-none">
                ShopNiro
              </h1>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="Main navigation">
            <button
              type="button"
              onClick={onEnterAsGuest}
              className="px-2 lg:px-4 py-2 rounded-full text-xs lg:text-sm font-semibold text-zinc-200 hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
            >
              Browse catalog
            </button>
            <button
              type="button"
              onClick={onOpenSellerSignup}
              className="px-2 lg:px-4 py-2 rounded-full text-xs lg:text-sm font-semibold text-zinc-200 hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
            >
              Sell on ShopNiro
            </button>
            {onOpenRiderSignup && (
              <button
                type="button"
                onClick={onOpenRiderSignup}
                className="px-2 lg:px-4 py-2 rounded-full text-xs lg:text-sm font-semibold text-emerald-200 hover:bg-emerald-400/10 hover:text-white transition-colors cursor-pointer"
              >
                Rider portal
              </button>
            )}
          </nav>

          {/* Right Controls: Filter Catalog & Profile Avatar */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle if available */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="w-9 h-9 rounded-full bg-[#161C24] border border-zinc-800 text-zinc-300 flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer md:hidden"
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
        <section className="w-full md:max-w-5xl md:mx-auto rounded-[28px] p-6 sm:p-8 md:px-12 md:py-12 shadow-[0_35px_90px_rgba(3,3,2,0.42)] border border-[#d0c8a5]/20 text-center space-y-4 md:space-y-5 relative overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(208,200,165,0.2),transparent_16%),radial-gradient(circle_at_50%_100%,rgba(119,119,90,0.48),transparent_36%),linear-gradient(135deg,#77775a_0%,#514c38_24%,#292820_52%,#11110f_100%)] hero-parallax">
          {/* Atmospheric background glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none hero-glow" />

          <h2 className="text-[2.1rem] sm:text-[3rem] md:text-[4.2rem] font-normal text-white leading-[0.92] tracking-[-0.04em] max-w-5xl mx-auto">
            Shop Smart. Ship Fast.
          </h2>

          {/* Subtitle tailored to ShopNiro Marketplace */}
          <p className="text-zinc-300 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Browse products from approved sellers, check current stock, and follow your orders from one place.
          </p>

          {/* 3D Interactive Marketplace Globe */}
          <div className="py-1 md:py-2 relative hero-orbit-wrap">
            <div className="floating-badge floating-badge-left">Shop products</div>
            <div className="floating-badge floating-badge-right">Seller approved</div>
            <OrbitGlobe />
          </div>

          {/* Hero CTA Buttons */}
          <div className="flex items-center justify-center gap-3 pt-1 max-w-xl mx-auto w-full">
            {/* Say Hello / Browse Button */}
            <button
              type="button"
              onClick={onEnterAsGuest}
              className="luxury-control flex-1 min-h-12 py-3 px-5 rounded-full premium-button text-white text-xs sm:text-sm shadow-[0_14px_30px_rgba(52,40,20,0.3)] cursor-pointer hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Explore Marketplace</span>
            </button>

            {/* Explore ↗ Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="luxury-control flex-1 min-h-12 py-3 px-5 rounded-full bg-white/7 hover:bg-white/12 text-zinc-100 border border-[#d0c8a5]/25 text-xs sm:text-sm shadow-[0_12px_25px_rgba(0,0,0,0.18)] cursor-pointer"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {onOpenRiderSignup && (
            <button
              type="button"
              onClick={onOpenRiderSignup}
              className="luxury-control mx-auto min-h-10 w-full max-w-xl justify-center rounded-full border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 sm:text-sm"
            >
              <Truck className="h-4 w-4" />
              <span>Delivery rider applications and sign-in</span>
            </button>
          )}

          <div className="brand-marquee mt-2 md:mt-3">
            <div className="brand-track">
              {[
                { name: 'ShopNiro', accent: 'bg-[#d0c8a5]/15 text-[#f7f3e6]' },
                { name: 'Approved Sellers', accent: 'bg-sky-500/10 text-sky-200' },
                { name: 'Order Updates', accent: 'bg-emerald-500/10 text-emerald-200' },
                { name: 'Secure Checkout', accent: 'bg-violet-500/10 text-violet-200' },
                { name: 'Customer Reviews', accent: 'bg-amber-500/10 text-amber-200' },
                { name: 'ShopNiro', accent: 'bg-[#d0c8a5]/15 text-[#f7f3e6]' },
                { name: 'Approved Sellers', accent: 'bg-sky-500/10 text-sky-200' },
                { name: 'Order Updates', accent: 'bg-emerald-500/10 text-emerald-200' },
                { name: 'Order Tracking', accent: 'bg-violet-500/10 text-violet-200' },
              ].map((item, index) => (
                <div key={`${item.name}-${index}`} className={`brand-chip ${item.accent}`}>
                  <img
                    src={shopNiroLogo}
                    alt="ShopNiro logo"
                    className="brand-logo logo-float"
                  />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Shopper, seller, and admin entry points */}
        <section className="space-y-4 pt-1 animate-fade-up">
          {/* Header Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              SHOPPERS · SELLERS · ADMINS
            </span>
          </div>

          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              ShopNiro marketplace
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              One place to shop, sell, and manage.
            </h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Browse products, manage a store, or review seller applications from the right account.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Portal Card 1: Customer Hub */}
          <div className="premium-card premium-card-dark product-tilt rounded-2xl p-5 lg:p-6 space-y-3 flex flex-col lg:min-h-[370px]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/40">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white leading-tight">
                    Shopping account
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Cart, orders, and delivery updates
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-blue-900/80 text-sky-300 text-[10px] font-semibold border border-blue-800/40">
                For shoppers
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Browse products from different sellers, add what you like to your cart, and check your order status in your account.
            </p>

            {/* Launch Customer Portal Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="luxury-control w-full py-3 px-4 rounded-xl premium-button text-white text-xs shadow-md cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Sign in to shop</span>
            </button>

            {/* Bottom link: Create Personal Account */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onOpenCustomerSignup || onOpenLogin}
                className="text-xs font-semibold text-zinc-400 hover:text-sky-300 transition-colors cursor-pointer"
              >
                New to ShopNiro? <strong className="text-sky-400 ml-1">Create an account</strong>
              </button>
            </div>
          </div>

          {/* Portal Card 2: Merchant Studio */}
          <div className="premium-card premium-card-dark rounded-2xl p-5 lg:p-6 space-y-3 flex flex-col lg:min-h-[370px]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/40">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white leading-tight">
                    Seller dashboard
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Products, stock, and customer orders
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 text-[10px] font-semibold border border-emerald-800/40">
                For sellers
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Add products, update stock, and keep customers up to date as you process their orders.
            </p>

            {/* Enter Merchant Studio Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="luxury-control w-full py-3 px-4 rounded-xl premium-button text-white text-xs shadow-md cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Seller sign in</span>
            </button>

            {/* Bottom link: Register as Brand Partner */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onOpenSellerSignup}
                className="text-xs font-semibold text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                Want to sell? <strong className="text-emerald-400 ml-1">Create a seller account</strong>
              </button>
            </div>
          </div>

          {/* Portal Card 3: Admin Governance */}
          <div className="premium-card premium-card-dark rounded-2xl p-5 lg:p-6 space-y-3 flex flex-col lg:min-h-[370px]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/40">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white leading-tight">
                    Admin tools
                  </h4>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Seller approvals and product categories
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-purple-900/80 text-purple-300 text-[10px] font-semibold border border-purple-800/40">
                For admins
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Review seller applications, manage product categories, and update listing status.
            </p>

            {/* Admin Access Button */}
            <button
              type="button"
              onClick={onOpenLogin}
              className="luxury-control w-full py-3 px-4 rounded-xl premium-button text-white text-xs shadow-md cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin sign in</span>
            </button>

            {/* Biometrics badge */}
            <div className="flex items-center justify-between text-[10px] pt-1 text-purple-300 font-medium">
              <span>For ShopNiro administrators</span>
              <span className="font-bold tracking-wider uppercase text-purple-400">ADMIN ACCOUNT REQUIRED</span>
            </div>
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
                Already have an account?
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-sky-400 group-hover:translate-x-0.5 transition-transform">
              <span>Sign in</span>
              <span>➔</span>
            </div>
          </div>
        </section>

        {/* What you can do on ShopNiro */}
        <section className="space-y-3 pt-2">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              On ShopNiro
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              The basics, all in one place
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Feature 1: Seller approval */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-950 text-sky-400 flex items-center justify-center shrink-0 border border-sky-900/50">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">
                  Seller approval
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 text-[10px] font-semibold border border-sky-800/40">
                  Reviewed before listing
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Seller accounts are reviewed before their products appear in the marketplace.
              </p>
            </div>
          </div>

          {/* Feature 2: Order tracking */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-950 text-purple-400 flex items-center justify-center shrink-0 border border-purple-900/50">
              <Compass className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">
                  Order tracking
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 text-[10px] font-semibold border border-purple-800/40">
                  Order updates
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Check your order status as it moves from processing to shipped and delivered.
              </p>
            </div>
          </div>

          {/* Feature 3: Order details */}
          <div className="p-4 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-950 text-orange-400 flex items-center justify-center shrink-0 border border-orange-900/50">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-white">
                  Order details
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-orange-950 text-orange-300 text-[10px] font-semibold border border-orange-800/40">
                  In your account
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Find your payment and delivery updates together, so it’s easier to keep track of a purchase.
              </p>
            </div>
          </div>
          </div>
        </section>

        {/* 7. EFFORTLESS FLOW: How ShopNiro works */}
        <section className="space-y-3 pt-2">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              Simple steps
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              How ShopNiro works
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Step 1 */}
          <div className="p-4 lg:p-5 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5 lg:min-h-40">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-blue-600/40">
              1
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Browse products
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Compare products, check prices and stock, then add your picks to the cart.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 lg:p-5 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5 lg:min-h-40">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-teal-600/40">
              2
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                The seller prepares your order
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                The seller updates your order as it’s processed and shipped. Tracking appears when it’s available.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 lg:p-5 rounded-2xl bg-[#12161D] border border-zinc-800 shadow-xl flex items-start gap-3.5 lg:min-h-40">
            <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-orange-600/40">
              3
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                Follow your delivery
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Check delivery updates in your account, then leave a review after your order arrives.
              </p>
            </div>
          </div>
          </div>
        </section>

        {/* Premium brand ribbon below the main landing flow */}
        <section className="space-y-3 pt-1 animate-fade-up">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold tracking-widest text-sky-400 uppercase block">
              ShopNiro features
            </span>
          </div>

          <div className="brand-marquee">
            <div className="brand-track">
              {[
                'Product listings', 'Seller approval', 'Order tracking', 'Customer reviews', 'Product listings', 'Seller approval', 'Order tracking', 'Customer reviews'
              ].map((brand, index) => (
                <div key={`${brand}-${index}`} className="brand-chip bg-white/5 text-zinc-200">
                  <span className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 inline-block shadow-[0_0_18px_rgba(96,165,250,0.7)]" />
                  <span>{brand}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Browse the current catalog */}
        <section className="rounded-3xl p-6 sm:p-7 bg-blue-600 text-white text-center space-y-3.5 shadow-2xl relative overflow-hidden animate-fade-up">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/25 text-white text-[11px] font-semibold tracking-wide">
            <Tag className="w-3 h-3 text-sky-200" />
            <span>ShopNiro marketplace</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Find something you’ll love.
          </h3>

          <p className="text-sky-100 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            Browse current listings from independent sellers. Product details, prices, and stock are shown before you order.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onEnterAsGuest}
              className="w-full py-3.5 px-6 rounded-full bg-white hover:bg-sky-50 text-blue-700 font-bold text-sm shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>Browse products</span>
              <span>➔</span>
            </button>
          </div>

          <p className="text-[11px] text-sky-200/90">
            See what’s available today.
          </p>
        </section>

        <MarketplaceClosing stats={stats} />
      </div>

      {/* 10. Bottom Mobile Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0C1014]/95 backdrop-blur-md border-t border-zinc-800/90 py-2.5 px-6 shadow-2xl md:hidden">
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
