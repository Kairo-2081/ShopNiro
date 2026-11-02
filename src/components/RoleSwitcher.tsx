import React from 'react';
import { Store, LogIn, UserPlus, Truck } from 'lucide-react';

interface RoleSwitcherProps {
  isLoggedIn: boolean;
  onOpenCustomerSignup?: () => void;
  onOpenSellerSignup: () => void;
  onOpenRiderSignup?: () => void;
  onOpenLogin: () => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  isLoggedIn,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenRiderSignup,
  onOpenLogin,
}) => {
  if (isLoggedIn) return null;

  return (
    <div className="bg-[#eeede4]/80 dark:bg-[#171713] text-surface-900 dark:text-surface-100 px-4 py-2 text-xs border-b border-[#d0c8a5]/10 dark:border-surface-800/80 transition-colors duration-200">
      <div className="mx-auto flex min-w-0 max-w-7xl flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-warning-500/10 text-warning-600 dark:text-warning-400 font-bold uppercase tracking-wider text-micro border border-warning-500/20">
            Guest Mode
          </span>
          <span className="text-surface-600 dark:text-surface-400 hidden sm:inline">
            You are browsing the public marketplace catalog. Sign in to place orders, apply discount vouchers, or manage stores.
          </span>
        </div>

        <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {/* Simple Login Button */}
          <button
            onClick={onOpenLogin}
            className="luxury-control premium-button flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-center leading-tight text-white font-bold cursor-pointer sm:px-3.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          {/* Registration Options */}
          {onOpenCustomerSignup && (
            <button
              onClick={onOpenCustomerSignup}
              className="luxury-control flex min-w-0 items-center justify-center gap-1 px-2.5 py-1.5 text-center leading-tight bg-[#d0c8a5]/10 dark:bg-[#181F2A] text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white border border-[#d0c8a5]/35 dark:border-surface-700 rounded-full transition-colors cursor-pointer font-medium sm:px-3"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#a99b72] dark:text-[#d0c8a5]" />
              <span>Customer Signup</span>
            </button>
          )}

          {onOpenSellerSignup && (
            <button
              onClick={onOpenSellerSignup}
              className="luxury-control flex min-w-0 items-center justify-center gap-1 px-2.5 py-1.5 text-center leading-tight bg-[#77775a] hover:bg-[#555541] text-white border border-[#77775a]/70 rounded-full transition-colors cursor-pointer font-medium sm:px-3"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Become a Seller</span>
            </button>
          )}

          {onOpenRiderSignup && (
            <button
              onClick={onOpenRiderSignup}
              className="luxury-control flex min-w-0 items-center justify-center gap-1 px-2.5 py-1.5 text-center leading-tight bg-[#77775a] hover:bg-[#555541] text-white border border-[#77775a]/70 rounded-full transition-colors cursor-pointer font-medium sm:px-3"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Rider portal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
