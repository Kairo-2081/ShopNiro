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
  Truck,
  LifeBuoy,
} from 'lucide-react';

const mobileNavItems = (isLoggedIn: boolean, role: UserRole) => {
  if (isLoggedIn && role === 'customer') return [
    { tab: 'storefront' as AppTab, label: 'Shop', icon: ShoppingBag },
    { tab: 'charts' as AppTab, label: 'Top charts', icon: Flame },
    { tab: 'orders' as AppTab, label: 'Orders', icon: PackageCheck },
    { tab: 'profile' as AppTab, label: 'Profile', icon: User },
    { tab: 'support' as AppTab, label: 'Support', icon: LifeBuoy },
  ];
  if (isLoggedIn && role === 'seller') return [
    { tab: 'seller-dashboard' as AppTab, label: 'Studio', icon: Store },
    { tab: 'storefront' as AppTab, label: 'Store preview', icon: ShoppingBag },
    { tab: 'support' as AppTab, label: 'Support', icon: LifeBuoy },
  ];
  if (isLoggedIn && role === 'admin') return [
    { tab: 'admin-dashboard' as AppTab, label: 'Governance', icon: ShieldCheck },
    { tab: 'storefront' as AppTab, label: 'Storefront', icon: ShoppingBag },
    { tab: 'support' as AppTab, label: 'Support', icon: LifeBuoy },
  ];
  if (isLoggedIn && role === 'rider') return [
    { tab: 'rider-dashboard' as AppTab, label: 'Deliveries', icon: Truck },
    { tab: 'support' as AppTab, label: 'Support', icon: LifeBuoy },
  ];
  return [
    { tab: 'storefront' as AppTab, label: 'Browse', icon: ShoppingBag },
    { tab: 'charts' as AppTab, label: 'Top charts', icon: Flame },
    { tab: 'orders' as AppTab, label: 'Orders', icon: PackageCheck },
    { tab: 'profile' as AppTab, label: 'Account', icon: User },
    { tab: 'support' as AppTab, label: 'Support', icon: LifeBuoy },
  ];
};

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
    <header className="relative z-30 bg-[#f6f5ef] dark:bg-[#10100f] border-b border-[#80734f]/20 dark:border-white/10 shadow-[0_8px_24px_rgba(41,40,33,0.10)] dark:shadow-[0_12px_32px_rgba(6,6,4,0.25)] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2 sm:gap-3 md:flex-nowrap">
          {/* Logo & Brand matching Landing Page */}
          <div className="order-1 flex shrink-0 items-center gap-2 cursor-pointer sm:gap-2.5 md:order-none" onClick={() => setActiveTab('storefront')}>
            <img
              src={shopNiroLogo}
              alt="ShopNiro"
              className="h-9 w-9 rounded-full object-cover border border-[#d0c8a5]/50 shadow-[0_8px_20px_rgba(169,155,114,0.24)] sm:h-10 sm:w-10"
            />
            <div>
              <span className="font-display text-lg font-normal leading-none text-[#0f1f1d] dark:text-white sm:text-xl">
                ShopNiro
              </span>
            </div>
          </div>

          {/* Navigation Links according to Active Role and Login State */}
          <nav aria-label="Primary navigation" className="order-3 flex w-full min-w-0 max-w-full flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-1 md:order-none md:flex-1 md:justify-center md:pb-0">
            {/* If NOT logged in: Guest Navigation with page-level auth validation */}
            {!isLoggedIn && (
              <>
                <button
                  onClick={() => setActiveTab('storefront')}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  Storefront Catalog
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-slate-700 dark:text-zinc-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  Storefront Catalog
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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

            {isLoggedIn && currentRole === 'rider' && (
              <button
                onClick={() => setActiveTab('rider-dashboard')}
                className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'rider-dashboard'
                    ? 'bg-emerald-700 text-white shadow-[0_12px_26px_rgba(5,100,70,0.24)]'
                    : 'text-slate-700 dark:text-zinc-300 hover:text-emerald-800 dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Rider deliveries
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('support')}
              aria-current={activeTab === 'support' ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'support' ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-slate-700 hover:bg-white/60 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
            >
              <LifeBuoy className="h-3.5 w-3.5" />Support
            </button>
          </nav>

          {/* Right Actions */}
          <div className="order-2 flex w-full items-center justify-center gap-2 md:order-none md:w-auto md:justify-normal">
            {/* AI Assistant Button */}
            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className="luxury-control min-h-9 items-center gap-1.5 rounded-full border border-[#d0c8a5]/25 bg-[#d0c8a5]/10 px-3 text-xs text-[#d0c8a5] hover:bg-[#d0c8a5]/15 cursor-pointer group"
                title="Open ShopNiro AI Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="luxury-control h-9 w-9 min-h-9 rounded-full bg-slate-100 dark:bg-[#161C24] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
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
                className="luxury-control relative h-9 w-9 min-h-9 rounded-full bg-slate-100 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Shopping Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-[pulse_3s_ease-in-out_infinite] shadow-md shadow-blue-600/40">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* User Session Auth Button */}
            {!isLoggedIn ? (
              <button
                onClick={onOpenLogin}
                className="luxury-control premium-button rounded-full px-4 text-white text-xs shadow-md cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] focus-visible:ring-offset-2 focus-visible:ring-offset-white/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/60 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] focus-visible:ring-offset-2 focus-visible:ring-offset-white/20"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#a99b72]/25 bg-[#f6f5ef]/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-8px_24px_rgba(41,40,33,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10100f]/95 md:hidden" style={{ gridTemplateColumns: `repeat(${mobileNavItems(isLoggedIn, currentRole).length}, minmax(0, 1fr))` }}>
        {mobileNavItems(isLoggedIn, currentRole).map(({ tab, label, icon: Icon }) => {
          const isActive = activeTab === tab;
          return (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-current={isActive ? 'page' : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] ${isActive ? 'text-[#80734f] dark:text-[#d0c8a5]' : 'text-slate-500 dark:text-zinc-400'}`}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
