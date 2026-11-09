// Facts the policies quote. Edit here, not in the policy text.
// Anything marked REVIEW must be confirmed by the business owner and a lawyer.
export const BUSINESS = {
  /** REVIEW: the registered legal name / trade licence holder, once you have one. */
  name: 'ShopNiro',
  supportEmail: 'shopnirosupport@gmail.com',
  /** REVIEW: replace after registration; do not present this as a registered address. */
  address: 'Business registration and registered address pending',
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
