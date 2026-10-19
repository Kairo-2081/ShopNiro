import React, { useState } from 'react';
import { UserRole } from '../types';
import { X, LogIn, Lock, User, Eye, EyeOff, ShieldAlert, UserPlus, Store, CheckCircle, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { OAuthProviderButtons } from './OAuthProviderButtons';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole, entity: any) => void;
  onOpenCustomerSignup?: () => void;
  onOpenSellerSignup?: () => void;
  noticeMessage?: string | null;
  initialTab?: 'login' | 'register';
  initialRole?: 'customer' | 'seller' | 'rider';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  noticeMessage,
  initialTab = 'login',
  initialRole = 'customer',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  
  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Register fields
  const [registerRole, setRegisterRole] = useState<'customer' | 'seller' | 'rider'>(initialRole);
  const [regIdentifier, setRegIdentifier] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setRegisterRole(initialRole);
      setError(null);
      setSuccessMessage(null);
    }
  }, [initialRole, initialTab, isOpen]);

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
      setError('Please provide both Username/Email and Password.');
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
        setError('Invalid username or password. Please check your credentials.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid username or password. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regIdentifier.trim() || regPassword.length < 8) {
      setError('Enter a username or email address and a password of at least 8 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await api.signup(registerRole, regIdentifier, regPassword);
      await onLoginSuccess(result.role, result.entity);
      setRegIdentifier('');
      setLoginPassword('');
      setRegPassword('');
      setError(null);
      onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Could not create your account. Please try another username or email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="login-modal-title" tabIndex={-1} className="premium-surface rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-blue-50/50 dark:bg-[#161C24]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/40">
              {activeTab === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="login-modal-title" className="text-base font-black text-slate-900 dark:text-white">
                {activeTab === 'login' ? 'Marketplace Login' : 'Create an Account'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {activeTab === 'login'
                  ? 'Sign in with your verified Username & Password'
                  : 'Register a new Customer or Seller profile'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in"
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 m-4 mb-0 bg-slate-100 dark:bg-[#181F2A] rounded-full border border-slate-200 dark:border-zinc-700 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`py-2 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError(null);
            }}
            className={`py-2 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {noticeMessage && !error && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-2xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span className="font-medium">{noticeMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">{error}</span>
                {activeTab === 'login' && error.includes('No registered account') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setRegIdentifier(loginUsername);
                      setError(null);
                    }}
                    className="text-xs text-blue-600 dark:text-sky-400 hover:underline font-bold inline-flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    Click here to create this account now &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Username or Email */}
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  Username or Email *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Enter username or email"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full p-2.5 pl-9 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <User className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter account password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full p-2.5 pl-9 pr-10 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
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
                  className="text-xs text-blue-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                >
                  Need an account? Sign up
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-md shadow-blue-600/30 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {isSubmitting ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>

              <OAuthProviderButtons role="login" mode="sign in" />
            </form>
          ) : (
            /* CREATE ACCOUNT FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Role Picker */}
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">
                  Account Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('customer')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      registerRole === 'customer'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-sky-400 font-bold'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold">Customer (Buyer)</div>
                      <div className="text-[10px] text-slate-400">Shop &amp; track orders</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterRole('seller')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      registerRole === 'seller'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold">Merchant (Seller)</div>
                      <div className="text-[10px] text-slate-400">Sell products</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole('rider')}
                    className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                      registerRole === 'rider'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold">Rider</div>
                      <div className="text-[10px] text-slate-400">Delivery</div>
                    </div>
                  </button>
                </div>
              </div>

              <OAuthProviderButtons role={registerRole} mode="sign up" />
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  Username or email address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Choose a username or enter your email"
                    value={regIdentifier}
                    onChange={(e) => setRegIdentifier(e.target.value)}
                    className="w-full p-2.5 pl-8 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full p-2.5 pl-8 pr-9 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  You will use this password every time you log in.
                </p>
              </div>

              {/* Submit Register */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                  }}
                  className="text-xs text-blue-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                >
                  Already registered? Sign In
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-md shadow-blue-600/30 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Creating Account...' : 'Register & Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
