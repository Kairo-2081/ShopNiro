export const normalizeVoucherCode = (value: string) => value.trim().toUpperCase();

export const getVoucherDiscountPercent = (value: string): number | null => {
  const match = value.trim().match(/(\d+(?:\.\d+)?)(?=\D*$)/);
  if (!match) return null;
  const percent = Number(match[1]);
  return Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : null;
};

export const discountedUnitPrice = (price: number, percent: number) =>
  Math.round((price * (1 - percent / 100) + Number.EPSILON) * 100) / 100;