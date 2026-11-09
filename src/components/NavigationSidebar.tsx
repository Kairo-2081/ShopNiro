import React from 'react';
import {
  Activity,
  BarChart3,
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
}) => {
  const { t } = useLocale();
  const mobileDrawerRef = useFocusTrap<HTMLDivElement>(isOpen);
  useEscapeKey(onClose, isOpen);

  const sections: NavigationSection[] = isLoggedIn && currentRole === 'admin' && activeTab === 'admin-dashboard'
    ? [
        {
          label: 'Governance',
          items: [
            { label: 'Governance Overview', icon: Activity, adminTab: 'overview' },
            { label: 'Marketplace Metrics', icon: BarChart3, adminTab: 'metrics' },
            { label: `Merchant Approvals (${adminSellerCount})`, icon: Store, adminTab: 'sellers' },
            { label: `Category Registry (${adminCategoryCount})`, icon: FolderTree, adminTab: 'categories' },
            { label: 'Rider Hiring', icon: Truck, adminTab: 'riders' },
            { label: `Product Moderation (${adminProductCount})`, icon: Package, adminTab: 'products' },
            { label: 'Online Payments', icon: Lock, adminTab: 'payments' },
            { label: 'Order Cancellations', icon: RotateCcw, adminTab: 'cancellations' },
            { label: 'Support Inbox', icon: LifeBuoy, adminTab: 'support' },
          ],
        },
        {
          label: 'Marketplace',
          items: [primaryItem(t('storefront'), ShoppingBag, 'storefront')],
        },
      ]
    : isLoggedIn && currentRole === 'seller' && activeTab === 'seller-dashboard'
      ? [
          {
            label: 'Seller studio',
            items: [
              { label: `Product Catalog (${sellerProductCount})`, icon: Package, sellerTab: 'products' },
              { label: `Fulfillment Orders (${sellerOrderCount})`, icon: Truck, sellerTab: 'orders' },
              { label: 'Sales Analytics', icon: BarChart3, sellerTab: 'analytics' },
              { label: `Customer Reviews (${sellerReviewCount})`, icon: Star, sellerTab: 'reviews' },
              { label: `Deals & Bundles (${sellerPromotionCount})`, icon: Tag, sellerTab: 'promotions' },
              { label: 'COD remittances', icon: Wallet, sellerTab: 'wallet' },
            ],
          },
          {
            label: 'Marketplace',
            items: [
              primaryItem('Preview storefront', ShoppingBag, 'storefront'),
              primaryItem(t('support'), LifeBuoy, 'support'),
            ],
          },
        ]
      : isLoggedIn && currentRole === 'customer'
        ? [{
            label: 'Your marketplace',
            items: [
              primaryItem(t('shop'), ShoppingBag, 'storefront'),
              primaryItem(t('topCharts'), Flame, 'charts'),
              primaryItem(t('orders'), PackageCheck, 'orders'),
              primaryItem(t('liveTracking'), Radio, 'live-tracking'),
              primaryItem(t('profile'), User, 'profile'),
              primaryItem(t('support'), LifeBuoy, 'support'),
            ],
          }]
        : isLoggedIn && currentRole === 'seller'
          ? [{
              label: 'Seller',
              items: [
                primaryItem(t('sellerStudio'), Store, 'seller-dashboard'),
                primaryItem(t('storefront'), ShoppingBag, 'storefront'),
                primaryItem(t('support'), LifeBuoy, 'support'),
              ],
            }]
          : isLoggedIn && currentRole === 'admin'
            ? [{
                label: 'Administration',
                items: [
                  primaryItem(t('adminDashboard'), ShieldCheck, 'admin-dashboard'),
                  primaryItem(t('storefront'), ShoppingBag, 'storefront'),
                  primaryItem(t('support'), LifeBuoy, 'support'),
                ],
              }]
            : isLoggedIn && currentRole === 'rider'
              ? [{
                  label: 'Delivery',
                  items: [
                    primaryItem(t('deliveries'), Truck, 'rider-dashboard'),
                    primaryItem(t('support'), LifeBuoy, 'support'),
                  ],
                }]
              : [
                  {
                    label: 'Explore',
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
                    label: 'Portals',
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
    <nav aria-label="Workspace navigation" className="space-y-6">
      {sections.map((section) => (
        <section key={section.label} aria-label={section.label} className="space-y-1">
          <h2 className="px-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-surface-500 dark:text-surface-400">
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
                  className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#80734f] dark:focus-visible:outline-[#d0c8a5] focus-visible:ring-2 focus-visible:ring-[#a99b72] ${
                    isActive
                      ? 'bg-[#d0c8a5]/35 text-[#4f4720] dark:bg-[#d0c8a5]/15 dark:text-[#e8dfbd]'
                      : 'text-surface-700 hover:bg-surface-100 hover:text-surface-950 dark:text-surface-300 dark:hover:bg-[#181F2A] dark:hover:text-white'
                  }`}
                >
                  <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#80734f] dark:text-[#d0c8a5]' : 'text-surface-500 dark:text-surface-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[0.65rem] font-bold text-warning-900 dark:bg-warning-950/60 dark:text-warning-200">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#80734f] dark:bg-[#d0c8a5]" />}
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
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-[#80734f]/20 bg-[#f6f5ef] px-3 py-5 dark:border-white/10 dark:bg-[#10100f] md:flex">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {renderNavigation()}
        </div>
        <div className="mt-4 border-t border-[#80734f]/15 px-3 pt-4 text-xs text-surface-500 dark:border-white/10 dark:text-surface-400">
          <p className="font-semibold text-surface-700 dark:text-surface-200">ShopNiro</p>
          <p className="mt-1">Marketplace workspace</p>
        </div>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-black/45"
          />
          <div
            ref={mobileDrawerRef}
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            tabIndex={-1}
            className="relative flex h-full w-[min(19rem,calc(100vw-3rem))] flex-col border-r border-[#80734f]/20 bg-[#f6f5ef] px-3 py-4 shadow-xl dark:border-white/10 dark:bg-[#10100f]"
          >
            <div className="mb-5 flex items-center justify-between border-b border-[#80734f]/15 px-2 pb-3 dark:border-white/10">
              <span className="font-display text-lg text-[#0f1f1d] dark:text-white">ShopNiro</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="grid h-10 w-10 place-items-center rounded-lg text-surface-600 hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a99b72] dark:text-surface-300 dark:hover:bg-[#181F2A]"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {renderNavigation()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
