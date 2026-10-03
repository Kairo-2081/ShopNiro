export const normalizeVoucherCode = (value: string) => value.trim().toUpperCase();
export const isVoucherExpired = (expiresAt?: string | Date | null, now = Date.now()) => {
  if (!expiresAt) return false;
  const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isFinite(expiryTime) && expiryTime <= now;
};
export const getVoucherCountdownLabel = (expiresAt?: string | Date | null, now = Date.now()) => {
  if (!expiresAt) return null;
  const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  if (!Number.isFinite(expiryTime) || expiryTime <= now) return null;
  const totalHours = Math.ceil((expiryTime - now) / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `Offer ends in ${days}d ${hours}h` : `Offer ends in ${totalHours}h`;
};

export interface VoucherRule {
  kind: 'percent' | 'fixed';
  amount: number;
  firstOrderOnly?: boolean;
}

const campaignVouchers: Record<string, VoucherRule> = {
  SAVE20: { kind: 'percent', amount: 20 },
  TECH10: { kind: 'fixed', amount: 10 },
  BREW15: { kind: 'percent', amount: 15 },
  NEW20: { kind: 'percent', amount: 20, firstOrderOnly: true },
};

export const getVoucherRule = (value: string): VoucherRule | null => {
  const code = normalizeVoucherCode(value);
  const campaignRule = campaignVouchers[code];
  if (campaignRule) return campaignRule;

  const match = code.match(/(\d+(?:\.\d+)?)(?=\D*$)/);
  if (!match) return null;
  const percent = Number(match[1]);
  return Number.isFinite(percent) && percent > 0 && percent <= 100
    ? { kind: 'percent', amount: percent }
    : null;
};

export const getVoucherDiscountPercent = (value: string): number | null => {
  const rule = getVoucherRule(value);
  return rule?.kind === 'percent' ? rule.amount : null;
};

export const discountedUnitPrice = (price: number, percent: number) =>
  Math.round((price * (1 - percent / 100) + Number.EPSILON) * 100) / 100;

export const discountedPriceForVoucher = (price: number, voucher: string) => {
  const rule = getVoucherRule(voucher);
  if (!rule) return Math.round(price * 100) / 100;
  if (rule.kind === 'fixed') return Math.max(0, Math.round((price - rule.amount + Number.EPSILON) * 100) / 100);
  return discountedUnitPrice(price, rule.amount);
};

export const describeVoucher = (voucher: string) => {
  const rule = getVoucherRule(voucher);
  if (!rule) return 'Discount applies to matching products.';
  if (rule.firstOrderOnly) return `${rule.amount}% off matching products for your first order.`;
  return rule.kind === 'fixed'
    ? `৳${rule.amount} off each matching item.`
    : `${rule.amount}% off matching products.`;
};