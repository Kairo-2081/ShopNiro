import React from 'react';

export type Locale = 'en' | 'bn';
export type MessageKey = keyof typeof messages.en;

const messages = {
  en: {
    shop: 'Shop',
    topCharts: 'Top charts',
    orders: 'Orders',
    profile: 'Profile',
    support: 'Support',
    browse: 'Browse',
    account: 'Account',
    deliveries: 'Deliveries',
    storefront: 'Storefront',
    storefrontCatalog: 'Storefront catalog',
    myOrders: 'My orders',
    liveTracking: 'Live tracking',
    sellerStudio: 'Seller Studio',
    adminDashboard: 'Admin dashboard',
    shopSmart: 'Shop smart,',
    shipFast: 'ship fast.',
    catalogIntro: 'Explore authentic merchandise across categories with real-time stock levels, verified reviews, and instant order tracking.',
    allProducts: 'All catalog products',
    showingListings: 'verified listings',
    noProducts: 'No products found',
    adjustFilters: 'Try adjusting your search, price, or stock filters.',
    resetFilters: 'Reset catalog filters',
    orderHistory: 'Order history and tracking',
    trackingPlaceholder: 'Filter by tracking ID',
    noSearchOrders: 'No orders match your search criteria.',
    ordersEmptyPrompt: 'You have not placed any orders yet.',
    shippingAddress: 'Shipping address',
    paymentMethod: 'Choose a payment method',
    reviewOrder: 'Review order',
    signIn: 'Sign in',
    logOut: 'Log out',
    language: 'বাংলা',
    address: 'Address',
    payment: 'Payment',
    review: 'Review',
    noOrders: 'No orders yet',
    noOrdersFound: 'No orders found',
    browseProducts: 'Browse products',
    emptyCart: 'Your shopping cart is empty',
    emptyCartPrompt: 'Explore the storefront catalog to add items.',
    retry: 'Retry',
  },
  bn: {
    shop: 'দোকান',
    topCharts: 'জনপ্রিয়',
    orders: 'অর্ডার',
    profile: 'প্রোফাইল',
    support: 'সহায়তা',
    browse: 'ব্রাউজ',
    account: 'অ্যাকাউন্ট',
    deliveries: 'ডেলিভারি',
    storefront: 'দোকান',
    storefrontCatalog: 'দোকানের পণ্য',
    myOrders: 'আমার অর্ডার',
    liveTracking: 'লাইভ ট্র্যাকিং',
    sellerStudio: 'বিক্রেতা স্টুডিও',
    adminDashboard: 'অ্যাডমিন ড্যাশবোর্ড',
    shopSmart: 'স্মার্ট কেনাকাটা,',
    shipFast: 'দ্রুত ডেলিভারি।',
    catalogIntro: 'বিভিন্ন পণ্যের বিভাগ দেখুন, স্টক, যাচাইকৃত রিভিউ এবং অর্ডার ট্র্যাকিংসহ।',
    allProducts: 'সব পণ্য',
    showingListings: 'যাচাইকৃত পণ্য',
    noProducts: 'কোনো পণ্য পাওয়া যায়নি',
    adjustFilters: 'সার্চ, দাম বা স্টক ফিল্টার পরিবর্তন করে দেখুন।',
    resetFilters: 'ফিল্টার মুছুন',
    orderHistory: 'অর্ডার ইতিহাস ও ট্র্যাকিং',
    trackingPlaceholder: 'ট্র্যাকিং আইডি দিয়ে খুঁজুন',
    noSearchOrders: 'আপনার সার্চের সাথে কোনো অর্ডার মেলেনি।',
    ordersEmptyPrompt: 'আপনি এখনও কোনো অর্ডার করেননি।',
    shippingAddress: 'ডেলিভারির ঠিকানা',
    paymentMethod: 'পেমেন্ট পদ্ধতি বেছে নিন',
    reviewOrder: 'অর্ডার পর্যালোচনা',
    signIn: 'সাইন ইন',
    logOut: 'লগ আউট',
    language: 'English',
    address: 'ঠিকানা',
    payment: 'পেমেন্ট',
    review: 'পর্যালোচনা',
    noOrders: 'এখনও কোনো অর্ডার নেই',
    noOrdersFound: 'কোনো অর্ডার পাওয়া যায়নি',
    browseProducts: 'পণ্য দেখুন',
    emptyCart: 'আপনার কার্ট খালি',
    emptyCartPrompt: 'পণ্য যোগ করতে দোকান দেখুন।',
    retry: 'আবার চেষ্টা করুন',
  },
} as const;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = React.createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: (key) => messages.en[key],
});

export const LocaleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    const stored = window.localStorage.getItem('shopniro_locale');
    return stored === 'bn' ? 'bn' : 'en';
  });

  const setLocale = React.useCallback((nextLocale: Locale) => {
    window.localStorage.setItem('shopniro_locale', nextLocale);
    setLocaleState(nextLocale);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale === 'bn' ? 'bn' : 'en';
  }, [locale]);

  const value = React.useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key) => messages[locale][key],
  }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => React.useContext(LocaleContext);
