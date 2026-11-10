import React from 'react';
import { UserRole, Customer, Seller, Admin, AppTab } from '../types';
import { shopNiroLogoSmall } from '../lib/branding';
import {
  ShoppingCart,
  User,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Sparkles,
  Languages,
  Menu,
} from 'lucide-react';
import { useLocale } from '../lib/i18n';

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
  onOpenNavigation: () => void;
  isNavigationOpen: boolean;
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
  setActiveTab,
  cartCount,
  onOpenCart,
  onOpenLogin,
  onLogout,
  onOpenNavigation,
  isNavigationOpen,
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
    <header className="glass-header sticky top-0 z-30 border-b border-[#80734f]/20 bg-[#f6f5ef] shadow-[0_8px_24px_rgba(41,40,33,0.10)] transition-colors duration-200 dark:border-white/10 dark:bg-[#10100f] dark:shadow-[0_12px_32px_rgba(6,6,4,0.25)]">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 py-2 sm:gap-3">
          <div className="order-1 flex min-w-0 items-center gap-2 md:order-none">
            <button
              type="button"
              onClick={onOpenNavigation}
              aria-label={isNavigationOpen ? 'Navigation open' : 'Open navigation'}
              aria-expanded={isNavigationOpen}
              aria-controls="mobile-navigation-drawer"
              aria-haspopup="dialog"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#80734f]/20 bg-white/70 text-surface-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a99b72] dark:border-white/10 dark:bg-[#161C24] dark:text-surface-200 dark:hover:bg-[#202833] md:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={`ShopNiro ${t('storefrontCatalog')}`}
              onClick={() => setActiveTab('storefront')}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:gap-2.5"
            >
              <img
                src={shopNiroLogoSmall}
                alt="ShopNiro"
                className="h-9 w-9 rounded-full border border-[#d0c8a5]/50 object-cover shadow-[0_8px_20px_rgba(169,155,114,0.24)] sm:h-10 sm:w-10"
              />
              <span className="font-display text-lg font-normal leading-none text-[#0f1f1d] dark:text-white sm:text-xl">
                ShopNiro
              </span>
            </button>
          </div>

          <div className="order-2 flex w-full flex-wrap items-center justify-end gap-2 md:order-none md:w-auto">
            {onOpenChat && isLoggedIn && ['seller', 'admin'].includes(currentRole) && (
              <button
                type="button"
                onClick={onOpenChat}
                aria-label="Ask AI: Open ShopNiro AI Assistant"
                className="luxury-control min-h-9 items-center gap-1.5 rounded-full border border-[#8a7f4a]/40 bg-[#d0c8a5]/30 px-3 text-xs font-semibold text-[#4f4720] hover:bg-[#d0c8a5]/45 dark:border-[#d0c8a5]/25 dark:bg-[#d0c8a5]/10 dark:font-normal dark:text-[#d0c8a5] dark:hover:bg-[#d0c8a5]/15"
                title="Open ShopNiro AI Assistant"
              >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-warning-700 dark:text-warning-400" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            )}

            {(!isLoggedIn || currentRole === 'customer') && (
              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
                className="luxury-control min-h-11 gap-1.5 rounded-full border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:bg-[#161C24] dark:text-surface-200 dark:hover:bg-surface-800"
                aria-label={`${t('language')}: ${locale === 'en' ? t('switchToBangla') : t('switchToEnglish')}`}
                title="Change language"
              >
                <Languages aria-hidden="true" className="h-4 w-4" />
                <span>{t('language')}</span>
              </button>
            )}

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="luxury-control h-11 w-11 min-h-11 rounded-full border border-surface-200 bg-surface-100 text-surface-700 hover:bg-surface-200 dark:border-surface-800 dark:bg-[#161C24] dark:text-surface-300 dark:hover:bg-surface-800"
                aria-label={theme === 'dark' ? t('changeThemeToLight') : t('changeThemeToDark')}
                title={theme === 'dark' ? t('changeThemeToLight') : t('changeThemeToDark')}
              >
                {theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4 text-warning-400" /> : <Moon aria-hidden="true" className="h-4 w-4 text-brand-600" />}
              </button>
            )}

            {(!isLoggedIn || currentRole === 'customer') && (
              <button
                type="button"
                onClick={onOpenCart}
                className="luxury-control relative h-11 w-11 min-h-11 rounded-full border border-surface-200 bg-surface-100 text-surface-700 hover:bg-surface-200 dark:border-surface-800 dark:bg-[#161C24] dark:text-surface-300 dark:hover:bg-surface-800"
                aria-label={cartCount > 0 ? `Shopping Cart: ${cartCount}` : 'Shopping Cart'}
              >
                <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-micro font-bold text-white shadow-md shadow-brand-600/40">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {!isLoggedIn ? (
              <button
                type="button"
                onClick={onOpenLogin}
                className="luxury-control premium-button min-h-11 rounded-full px-4 text-xs text-white shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] focus-visible:ring-offset-2 focus-visible:ring-offset-white/20"
              >
                <LogIn aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{t('signIn')}</span>
              </button>
            ) : (
              <div ref={accountMenuRef} className="relative">
                <button
                  ref={accountButtonRef}
                  type="button"
                  onClick={() => setIsAccountMenuOpen((open) => !open)}
                  aria-label="Open account menu"
                  aria-expanded={isAccountMenuOpen}
                  aria-controls="account-menu"
                  className="luxury-control min-h-11 gap-1.5 rounded-full border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:bg-[#161C24] dark:text-surface-200 dark:hover:bg-surface-800"
                >
                  <User aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">Account</span>
                </button>
                {isAccountMenuOpen && (
                  <div id="account-menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-surface-200 bg-white p-3 text-surface-900 shadow-xl dark:border-surface-700 dark:bg-[#171713] dark:text-surface-100">
                    <p className="truncate text-sm font-bold">{accountName}</p>
                    {accountEmail && <p className="mt-1 break-all text-xs text-surface-700 dark:text-surface-300">{accountEmail}</p>}
                    <button
                      type="button"
                      onClick={() => { setIsAccountMenuOpen(false); onLogout(); }}
                      className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-danger-700 hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 dark:text-danger-300 dark:hover:bg-danger-950/50"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" />
                      {t('logOut')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
