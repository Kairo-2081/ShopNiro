import React from 'react';
import { Languages, Moon, Sun } from 'lucide-react';
import { useLocale } from '../lib/i18n';
import { useTheme } from '../lib/theme';

// The two preference buttons, defined once so every header (storefront, role dashboards, landing page, policy pages)
// shows the same controls with the same labels. Both read their state from context, so no screen has to pass them down.

/** Switches between English and Bangla. Its visible label is the language you would switch to. */
export const LanguageToggle: React.FC<{ className?: string; iconOnlyOnPhones?: boolean }> = ({ className = '', iconOnlyOnPhones = false }) => {
  const { t, locale, setLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
      aria-label={`${t('language')}: ${locale === 'en' ? t('switchToBangla') : t('switchToEnglish')}`}
      title={t('changeLanguage')}
      className={`luxury-control min-h-11 cursor-pointer gap-1.5 rounded-full border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-800 hover:bg-surface-50 dark:border-surface-700 dark:bg-[#161C24] dark:text-surface-200 dark:hover:bg-surface-800 ${className}`}
    >
      <Languages aria-hidden="true" className="h-4 w-4" />
      <span className={iconOnlyOnPhones ? 'hidden sm:inline' : undefined}>{locale === 'en' ? 'বাংলা' : 'English'}</span>
    </button>
  );
};

/** Switches between the dark and light theme. */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? t('changeThemeToLight') : t('changeThemeToDark');
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`luxury-control h-11 w-11 min-h-11 cursor-pointer rounded-full border border-surface-200 bg-surface-100 text-surface-700 hover:bg-surface-200 dark:border-surface-800 dark:bg-[#161C24] dark:text-surface-300 dark:hover:bg-surface-800 ${className}`}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" className="h-4 w-4 text-warning-400" /> : <Moon aria-hidden="true" className="h-4 w-4 text-brand-600" />}
    </button>
  );
};
