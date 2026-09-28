import React from 'react';
import { ShieldAlert, LogIn, ArrowLeft, Lock } from 'lucide-react';

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
  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl shadow-xl text-center space-y-6 animate-in fade-in duration-200">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-inner">
        <Lock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          Authentication Required
        </span>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Sign In to Access {pageName}
        </h2>
        <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          Authentication must be validated before processing any data on this page.
          {requiredRole ? ` An authenticated ${requiredRole} session is required.` : ' Please sign in with your credentials to proceed.'}
        </p>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl text-left space-y-2 text-xs">
        <div className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          Security Validation Protocol
        </div>
        <ul className="text-slate-500 dark:text-zinc-400 space-y-1 list-disc list-inside text-[11px]">
          <li>All operations on this page are guarded until credentials are verified.</li>
          <li>Encrypted session tokens protect merchant inventories and customer private records.</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBackToStorefront}
          className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Storefront</span>
        </button>

        <button
          type="button"
          onClick={onOpenLogin}
          className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In / Register</span>
        </button>
      </div>
    </div>
  );
};
