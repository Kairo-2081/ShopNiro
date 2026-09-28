import React, { useState } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, X, Lock, Eye, EyeOff } from 'lucide-react';

interface AdminSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ADMIN_SECURITY_KEY = 'ADMIN123';

export const AdminSecurityModal: React.FC<AdminSecurityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [securityKey, setSecurityKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityKey.trim().toUpperCase() === ADMIN_SECURITY_KEY) {
      setError(null);
      setSecurityKey('');
      onSuccess();
    } else {
      setError('Invalid Security Key! Please check the key and try again.');
    }
  };

  const handleAutoFillKey = () => {
    setSecurityKey(ADMIN_SECURITY_KEY);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-sky-100 dark:border-zinc-800/80 flex items-center justify-between bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Admin Security Verification</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Restricted governance console authentication</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-sky-300 rounded-2xl flex items-center justify-between gap-2">
            <div>
              🔑 <strong>Platform Key:</strong> <code className="bg-blue-500/20 px-2 py-0.5 rounded-full font-mono font-bold">ADMIN123</code>
            </div>
            <button
              type="button"
              onClick={handleAutoFillKey}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-colors text-[11px] cursor-pointer shrink-0"
            >
              Fill Key
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              Enter Admin Security Key *
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                required
                placeholder="Enter security key..."
                value={securityKey}
                onChange={(e) => {
                  setSecurityKey(e.target.value);
                  setError(null);
                }}
                className="w-full p-2.5 pl-9 pr-10 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <KeyRound className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-lg shadow-blue-500/30 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify &amp; Enter Console</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
