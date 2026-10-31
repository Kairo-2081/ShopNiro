// Checkout pricing shared by the server (which charges it) and the browser (which previews it), so the
// two cannot disagree. Pure: no database, no clock. Amounts are handled in whole paisa internally and
// converted to and from the NUMERIC(10,2) values the database stores only at the edges.
import type { ProductBundle } from '../types';
import { calculateBundlePrices } from './bundles';
import { discountedPriceForVoucher, discountedUnitPrice } from './vouchers';

export interface CheckoutPricingItem {
  Product_ID: string;
  Price: number;
  Quantity: number;
}

export interface CheckoutPricingResult {
  subtotal: number;
  shippingFee: number;
  cartDiscountEligible: boolean;
  /** Cart value at list prices. The cart discount and shipping rules are decided on this. */
  originalSubtotalCents: number;
  /** After the product voucher, before bundles. */
  voucherSubtotalCents: number;
  /** After bundles, before the cart discount. */
  bundleSubtotalCents: number;
  /** After every discount, before shipping. */
  subtotalCents: number;
  shippingFeeCents: number;
  unitPrices: Map<string, number>;
  appliedBundleIds: string[];
}

// Checkout rules, in paisa. They live here so the numbers are named and changed in one place.
export const FREE_SHIPPING_THRESHOLD_CENTS = 40_000;
export const CART_DISCOUNT_THRESHOLD_CENTS = 50_000;
export const SHIPPING_FEE_CENTS = 500;
export const CART_DISCOUNT_PERCENT = 5;
export const PLATFORM_COMMISSION_PERCENT = 15;

const toCents = (amount: number | string): number => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    throw new RangeError('Order amounts must be finite numbers.');
  }
  return Math.round((numericAmount + Number.EPSILON) * 100);
};

const fromCents = (amount: number): number => amount / 100;

export const toPaisa = toCents;
export const fromPaisa = fromCents;

/** Shipping for a cart whose list-price subtotal is the given number of paisa. Empty carts ship free. */
export const shippingFeeCentsFor = (originalSubtotalCents: number): number =>
  originalSubtotalCents === 0 || originalSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FEE_CENTS;

/** Platform commission on a seller subtotal, rounded to the paisa like the SQL platform_commission(). */
export const platformCommission = (subtotal: number | string): number =>
  fromCents(Math.round((toCents(subtotal) * PLATFORM_COMMISSION_PERCENT) / 100));

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
  const cartDiscountEligible = originalSubtotalCents >= CART_DISCOUNT_THRESHOLD_CENTS;
  const shippingFeeCents = shippingFeeCentsFor(originalSubtotalCents);
  const voucherPrices = items.map((item) => ({
    Product_ID: item.Product_ID,
    Price: eligibleVoucherProductIds.has(item.Product_ID)
      ? discountedPriceForVoucher(item.Price, voucherCode)
      : item.Price,
    Quantity: item.Quantity,
  }));
  const voucherSubtotalCents = voucherPrices.reduce(
    (total, item) => total + toCents(item.Price) * item.Quantity,
    0
  );
  const bundlePricing = calculateBundlePrices(voucherPrices, bundles);
  const unitPrices = new Map<string, number>();
  let bundleSubtotalCents = 0;
  let subtotalCents = 0;

  items.forEach((item) => {
    const bundlePrice = bundlePricing.unitPrices.get(item.Product_ID) ?? item.Price;
    bundleSubtotalCents += toCents(bundlePrice) * item.Quantity;
    const discountedPrice = cartDiscountEligible ? discountedUnitPrice(bundlePrice, CART_DISCOUNT_PERCENT) : bundlePrice;
    const unitPriceCents = toCents(discountedPrice);
    unitPrices.set(item.Product_ID, fromCents(unitPriceCents));
    subtotalCents += unitPriceCents * item.Quantity;
  });

  return {
    subtotal: fromCents(subtotalCents),
    shippingFee: fromCents(shippingFeeCents),
    cartDiscountEligible,
    originalSubtotalCents,
    voucherSubtotalCents,
    bundleSubtotalCents,
    subtotalCents,
    shippingFeeCents,
    unitPrices,
    appliedBundleIds: bundlePricing.appliedBundleIds,
  };
};
