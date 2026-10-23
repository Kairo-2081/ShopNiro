// Facts the policies quote. Edit here, not in the policy text.
// Anything marked REVIEW must be confirmed by the business owner and a lawyer.
export const BUSINESS = {
  /** REVIEW: the registered legal name / trade licence holder, once you have one. */
  name: 'ShopNiro',
  supportEmail: 'shopnirosupport@gmail.com',
  /** REVIEW: registered or operating address required by most merchant-account reviews. */
  address: 'Dhaka, Bangladesh',
  siteUrl: 'https://shopniro.onrender.com',
  lastUpdated: '23 October 2026',
  freeShippingThresholdBDT: 400,
  unpaidOnlineOrderMinutes: 30,
  /** REVIEW: only quote a refund window you can actually meet. */
  refundBusinessDays: '7 to 10',
  sellerCommissionPercent: 15,
  sellerPayoutHoldDays: 7,
  /** Shown as a banner on every policy page until a lawyer has signed off. Set to false after review. */
  showDraftBanner: true,
} as const;
