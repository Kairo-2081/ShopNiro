import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { shopNiroLogoSmall } from '../../lib/branding';
import { useLocale } from '../../lib/i18n';

export const LandingHeader: React.FC<{ theme: 'dark' | 'light'; onToggleTheme: (() => void) | undefined; onOpenLogin: () => void; onOpenSellerSignup: () => void }> = ({ theme, onToggleTheme, onOpenLogin, onOpenSellerSignup }) => {
  const { t } = useLocale();

  const navItems = [
    { href: '#features', label: t('featuresNav') },
    { href: '#how-it-works', label: t('howItWorksNav') },
    { href: '#sellers', label: t('sellersNav') },
    { href: '#faq', label: t('faqNav') },
  ];

  return (
    <header className="sticky top-0 z-30 mb-6 rounded-full border border-[#d0c8a5]/15 bg-white/80 dark:bg-[#10100f]/75 px-3 py-2 shadow-[0_12px_32px_rgba(6,6,4,0.24)] backdrop-blur-xl md:rounded-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <img src={shopNiroLogoSmall} alt="ShopNiro" className="h-10 w-10 rounded-full border border-brand-100 object-cover shadow-md shadow-brand-600/20 dark:border-surface-700" />
          <p className="font-display text-xl font-normal leading-none text-surface-900 dark:text-white">ShopNiro</p>
        </div>

        <nav className="hidden items-center gap-1 md:flex lg:gap-2" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="rounded-full px-2 py-2 text-xs font-semibold text-surface-700 dark:text-surface-200 transition-colors hover:bg-black/5 hover:text-surface-900 dark:hover:bg-white/8 dark:hover:text-white lg:px-4 lg:text-sm">
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
  );
};
