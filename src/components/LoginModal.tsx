import React, { useState } from 'react';
import { UserRole } from '../types';
import { X, LogIn, Lock, User, Eye, EyeOff, ShieldAlert, UserPlus, Store, CheckCircle, Truck, Mail, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { OAuthProviderButtons } from './OAuthProviderButtons';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { PolicyLinks } from './legal/PolicyLinks';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useLocale } from '../lib/i18n';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, entity: any) => void;
  onOpenCustomerSignup?: () => void;
  onOpenSellerSignup?: () => void;
  noticeMessage?: string | null;
  initialTab?: 'login' | 'register';
  initialRole?: 'customer' | 'seller' | 'rider';
  initialPasswordResetToken?: string | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  noticeMessage,
  initialTab = 'login',
  initialRole = 'customer',
  initialPasswordResetToken = null,
}) => {
  const { t } = useLocale();
  useEscapeKey(onClose, isOpen);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(initialPasswordResetToken);
  
  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  
  // Register fields
  const [registerRole, setRegisterRole] = useState<'customer' | 'seller' | 'rider'>(initialRole);
  const [regIdentifier, setRegIdentifier] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const localizedNoticeMessage = noticeMessage?.startsWith('Account created successfully.')
    ? t('accountCreatedNotice')
    : noticeMessage;
  const localizedError = error?.includes('No registered account')
    ? t('accountNotRegistered')
    : error;

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setRegisterRole(initialRole);
      setIsForgotPassword(false);
      setPasswordResetToken(initialPasswordResetToken);
      setError(null);
      setSuccessMessage(null);
      setAcceptedTerms(false);
    }
  }, [initialPasswordResetToken, initialRole, initialTab, isOpen]);

  React.useEffect(() => {
    if (isOpen && noticeMessage?.startsWith('Account created successfully.')) {
      setActiveTab('login');
      setError(null);
    }
  }, [isOpen, noticeMessage]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError(t('enterCredentials'));
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.login(loginUsername.trim(), loginPassword.trim());
      if (res.success && res.entity) {
        onLoginSuccess(res.role, res.entity);
        setLoginUsername('');
        setLoginPassword('');
        setError(null);
        onClose();
      } else {
        setError(t('invalidCredentials'));
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || t('invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regIdentifier.trim() || regPassword.length < 8) {
      setError(t('enterUsernamePassword'));
      return;
    }

    if (!acceptedTerms) {
      setError(t('acceptTermsForAccount'));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await api.signup(registerRole, regIdentifier, regPassword, acceptedTerms);
      await onLoginSuccess(result.role, result.entity);
      setRegIdentifier('');
      setLoginPassword('');
      setRegPassword('');
      setError(null);
      onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || t('couldNotCreateAccount'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await api.requestPasswordReset(recoveryEmail.trim());
      setSuccessMessage(t('recoveryEmailSent'));
    } catch (err: any) {
      console.error('Password recovery request failed:', err);
      setError(err.message || t('couldNotRequestReset'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError(t('passwordLengthRule'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }
    if (!passwordResetToken) return;

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await api.resetPassword(passwordResetToken, newPassword);
      setPasswordResetToken(null);
      setNewPassword('');
      setConfirmNewPassword('');
      setLoginPassword('');
      setActiveTab('login');
      setSuccessMessage(t('passwordResetSuccess'));
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err.message || t('couldNotResetPassword'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="login-modal-title" tabIndex={-1} className="premium-surface rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between bg-brand-50/50 dark:bg-[#161C24]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-600/40">
              {passwordResetToken || isForgotPassword
                ? <Mail className="w-5 h-5" />
                : activeTab === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="login-modal-title" className="text-base font-black text-surface-900 dark:text-white">
                {passwordResetToken
                  ? t('chooseNewPassword')
                  : isForgotPassword
                    ? t('forgotYourPassword')
                    : activeTab === 'login' ? t('marketplaceLogin') : t('createAccountTitle')}
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {passwordResetToken
                  ? t('securePasswordForAccount')
                  : isForgotPassword
                    ? t('secureResetEmailNote')
                    : activeTab === 'login'
                      ? t('verifiedUsernamePassword')
                      : t('registerCustomerSellerProfile')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeSignIn')}
            className="p-1.5 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/60 dark:hover:bg-surface-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        {!passwordResetToken && !isForgotPassword && <div className="grid grid-cols-2 p-1 m-4 mb-0 bg-surface-100 dark:bg-[#181F2A] rounded-full border border-surface-200 dark:border-surface-700 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`py-2 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-brand-600 text-white shadow-xs font-bold'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{t('signIn')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`py-2 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-brand-600 text-white shadow-xs font-bold'
                : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('createAccountAction')}</span>
          </button>
        </div>}

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {localizedNoticeMessage && !error && (
            <div className="p-3 bg-warning-50 dark:bg-warning-950/40 border border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-200 rounded-2xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-warning-600 dark:text-warning-400 mt-0.5" />
              <span className="font-medium">{localizedNoticeMessage}</span>
            </div>
          )}

          {localizedError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-950/50 border border-danger-200 dark:border-danger-900 text-danger-700 dark:text-danger-300 rounded-2xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-danger-600 dark:text-danger-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">{localizedError}</span>
                {activeTab === 'login' && error.includes('No registered account') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setRegIdentifier(loginUsername);
                      setError(null);
                    }}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold inline-flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    {t('clickToCreateAccount')} &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-success-50 dark:bg-success-950/50 border border-success-200 dark:border-success-900 text-success-700 dark:text-success-300 rounded-2xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-success-600 dark:text-success-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {passwordResetToken ? (
            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div>
                <label htmlFor="reset-new-password" className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">{t('newPassword')}</label>
                <input
                  id="reset-new-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">{t('confirmNewPassword')}</label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <p className="text-surface-500 dark:text-surface-400">{t('resetLinkDetails')}</p>
              <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full disabled:opacity-50">
                <Lock className="w-4 h-4" />
                {isSubmitting ? t('updatingPassword') : t('changePassword')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordResetToken(null);
                  setIsForgotPassword(true);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
              >
                {t('requestNewResetLink')}
              </button>
            </form>
          ) : isForgotPassword ? (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <p className="text-surface-600 dark:text-surface-300">{t('resetPrivacyNote')}</p>
              <div>
                <label htmlFor="recovery-email" className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">{t('accountEmail')}</label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  maxLength={255}
                  autoComplete="email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full disabled:opacity-50">
                <Mail className="w-4 h-4" />
                {isSubmitting ? t('sending') : t('sendRecoveryEmail')}
              </button>
              <button type="button" onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMessage(null); }} className="w-full flex items-center justify-center gap-2 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold">
                <ArrowLeft className="w-4 h-4" />
                {t('backToSignIn')}
              </button>
            </form>
          ) : activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Username or Email */}
              <div>
                <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">
                  {t('usernameOrEmail')} *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder={t('enterUsernameOrEmail')}
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full p-2.5 pl-9 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <User className="w-4 h-4 text-surface-500 dark:text-surface-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">
                  {t('passwordLabel')} *
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder={t('enterAccountPassword')}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full p-2.5 pl-9 pr-10 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-surface-500 dark:text-surface-500 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? t('hidePassword') : t('showPassword')}
                    aria-pressed={showLoginPassword}
                    className="absolute right-3 top-3 text-surface-500 hover:text-surface-600 dark:text-surface-400 dark:hover:text-surface-300 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setError(null);
                  }}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                >
                  {t('needAccount')}
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(loginUsername.includes('@') ? loginUsername : '');
                      setIsForgotPassword(true);
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                  >
                    {t('forgotPassword')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full shadow-md shadow-brand-600/30 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    {isSubmitting ? t('authenticating') : t('signIn')}
                  </button>
                </div>
              </div>

              <OAuthProviderButtons role="login" mode="sign in" />
            </form>
          ) : (
            /* CREATE ACCOUNT FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Role Picker */}
              <div>
                <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1.5">
                  {t('chooseAccountType')} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('customer')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      registerRole === 'customer'
                        ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:border-surface-300'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold">{t('customerBuyer')}</div>
                      <div className="text-micro text-surface-400">{t('shopAndTrackOrders')}</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterRole('seller')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      registerRole === 'seller'
                        ? 'border-success-500 bg-success-500/10 text-success-600 dark:text-success-400 font-bold'
                        : 'border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:border-surface-300'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold">{t('merchantSeller')}</div>
                      <div className="text-micro text-surface-400">{t('sellProducts')}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole('rider')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      registerRole === 'rider'
                        ? 'border-success-500 bg-success-500/10 text-success-700 dark:text-success-400 font-bold'
                        : 'border-surface-200 dark:border-surface-800 text-surface-600 dark:text-surface-400 hover:border-surface-300'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold">{t('rider')}</div>
                      <div className="text-micro text-surface-400">{t('delivery')}</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">
                  {t('usernameOrEmail')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder={t('chooseUsernameEmail')}
                    value={regIdentifier}
                    onChange={(e) => setRegIdentifier(e.target.value)}
                    className="w-full p-2.5 pl-8 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <User className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-3" />
                </div>
              </div>
              <div>
                <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">
                  {t('passwordLabel')}
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t('atLeast8Characters')}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full p-2.5 pl-8 pr-9 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-surface-400 absolute left-2.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label={showRegPassword ? t('hidePassword') : t('showPassword')}
                    aria-pressed={showRegPassword}
                    className="absolute right-2.5 top-3 text-surface-500 hover:text-surface-600 dark:text-surface-400 dark:hover:text-surface-300 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-micro text-surface-400 mt-1">
                  {t('usePasswordEveryLogin')}
                </p>
              </div>

              <label className="flex items-start gap-2 text-micro text-surface-600 dark:text-surface-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer"
                />
                <span>
                  {t('ageAndTermsConsent')} <PolicyLinks ids={['terms', 'privacy']} />.
                </span>
              </label>

              <OAuthProviderButtons role={registerRole} mode="sign up" acceptedTerms={acceptedTerms} />

              {/* Submit Register */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                  }}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold cursor-pointer"
                >
                  {t('alreadyRegisteredSignIn')}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full shadow-md shadow-brand-600/30 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? t('creatingAccount') : t('registerAndSignIn')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
