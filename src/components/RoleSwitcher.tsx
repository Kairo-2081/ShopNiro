import React from 'react';
import { UserRole, Customer, Seller, Admin, Rider } from '../types';
import {
  Users,
  Store,
  ShieldCheck,
  LogIn,
  LogOut,
  UserPlus,
  CheckCircle2,
  Lock,
  Truck,
} from 'lucide-react';

interface RoleSwitcherProps {
  isLoggedIn: boolean;
  currentRole: UserRole;
  currentUserEntity: Customer | Seller | Admin | Rider | null;
  onOpenCustomerSignup?: () => void;
  onOpenSellerSignup: () => void;
  onOpenAdminSignup?: () => void;
  onOpenRiderSignup?: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  isLoggedIn,
  currentRole,
  currentUserEntity,
  onOpenCustomerSignup,
  onOpenSellerSignup,
  onOpenAdminSignup,
  onOpenRiderSignup,
  onOpenLogin,
  onLogout,
}) => {
  // If user is LOGGED IN:
  if (isLoggedIn && currentUserEntity) {
    const roleBadgeColor =
      currentRole === 'admin'
        ? 'bg-[#292821]/90 text-[#e7e5d6] border-[#89714f]/60'
        : currentRole === 'seller'
        ? 'bg-[#27281e]/90 text-[#e2e2d2] border-[#7d7e5e]/70'
        : currentRole === 'rider'
          ? 'bg-emerald-950/90 text-emerald-100 border-emerald-700/70'
        : 'bg-[#292821]/90 text-[#e7e5d6] border-[#a99b72]/60';

    const roleName =
      currentRole === 'admin'
        ? 'Platform Admin'
        : currentRole === 'seller'
        ? `Merchant (${(currentUserEntity as Seller).Status?.toUpperCase() || 'SELLER'})`
        : currentRole === 'rider'
        ? `Delivery Rider (${(currentUserEntity as Rider).Status?.toUpperCase() || 'RIDER'})`
        : 'Verified Customer';

    return (
      <div className="bg-[#eeede4]/80 dark:bg-[#171713]/85 text-slate-900 dark:text-zinc-100 px-4 py-2 text-xs border-b border-[#d0c8a5]/10 dark:border-white/10 transition-colors duration-200 backdrop-blur-xl shadow-[0_8px_24px_rgba(12,12,9,0.12)]">
        <div className="mx-auto flex min-w-0 max-w-7xl flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          {/* Active Account Identity */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <span className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] border ${roleBadgeColor}`}>
              <CheckCircle2 className="w-3 h-3" />
              {roleName}
            </span>
            <span className="min-w-0 break-words text-slate-600 dark:text-zinc-400">
              Authenticated as:{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">
                {currentUserEntity.Name}
              </strong>{' '}
              <span className="break-all text-slate-400 dark:text-zinc-500 font-mono text-[11px]">
                ({currentUserEntity.Email})
              </span>
            </span>
          </div>

          {/* User Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-500 dark:text-rose-400 font-semibold rounded-full border border-rose-500/20 transition-all cursor-pointer"
              title="Log out of current account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is GUEST / NOT LOGGED IN:
  return (
    <div className="bg-[#eeede4]/80 dark:bg-[#171713] text-slate-900 dark:text-zinc-100 px-4 py-2 text-xs border-b border-[#d0c8a5]/10 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="mx-auto flex min-w-0 max-w-7xl flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-[10px] border border-amber-500/20">
            Guest Mode
          </span>
          <span className="text-slate-600 dark:text-zinc-400 hidden sm:inline">
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
              className="luxury-control flex min-w-0 items-center justify-center gap-1 px-2.5 py-1.5 text-center leading-tight bg-[#d0c8a5]/10 dark:bg-[#181F2A] text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-[#d0c8a5]/35 dark:border-zinc-700 rounded-full transition-colors cursor-pointer font-medium sm:px-3"
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
