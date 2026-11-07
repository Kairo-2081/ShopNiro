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
  Languages,
} from 'lucide-react';
import { useLocale, type MessageKey } from '../lib/i18n';

const mobileNavItems = (isLoggedIn: boolean, role: UserRole, t: (key: MessageKey) => string) => {
  if (isLoggedIn && role === 'customer') return [
    { tab: 'storefront' as AppTab, label: t('shop'), icon: ShoppingBag },
    { tab: 'charts' as AppTab, label: t('topCharts'), icon: Flame },
    { tab: 'orders' as AppTab, label: t('orders'), icon: PackageCheck },
    { tab: 'profile' as AppTab, label: t('profile'), icon: User },
    { tab: 'support' as AppTab, label: t('support'), icon: LifeBuoy },
  ];
  if (isLoggedIn && role === 'seller') return [
    { tab: 'seller-dashboard' as AppTab, label: 'Studio', icon: Store },
    { tab: 'storefront' as AppTab, label: t('storefront'), icon: ShoppingBag },
    { tab: 'support' as AppTab, label: t('support'), icon: LifeBuoy },
  ];
  if (isLoggedIn && role === 'admin') return [
    { tab: 'admin-dashboard' as AppTab, label: 'Governance', icon: ShieldCheck },
    { tab: 'storefront' as AppTab, label: t('storefront'), icon: ShoppingBag },
    { tab: 'support' as AppTab, label: t('support'), icon: LifeBuoy },
  ];
  if (isLoggedIn && role === 'rider') return [
    { tab: 'rider-dashboard' as AppTab, label: t('deliveries'), icon: Truck },
    { tab: 'support' as AppTab, label: t('support'), icon: LifeBuoy },
  ];
  return [
    { tab: 'storefront' as AppTab, label: t('browse'), icon: ShoppingBag },
    { tab: 'charts' as AppTab, label: t('topCharts'), icon: Flame },
    { tab: 'orders' as AppTab, label: t('orders'), icon: PackageCheck },
    { tab: 'profile' as AppTab, label: t('account'), icon: User },
    { tab: 'support' as AppTab, label: t('support'), icon: LifeBuoy },
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
  const { t, locale, setLocale } = useLocale();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = React.useState(false);
  const accountMenuRef = React.useRef<HTMLDivElement>(null);
  const accountButtonRef = React.useRef<HTMLButtonElement>(null);
  const accountName = currentCustomer?.Name || currentSeller?.Name || admin?.Name || 'Rider account';
  const accountEmail = currentCustomer?.Email || currentSeller?.Email || admin?.Email;

  React.useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  return (
    <header className="glass-header relative z-30 bg-[#f6f5ef] dark:bg-[#10100f] border-b border-[#80734f]/20 dark:border-white/10 shadow-[0_8px_24px_rgba(41,40,33,0.10)] dark:shadow-[0_12px_32px_rgba(6,6,4,0.25)] transition-colors duration-200">
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
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  {t('storefrontCatalog')}
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'charts'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-warning-400" />
                  {t('topCharts')}
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  {t('myOrders')}
                </button>
                <button
                  onClick={() => setActiveTab('live-tracking')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'live-tracking'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                  {t('liveTracking')}
                </button>
                <button
                  onClick={() => setActiveTab('seller-dashboard')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'seller-dashboard'
                      ? 'bg-[#77775a] text-white shadow-[0_12px_26px_rgba(86,80,57,0.3)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  {t('sellerStudio')}
                </button>
                <button
                  onClick={() => setActiveTab('admin-dashboard')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'admin-dashboard'
                      ? 'bg-[#522750] text-white shadow-[0_12px_26px_rgba(82,39,80,0.28)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t('adminDashboard')}
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
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  {t('storefrontCatalog')}
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'charts'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-warning-400" />
                  {t('topCharts')}
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  {t('myOrders')}
                </button>
                <button
                  onClick={() => setActiveTab('live-tracking')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'live-tracking'
                      ? 'premium-button text-white shadow-[0_12px_26px_rgba(235,127,45,0.34)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                  {t('liveTracking')}
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'profile'
                      ? 'premium-button text-white shadow-[0_10px_25px_rgba(235,127,45,0.35)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#101010] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
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
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  {t('sellerStudio')}
                </button>
                <button
                  onClick={() => setActiveTab('storefront')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'storefront'
                      ? 'bg-[#77775a] text-white shadow-[0_12px_26px_rgba(86,80,57,0.3)]'
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
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
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
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
                      : 'text-surface-700 dark:text-surface-300 hover:text-[#0f1f1d] dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
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
                    ? 'bg-success-700 text-white shadow-[0_12px_26px_rgba(5,100,70,0.24)]'
                    : 'text-surface-700 dark:text-surface-300 hover:text-success-800 dark:hover:text-white hover:bg-white/10 dark:hover:bg-[#181F2A]'
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
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === 'support' ? 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900' : 'text-surface-700 hover:bg-white/60 dark:text-surface-300 dark:hover:bg-surface-800'}`}
            >
              <LifeBuoy className="h-3.5 w-3.5" />{t('support')}
            </button>
          </nav>

          {/* Right Actions */}
          <div className="order-2 flex w-full items-center justify-center gap-2 md:order-none md:w-auto md:justify-normal">
            {/* AI Assistant Button */}
            {onOpenChat && isLoggedIn && ['seller', 'admin'].includes(currentRole) && (
              <button
                type="button"
                onClick={onOpenChat}
                aria-label="Open ShopNiro AI Assistant"
                className="luxury-control min-h-9 items-center gap-1.5 rounded-full border border-[#d0c8a5]/25 bg-[#d0c8a5]/10 px-3 text-xs text-[#d0c8a5] hover:bg-[#d0c8a5]/15 cursor-pointer group"
                title="Open ShopNiro AI Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-warning-400" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            {!isLoggedIn || currentRole === 'customer' ? (
              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
                className="luxury-control min-h-11 gap-1.5 rounded-full border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:bg-[#161C24] dark:text-surface-200 dark:hover:bg-surface-800"
                aria-label={locale === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}
                title="Change language"
              >
                <Languages className="h-4 w-4" />
                <span>{t('language')}</span>
              </button>
            ) : null}

            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="luxury-control h-9 w-9 min-h-9 rounded-full bg-surface-100 dark:bg-[#161C24] text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 hover:bg-surface-200 dark:hover:bg-surface-800 cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-warning-400" />
                ) : (
                  <Moon className="w-4 h-4 text-brand-600" />
                )}
              </button>
            )}

            {/* Cart Button */}
            {(!isLoggedIn || currentRole === 'customer') && (
              <button
                onClick={onOpenCart}
                className="luxury-control relative h-9 w-9 min-h-9 rounded-full bg-surface-100 dark:bg-[#161C24] border border-surface-200 dark:border-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-800 cursor-pointer"
                aria-label="Shopping Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-micro font-bold w-5 h-5 rounded-full flex items-center justify-center animate-[pulse_3s_ease-in-out_infinite] shadow-md shadow-brand-600/40">
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
                <span>{t('signIn')}</span>
              </button>
            ) : (
              <div ref={accountMenuRef} className="relative">
                <button
                  ref={accountButtonRef}
                  type="button"
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  aria-label="Open account menu"
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  className="luxury-control min-h-11 gap-1.5 rounded-full border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:bg-[#161C24] dark:text-surface-200 dark:hover:bg-surface-800"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Account</span>
                </button>
                {isAccountMenuOpen && (
                  <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-surface-200 bg-white p-3 text-surface-900 shadow-xl dark:border-surface-700 dark:bg-[#171713] dark:text-surface-100">
                    <p className="truncate text-sm font-bold">{accountName}</p>
                    {accountEmail && <p className="mt-1 break-all text-xs text-surface-700 dark:text-surface-300">{accountEmail}</p>}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setIsAccountMenuOpen(false); onLogout(); }}
                      className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-danger-700 hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 dark:text-danger-300 dark:hover:bg-danger-950/50"
                    >
                      <LogOut className="h-4 w-4" />
                      {t('logOut')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="glass-bar fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#a99b72]/25 bg-[#f6f5ef]/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-8px_24px_rgba(41,40,33,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#10100f]/95 md:hidden" style={{ gridTemplateColumns: `repeat(${mobileNavItems(isLoggedIn, currentRole, t).length}, minmax(0, 1fr))` }}>
        {mobileNavItems(isLoggedIn, currentRole, t).map(({ tab, label, icon: Icon }) => {
          const isActive = activeTab === tab;
          return (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-current={isActive ? 'page' : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-micro font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] ${isActive ? 'text-[#80734f] dark:text-[#d0c8a5]' : 'text-surface-500 dark:text-surface-400'}`}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
