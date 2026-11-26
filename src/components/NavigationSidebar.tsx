import React from 'react';
import {
  Activity,
  BarChart3,
  TrendingUp,
  Flame,
  FolderTree,
  LifeBuoy,
  Lock,
  Package,
  PackageCheck,
  Radio,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AdminDashboardTab, AppTab, SellerDashboardTab, UserRole } from '../types';
import { useLocale } from '../lib/i18n';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface NavigationItem {
  label: string;
  icon: LucideIcon;
  tab?: AppTab;
  sellerTab?: SellerDashboardTab;
  adminTab?: AdminDashboardTab;
  badge?: number;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

interface NavigationSidebarProps {
  isLoggedIn: boolean;
  currentRole: UserRole;
  activeTab: AppTab;
  setActiveTab: React.Dispatch<React.SetStateAction<AppTab>>;
  sellerTab: SellerDashboardTab;
  setSellerTab: React.Dispatch<React.SetStateAction<SellerDashboardTab>>;
  adminTab: AdminDashboardTab;
  setAdminTab: React.Dispatch<React.SetStateAction<AdminDashboardTab>>;
  isOpen: boolean;
  onClose: () => void;
  sellerOrderCount: number;
  sellerProductCount: number;
  sellerReviewCount: number;
  sellerPromotionCount: number;
  adminSellerCount: number;
  adminCategoryCount: number;
  adminProductCount: number;
  customerActiveOrderCount?: number;
}

const primaryItem = (
  label: string,
  icon: LucideIcon,
  tab: AppTab,
): NavigationItem => ({ label, icon, tab });

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  isLoggedIn,
  currentRole,
  activeTab,
  setActiveTab,
  sellerTab,
  setSellerTab,
  adminTab,
  setAdminTab,
  isOpen,
  onClose,
  sellerOrderCount,
  sellerProductCount,
  sellerReviewCount,
  sellerPromotionCount,
  adminSellerCount,
  adminCategoryCount,
  adminProductCount,
  customerActiveOrderCount = 0,
}) => {
  const { t } = useLocale();
  const mobileDrawerRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  const sections: NavigationSection[] = isLoggedIn && currentRole === 'admin' && activeTab === 'admin-dashboard'
    ? [
        {
          label: t('governance'),
          items: [
            { label: t('governanceOverview'), icon: Activity, adminTab: 'overview' },
            { label: t('marketplaceMetrics'), icon: BarChart3, adminTab: 'metrics' },
            { label: t('navMerchantApprovals'), icon: Store, adminTab: 'sellers', badge: adminSellerCount },
            { label: t('navCategoryRegistry'), icon: FolderTree, adminTab: 'categories', badge: adminCategoryCount },
            { label: t('riderHiring'), icon: Truck, adminTab: 'riders' },
            { label: t('navProductModeration'), icon: Package, adminTab: 'products', badge: adminProductCount },
            { label: t('sellerPayoutRequests'), icon: Lock, adminTab: 'payments' },
            { label: t('orderCancellations'), icon: RotateCcw, adminTab: 'cancellations' },
            { label: t('supportInbox'), icon: LifeBuoy, adminTab: 'support' },
          ],
        },
        {
          label: t('marketplace'),
          items: [primaryItem(t('storefront'), ShoppingBag, 'storefront')],
        },
      ]
    : isLoggedIn && currentRole === 'seller' && (activeTab === 'seller-dashboard' || activeTab === 'transactions')
      ? [
          {
            label: t('sellerStudioSection'),
            items: [
                { label: t('navProductCatalog'), icon: Package, sellerTab: 'products', badge: sellerProductCount },
                { label: t('navFulfillmentOrders'), icon: Truck, sellerTab: 'orders', badge: sellerOrderCount },
                { label: t('salesAnalytics'), icon: BarChart3, sellerTab: 'analytics' },
                { label: t('navCustomerReviews'), icon: Star, sellerTab: 'reviews', badge: sellerReviewCount },
                { label: t('navDealsBundles'), icon: Tag, sellerTab: 'promotions', badge: sellerPromotionCount },
                { label: t('codRemittances'), icon: Wallet, sellerTab: 'wallet' },
            ],
          },
          {
            label: t('marketplace'),
            items: [
              primaryItem(t('navTransactions'), Wallet, 'transactions'),
              primaryItem(t('previewStorefront'), ShoppingBag, 'storefront'),
              primaryItem(t('support'), LifeBuoy, 'support'),
            ],
          },
        ]
      : isLoggedIn && currentRole === 'customer'
        ? [{
            label: t('yourMarketplace'),
            items: [
              primaryItem(t('shop'), ShoppingBag, 'storefront'),
              primaryItem(t('topCharts'), Flame, 'charts'),
              { ...primaryItem(t('orders'), PackageCheck, 'orders'), badge: customerActiveOrderCount },
              primaryItem(t('navSpendingInsights'), TrendingUp, 'spending'),
              primaryItem(t('navTransactions'), Wallet, 'transactions'),
              primaryItem(t('liveTracking'), Radio, 'live-tracking'),
              primaryItem(t('profile'), User, 'profile'),
              primaryItem(t('support'), LifeBuoy, 'support'),
            ],
          }]
        : isLoggedIn && currentRole === 'seller'
          ? [{
              label: t('seller'),
              items: [
                primaryItem(t('sellerStudio'), Store, 'seller-dashboard'),
                primaryItem(t('storefront'), ShoppingBag, 'storefront'),
                primaryItem(t('support'), LifeBuoy, 'support'),
              ],
            }]
          : isLoggedIn && currentRole === 'admin'
            ? [{
                label: t('administration'),
                items: [
                  primaryItem(t('adminDashboard'), ShieldCheck, 'admin-dashboard'),
                  primaryItem(t('storefront'), ShoppingBag, 'storefront'),
                  primaryItem(t('support'), LifeBuoy, 'support'),
                ],
              }]
            : isLoggedIn && currentRole === 'rider'
              ? [{
                  label: t('deliveries'),
                  items: [
                    primaryItem(t('deliveries'), Truck, 'rider-dashboard'),
                    primaryItem(t('navRiderAnalytics'), BarChart3, 'rider-analytics'),
                    primaryItem(t('navTransactions'), Wallet, 'transactions'),
                    primaryItem(t('support'), LifeBuoy, 'support'),
                  ],
                }]
              : [
                  {
                    label: t('explore'),
                    items: [
                      primaryItem(t('browse'), ShoppingBag, 'storefront'),
                      primaryItem(t('topCharts'), Flame, 'charts'),
                      primaryItem(t('orders'), PackageCheck, 'orders'),
                      primaryItem(t('liveTracking'), Radio, 'live-tracking'),
                      primaryItem(t('account'), User, 'profile'),
                      primaryItem(t('support'), LifeBuoy, 'support'),
                    ],
                  },
                  {
                    label: t('portals'),
                    items: [
                      primaryItem(t('sellerStudio'), Store, 'seller-dashboard'),
                      primaryItem(t('adminDashboard'), ShieldCheck, 'admin-dashboard'),
                    ],
                  },
                ];

  const isItemActive = (item: NavigationItem) => item.tab
    ? activeTab === item.tab
    : item.sellerTab
      ? activeTab === 'seller-dashboard' && sellerTab === item.sellerTab
      : activeTab === 'admin-dashboard' && adminTab === item.adminTab;

  const selectItem = (item: NavigationItem) => {
    if (item.tab) setActiveTab(item.tab);
    if (item.sellerTab) {
      setSellerTab(item.sellerTab);
      setActiveTab('seller-dashboard');
    }
    if (item.adminTab) {
      setAdminTab(item.adminTab);
      setActiveTab('admin-dashboard');
    }
    onClose();
  };

  const renderNavigation = () => (
    <nav aria-label={t('workspaceNavigation')} className="space-y-6">
      {sections.map((section) => (
        <section key={section.label} aria-label={section.label} className="space-y-1">
          <h2 className="px-3 pb-1 font-display text-sm font-normal italic text-surface-500 dark:text-surface-400">
            {section.label}
          </h2>
          <div className="space-y-1">
            {section.items.map(({ label, icon: Icon, ...item }) => {
              const isActive = isItemActive({ label, icon: Icon, ...item });
              return (
                <button
                  key={item.tab || item.sellerTab || item.adminTab}
                  type="button"
                  onClick={() => selectItem({ label, icon: Icon, ...item })}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.95rem] font-medium transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80734f] dark:focus-visible:outline-[#d0c8a5] ${
                    isActive
                      ? 'bg-[#d0c8a5]/35 text-[#4f4720] shadow-[inset_3px_0_0_#a99b72] dark:bg-white/[0.05] dark:text-white dark:shadow-[inset_3px_0_0_#d0c8a5,inset_0_0_0_1px_rgba(208,200,165,0.14)]'
                      : 'text-surface-700 hover:bg-surface-100 hover:text-surface-950 dark:text-surface-300 dark:hover:bg-[#181F2A] dark:hover:text-white'
                  }`}
                >
                  <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#80734f] dark:text-[#d0c8a5]' : 'text-surface-500 dark:text-surface-400'}`} />
                  <span className="min-w-0 flex-1 break-words leading-tight">{label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#80734f]/12 px-1.5 text-xs font-medium tabular-nums text-surface-700 dark:bg-white/[0.07] dark:text-surface-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="hidden min-h-[calc(100vh-4rem)] w-64 shrink-0 self-stretch border-r border-[#80734f]/20 bg-[#f6f5ef]/85 px-3 py-5 backdrop-blur-xl dark:border-[var(--sidebar-border)] dark:bg-[var(--sidebar-bg)] md:block">
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
          <div className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
            {renderNavigation()}
          </div>
          <div className="mt-4 border-t border-[#80734f]/15 px-3 pt-4 text-xs text-surface-500 dark:border-white/10 dark:text-surface-400">
            <p className="font-semibold text-surface-700 dark:text-surface-200">ShopNiro</p>
            <p className="mt-1">{t('marketplaceWorkspace')}</p>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label={t('closeNavigation')}
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-black/45"
          />
          <div
            ref={mobileDrawerRef}
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('navigationMenu')}
            tabIndex={-1}
            className="relative flex h-full w-[min(19rem,calc(100vw-3rem))] flex-col border-r border-[#80734f]/20 bg-[#f6f5ef] px-3 py-4 shadow-xl dark:border-[var(--sidebar-border)] dark:bg-[var(--sidebar-bg)]"
          >
            <div className="mb-5 flex items-center justify-between border-b border-[#80734f]/15 px-2 pb-3 dark:border-white/10">
              <span className="font-display text-lg text-[#0f1f1d] dark:text-white">ShopNiro</span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('closeNavigation')}
                className="grid h-10 w-10 place-items-center rounded-lg text-surface-600 hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a99b72] dark:text-surface-300 dark:hover:bg-[#181F2A]"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
              {renderNavigation()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
