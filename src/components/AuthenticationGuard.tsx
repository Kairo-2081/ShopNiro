import React from 'react';
import { ShieldAlert, LogIn, ArrowLeft, Lock } from 'lucide-react';
import { useLocale } from '../lib/i18n';

interface AuthenticationGuardProps {
  pageName: string;
  requiredRole?: string;
  onOpenLogin: () => void;
  onBackToStorefront: () => void;
}

export const AuthenticationGuard: React.FC<AuthenticationGuardProps> = ({
  pageName,
  requiredRole,
  onOpenLogin,
  onBackToStorefront,
}) => {
  const { t } = useLocale();

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-[#12161D] border border-brand-100 dark:border-brand-500/20 rounded-3xl shadow-xl text-center space-y-6 animate-in fade-in duration-200">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20 shadow-inner">
        <Lock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          {t('authRequired')}
        </span>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          {t('signInToAccess', { page: pageName })}
        </h2>
        <p className="text-xs text-surface-600 dark:text-surface-400 max-w-md mx-auto leading-relaxed">
          {t('authValidationNotice')}
          {requiredRole ? ` ${t('authRoleNotice', { role: requiredRole })}` : ` ${t('authProceedPrompt')}`}
        </p>
      </div>

      <div className="p-4 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-2xl text-left space-y-2 text-xs">
        <div className="font-semibold text-surface-800 dark:text-surface-200 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div>
          {t('securityProtocol')}
        </div>
        <ul className="text-surface-500 dark:text-surface-400 space-y-1 list-disc list-inside text-micro">
          <li>{t('guardedOperations')}</li>
          <li>{t('encryptedTokensNotice')}</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBackToStorefront}
          className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300 text-xs font-semibold hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('backToStorefront')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenLogin}
          className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>{t('signIn')}</span>
        </button>
      </div>
    </div>
  );
};
