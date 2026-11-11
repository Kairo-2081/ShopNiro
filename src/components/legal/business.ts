// Facts the policies quote. Edit here, not in the policy text.
// Anything marked REVIEW must be confirmed by the business owner and a lawyer.
export const BUSINESS = {
  /** ShopNiro is a brand; it is not registered as ShopNiro Ltd. */
  name: 'ShopNiro',
  supportEmail: 'shopnirosupport@gmail.com',
  /** Do not publish an unverified personal or campus address as a business address. */
  address: 'Operator details and authorized service address pending',
  addressBn: 'পরিচালনাকারীর বিবরণ ও অনুমোদিত সেবার ঠিকানা নির্ধারণাধীন',
  siteUrl: 'https://shopniro.onrender.com',
  lastUpdated: '9 November 2026',
  freeShippingThresholdBDT: 400,
  unpaidOnlineOrderMinutes: 30,
  /** REVIEW: only quote a refund window you can actually meet. */
  refundBusinessDays: '7 to 10',
  sellerCommissionPercent: 15,
  sellerPayoutHoldDays: 7,
  /** Shown as a banner on every policy page until a lawyer has signed off. Set to false after review. */
  showDraftBanner: true,
} as const;
