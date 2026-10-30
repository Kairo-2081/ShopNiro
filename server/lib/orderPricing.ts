import type { ProductBundle } from '../../src/types.ts';
import { calculateBundlePrices } from '../../src/lib/bundles.ts';
import { discountedPriceForVoucher, discountedUnitPrice } from '../../src/lib/vouchers.ts';

export interface CheckoutPricingItem {
  Product_ID: string;
  Price: number;
  Quantity: number;
}

export interface CheckoutPricingResult {
  subtotal: number;
  shippingFee: number;
  cartDiscountEligible: boolean;
  unitPrices: Map<string, number>;
  appliedBundleIds: string[];
}

const toCents = (amount: number | string): number => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    throw new RangeError('Order amounts must be finite numbers.');
  }
  return Math.round((numericAmount + Number.EPSILON) * 100);
};

const fromCents = (amount: number): number => amount / 100;

export const calculateOrderTotal = (subtotal: number | string, shippingFee: number | string): number =>
  fromCents(toCents(subtotal) + toCents(shippingFee));

export const calculateLineItemsSubtotal = (items: { unitPrice: number | string; quantity: number }[]): number =>
  fromCents(items.reduce((total, item) => total + toCents(item.unitPrice) * item.quantity, 0));

export const calculateCheckoutPricing = (
  items: CheckoutPricingItem[],
  eligibleVoucherProductIds: ReadonlySet<string>,
  voucherCode: string,
  bundles: ProductBundle[]
): CheckoutPricingResult => {
  const originalSubtotalCents = items.reduce(
    (total, item) => total + toCents(item.Price) * item.Quantity,
    0
  );
  const cartDiscountEligible = originalSubtotalCents >= 50_000;
  const shippingFeeCents = originalSubtotalCents === 0 || originalSubtotalCents >= 40_000 ? 0 : 500;
  const voucherPrices = items.map((item) => ({
    Product_ID: item.Product_ID,
    Price: eligibleVoucherProductIds.has(item.Product_ID)
      ? discountedPriceForVoucher(item.Price, voucherCode)
      : item.Price,
    Quantity: item.Quantity,
  }));
  const bundlePricing = calculateBundlePrices(voucherPrices, bundles);
  const unitPrices = new Map<string, number>();
  let subtotalCents = 0;

  items.forEach((item) => {
    const bundlePrice = bundlePricing.unitPrices.get(item.Product_ID) ?? item.Price;
    const discountedPrice = cartDiscountEligible ? discountedUnitPrice(bundlePrice, 5) : bundlePrice;
    const unitPriceCents = toCents(discountedPrice);
    unitPrices.set(item.Product_ID, fromCents(unitPriceCents));
    subtotalCents += unitPriceCents * item.Quantity;
  });

  return {
    subtotal: fromCents(subtotalCents),
    shippingFee: fromCents(shippingFeeCents),
    cartDiscountEligible,
    unitPrices,
    appliedBundleIds: bundlePricing.appliedBundleIds,
  };
};
