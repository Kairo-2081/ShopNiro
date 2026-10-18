import React from 'react';
import { api } from '../lib/api';

interface OAuthProviderButtonsProps {
  role: 'customer' | 'seller' | 'rider' | 'login';
  mode: 'sign in' | 'sign up';
  className?: string;
}

export const OAuthProviderButtons: React.FC<OAuthProviderButtonsProps> = ({ role, mode, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    <div className="flex items-center gap-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
      <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
      <span>Or {mode} with</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
    </div>

    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => api.beginOAuth('google', role === 'login' ? 'customer' : role)}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <span aria-hidden="true" className="font-black text-blue-600">G</span>
        Google
      </button>
      <button
        type="button"
        onClick={() => api.beginOAuth('facebook', role === 'login' ? 'customer' : role)}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <span aria-hidden="true" className="font-black text-[#1877F2]">f</span>
        Facebook
      </button>
    </div>
  </div>
);