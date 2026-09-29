import React from 'react';
import { UserRole, Customer, Seller, Admin, AppTab } from '../types';
import { shopNiroLogo } from '../lib/branding';
import {
  ShoppingBag,
  ShoppingCart,
  PackageCheck,
  User,
  Store,
  ShieldCheck,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Sparkles,
  Radio,
  Flame,
} from 'lucide-react';

interface NavbarProps {
  isLoggedIn: boolean;
  currentRole: UserRole;
  currentCustomer: Customer | null;
  currentSeller: Seller | null;
  admin: Admin | null;
  activeTab: AppTab;
  setActiveTab: React.Dispatch<React.SetStateAction<AppTab>>;
  cartCount: number;
  onOpenCart: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenChat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isLoggedIn,
  currentRole,
  currentCustomer,
  currentSeller,
  admin,
  activeTab,
  setActiveTab,
  cartCount,
  onOpenCart,
  onOpenLogin,
  onLogout,
  theme = 'dark',
  onToggleTheme,
  onOpenChat,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#171713]/85 dark:bg-[#10100f]/80 backdrop-blur-xl border-b border-[#d0c8a5]/15 dark:border-white/10 shadow-[0_12px_32px_rgba(6,6,4,0.25)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand matching Landing Page */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('storefront')}>
            <img
              src={shopNiroLogo}
              alt="ShopNiro"
              className="w-10 h-10 rounded-full object-cover border border-[#d0c8a5]/50 shadow-[0_8px_20px_rgba(169,155,114,0.24)]"
            />
            <div>
              <span className="text-xl font-black tracking-tight text-[#0f1f1d] dark:text-white leading-none block">
                ShopNiro
              </span>
              <span className="text-[10px] font-bold text-[#77775a] dark:text-[#d0c8a5] tracking-[0.2em] uppercase block">
                MARKETPLACE
              </span>
            </div>
          </div>

          {/* Navigation Links according to Active Role and Login State */}
          <nav className="hidden md:flex items-center gap-1.5">
            {/* If NOT logged in: Guest Navigation with page-level auth validation */}
            {!isLoggedIn && (
              <>
                <button
                  onClick={() => setActiveTab('storefront')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  Storefront Catalog
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'charts'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Top Charts
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  My Orders
                </button>
                <button
                  onClick={() => setActiveTab('live-tracking')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'live-tracking'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  Live Tracking
                </button>
                <button
                  onClick={() => setActiveTab('seller-dashboard')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'seller-dashboard'
                      ? 'bg-[#77775a] text-white shadow-[0_12px_26px_rgba(86,80,57,0.3)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Seller Studio
                </button>
                <button
                  onClick={() => setActiveTab('admin-dashboard')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'admin-dashboard'
                      ? 'bg-[#522750] text-white shadow-[0_12px_26px_rgba(82,39,80,0.28)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Dashboard
                </button>
              </>
            )}

            {/* If Logged in as CUSTOMER */}
            {isLoggedIn && currentRole === 'customer' && (
              <>
                <button
                  onClick={() => setActiveTab('storefront')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  Storefront Catalog
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'charts'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Top Charts
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  My Orders
                </button>
                <button
                  onClick={() => setActiveTab('live-tracking')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'live-tracking'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  Live Tracking
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'profile'
                      ? 'premium-button text-white shadow-[0_10px_25px_rgba(235,127,45,0.35)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#101010] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  My Profile
                </button>
              </>
            )}

            {/* If Logged in as SELLER */}
            {isLoggedIn && currentRole === 'seller' && (
              <>
                <button
                  onClick={() => setActiveTab('seller-dashboard')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'seller-dashboard'
                      ? 'bg-[#77775a] text-white shadow-[0_12px_26px_rgba(86,80,57,0.3)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  Seller Studio
                </button>
                <button
                  onClick={() => setActiveTab('storefront')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'bg-[#77775a] text-white shadow-[0_12px_26px_rgba(86,80,57,0.3)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  Preview Storefront
                </button>
              </>
            )}

            {/* If Logged in as ADMIN */}
            {isLoggedIn && currentRole === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('admin-dashboard')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'admin-dashboard'
                      ? 'bg-[#522750] text-white shadow-[0_12px_26px_rgba(82,39,80,0.28)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Governance
                </button>
                <button
                  onClick={() => setActiveTab('storefront')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'bg-[#522750] text-white shadow-[0_12px_26px_rgba(82,39,80,0.28)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  Public Storefront
                </button>
              </>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* AI Assistant Button */}
            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-sky-950/70 hover:bg-sky-900/70 text-sky-300 border border-sky-800/60 transition-all cursor-pointer shadow-xs group"
                title="Open ShopNiro AI Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#161C24] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-blue-600" />
                )}
              </button>
            )}

            {/* Cart Button */}
            {(!isLoggedIn || currentRole === 'customer') && (
              <button
                onClick={onOpenCart}
                className="relative w-9 h-9 rounded-full bg-slate-100 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Shopping Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-md shadow-blue-600/40">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* User Session Auth Button */}
            {!isLoggedIn ? (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-full shadow-md shadow-blue-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/60 rounded-full transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
