import React from 'react';
import { api } from '../lib/api';
import { useLocale } from '../lib/i18n';

interface OAuthProviderButtonsProps {
  role: 'customer' | 'seller' | 'rider' | 'login';
  mode: 'sign in' | 'sign up';
  acceptedTerms?: boolean;
  className?: string;
}

export const OAuthProviderButtons: React.FC<OAuthProviderButtonsProps> = ({ role, mode, acceptedTerms = false, className = '' }) => {
  const { t } = useLocale();
  const disabled = mode === 'sign up' && !acceptedTerms;
  const beginOAuth = (provider: 'google' | 'facebook') => {
    api.beginOAuth(provider, role === 'login' ? 'customer' : role, mode === 'sign up' && acceptedTerms);
  };

  return (
  <div className={`space-y-3 ${className}`}>
    <div className="flex items-center gap-3 py-1 text-micro font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-500">
      <span className="h-px flex-1 bg-surface-200 dark:bg-surface-700" />
      <span>{mode === 'sign in' ? t('orSignInWith') : t('orSignUpWith')}</span>
      <span className="h-px flex-1 bg-surface-200 dark:bg-surface-700" />
    </div>

    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => beginOAuth('google')}
        disabled={disabled}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-700 transition-colors hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-700 dark:bg-[#181F2A] dark:text-surface-200 dark:hover:bg-surface-800"
      >
        <span aria-hidden="true" className="font-black text-brand-600">G</span>
        Google
      </button>
      <button
        type="button"
        onClick={() => beginOAuth('facebook')}
        disabled={disabled}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-3 text-xs font-semibold text-surface-700 transition-colors hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-surface-700 dark:bg-[#181F2A] dark:text-surface-200 dark:hover:bg-surface-800"
      >
        <span aria-hidden="true" className="font-black text-[#1877F2]">f</span>
        Facebook
      </button>
    </div>
    {disabled && <p className="text-center text-micro text-surface-500">{t('acceptPoliciesToContinue')}</p>}
  </div>
  );
};