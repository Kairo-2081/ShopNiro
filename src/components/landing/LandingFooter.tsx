import React from 'react';
import { PolicyLinks } from '../legal/PolicyLinks';
import { BUSINESS } from '../legal/business';
import { useLocale } from '../../lib/i18n';

export const LandingFooter: React.FC<{ onEnterAsGuest: () => void; onOpenLogin: () => void; onOpenCustomerSignup: (() => void) | undefined; onOpenSellerSignup: () => void; onOpenRiderSignup: (() => void) | undefined }> = ({ onEnterAsGuest, onOpenLogin, onOpenCustomerSignup, onOpenSellerSignup, onOpenRiderSignup }) => {
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();

  return (
<footer className="border-t border-surface-200 dark:border-surface-800 bg-white/60 dark:bg-[#0a0d12] text-surface-600 dark:text-surface-300">
  <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 md:px-8">
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerProduct')}</p>
      <ul className="mt-4 space-y-3 text-sm">
        <li><button type="button" onClick={onEnterAsGuest} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('browseProducts')}</button></li>
        <li><a href="#how-it-works" className="hover:text-surface-900 dark:hover:text-white">{t('howItWorksNav')}</a></li>
        <li><a href="#faq" className="hover:text-surface-900 dark:hover:text-white">{t('faqNav')}</a></li>
      </ul>
    </div>
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerSellAndDeliver')}</p>
      <ul className="mt-4 space-y-3 text-sm">
        <li><button type="button" onClick={onOpenSellerSignup} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('startSelling')}</button></li>
        {onOpenRiderSignup && (
          <li><button type="button" onClick={onOpenRiderSignup} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('becomeRider')}</button></li>
        )}
      </ul>
    </div>
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerAccount')}</p>
      <ul className="mt-4 space-y-3 text-sm">
        <li><button type="button" onClick={onOpenLogin} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('signIn')}</button></li>
        <li><button type="button" onClick={onOpenCustomerSignup || onOpenLogin} className="cursor-pointer text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white">{t('createAnAccount')}</button></li>
      </ul>
    </div>
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-800 dark:text-brand-200">{t('footerLegal')}</p>
      <div className="mt-4 text-sm text-surface-600 dark:text-surface-300">
        <PolicyLinks ids={['terms', 'privacy', 'refunds', 'delivery']} className="text-brand-700 dark:text-brand-300 underline hover:text-brand-800 dark:hover:text-brand-200" />
      </div>
    </div>
  </div>
  <div className="border-t border-surface-200 dark:border-surface-800 text-center text-sm text-surface-500 dark:text-surface-400">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6 md:px-8">
      <p>© {currentYear} {BUSINESS.name}. {t('madeInBangladesh')}</p>
      <button type="button" onClick={onOpenLogin} className="cursor-pointer text-xs text-surface-600 transition-colors hover:text-brand-800 dark:text-surface-300 dark:hover:text-brand-200">
          {t('adminSignIn')}
        </button>
    </div>
  </div>
</footer>
  );
};
