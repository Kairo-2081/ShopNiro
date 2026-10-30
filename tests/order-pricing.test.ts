import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCheckoutPricing, calculateLineItemsSubtotal, calculateOrderTotal } from '../server/lib/orderPricing.ts';
import { calculateBundlePrices } from '../src/lib/bundles.ts';
import { discountedPriceForVoucher, discountedUnitPrice } from '../src/lib/vouchers.ts';
import type { ProductBundle } from '../src/types.ts';

const bundle = (overrides: Partial<ProductBundle> = {}): ProductBundle => ({
  Bundle_ID: 'BUNDLE-1',
  Seller_ID: 'SELLER-1',
  Name: 'Test bundle',
  Product_IDs: ['PRODUCT-1', 'PRODUCT-2'],
  Discount_Percent: 10,
  Active: true,
  ...overrides,
});

test('checkout pricing applies rounded, stacked discounts in order', () => {
  const cases = [
    {
      name: 'rounds discounted unit prices before calculating the subtotal',
      items: [{ Product_ID: 'PRODUCT-1', Price: 0.29, Quantity: 3 }],
      eligibleVoucherProductIds: new Set(['PRODUCT-1']),
      voucherCode: 'TEN10',
      bundles: [],
      expected: { subtotal: 0.78, shippingFee: 5, cartDiscountEligible: false },
    },
    {
      name: 'stacks a product voucher, bundle, and cart discount',
      items: [
        { Product_ID: 'PRODUCT-1', Price: 100, Quantity: 3 },
        { Product_ID: 'PRODUCT-2', Price: 100, Quantity: 3 },
      ],
      eligibleVoucherProductIds: new Set(['PRODUCT-1']),
      voucherCode: 'SAVE20',
      bundles: [bundle()],
      expected: { subtotal: 461.7, shippingFee: 0, cartDiscountEligible: true },
    },
    {
      name: 'keeps zero-price lines at zero and waives shipping for a zero total',
      items: [{ Product_ID: 'PRODUCT-1', Price: 0, Quantity: 2 }],
      eligibleVoucherProductIds: new Set(['PRODUCT-1']),
      voucherCode: 'SAVE20',
      bundles: [],
      expected: { subtotal: 0, shippingFee: 0, cartDiscountEligible: false },
    },
  ];

  for (const pricingCase of cases) {
    const result = calculateCheckoutPricing(
      pricingCase.items,
      pricingCase.eligibleVoucherProductIds,
      pricingCase.voucherCode,
      pricingCase.bundles
    );
    assert.equal(result.subtotal, pricingCase.expected.subtotal, pricingCase.name);
    assert.equal(result.shippingFee, pricingCase.expected.shippingFee, pricingCase.name);
    assert.equal(result.cartDiscountEligible, pricingCase.expected.cartDiscountEligible, pricingCase.name);
  }
});

test('order total combines subtotal and shipping fee using cents', () => {
  const cases = [
    { subtotal: '123.45', shippingFee: '5.00', expected: 128.45 },
    { subtotal: '0.10', shippingFee: '0.20', expected: 0.3 },
    { subtotal: '0.00', shippingFee: '0.00', expected: 0 },
  ];

  for (const totalCase of cases) {
    assert.equal(calculateOrderTotal(totalCase.subtotal, totalCase.shippingFee), totalCase.expected);
  }
  assert.throws(() => calculateOrderTotal('invalid', '5.00'), RangeError);
});

test('line item subtotal sums rounded unit prices without floating-point drift', () => {
  assert.equal(calculateLineItemsSubtotal([
    { unitPrice: '0.10', quantity: 1 },
    { unitPrice: '0.20', quantity: 1 },
  ]), 0.3);
});

// The checkout code before it was centralised, copied verbatim as an oracle. The refactor must not change
// what any customer is charged, so the new function is compared with it on many random carts.
const legacyPricing = (
  items: { Product_ID: string; Price: number; Quantity: number }[],
  eligible: ReadonlySet<string>,
  voucherCode: string,
  bundles: ProductBundle[]
) => {
  const originalSubtotal = items.reduce((total, item) => total + (Number(item.Price) || 0) * Number(item.Quantity), 0);
  const cartDiscountEligible = originalSubtotal >= 500;
  const shippingFee = originalSubtotal >= 400 ? 0 : 5;
  const bundlePricing = calculateBundlePrices(items.map((item) => ({
    Product_ID: item.Product_ID,
    Price: eligible.has(item.Product_ID) ? discountedPriceForVoucher(Number(item.Price) || 0, voucherCode) : Number(item.Price) || 0,
    Quantity: Number(item.Quantity) || 0,
  })), bundles);
  const unitPrices = new Map<string, number>();
  for (const item of items) {
    const originalPrice = Number(item.Price) || 0;
    const voucherPrice = eligible.has(item.Product_ID) ? discountedPriceForVoucher(originalPrice, voucherCode) : originalPrice;
    const bundlePrice = bundlePricing.unitPrices.get(item.Product_ID) ?? voucherPrice;
    unitPrices.set(item.Product_ID, cartDiscountEligible ? discountedUnitPrice(bundlePrice, 5) : bundlePrice);
  }
  return { shippingFee, cartDiscountEligible, unitPrices, appliedBundleIds: bundlePricing.appliedBundleIds };
};

test('centralised pricing matches the previous inline pricing on random carts', () => {
  let seed = 20261030;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(values: T[]) => values[Math.floor(random() * values.length)];
  const voucherCodes = ['SAVE20', 'TECH10', 'BREW15', 'NEW20', 'TEN10', 'ABC50'];
  let zeroCartDifferences = 0;

  for (let round = 0; round < 2000; round += 1) {
    const lineCount = 1 + Math.floor(random() * 4);
    const items = Array.from({ length: lineCount }, (_, index) => ({
      Product_ID: `PRODUCT-${index + 1}`,
      // Prices with whole taka and two-decimal prices (the database column is NUMERIC(10,2)), including a few at the 400 and 500 boundaries.
      Price: pick([0.01, 0.29, 5, 68, 99.99, 100, 133.33, 285, 399.99, 400, 499.99, 500, 1250.5]),
      Quantity: 1 + Math.floor(random() * 4),
    }));
    const eligible = new Set(items.filter(() => random() < 0.5).map((item) => item.Product_ID));
    const bundles = random() < 0.5 && items.length >= 2
      ? [bundle({ Product_IDs: [items[0].Product_ID, items[1].Product_ID], Discount_Percent: pick([5, 10, 33]) })]
      : [];
    const voucherCode = pick(voucherCodes);

    const next = calculateCheckoutPricing(items, eligible, voucherCode, bundles);
    const previous = legacyPricing(items, eligible, voucherCode, bundles);
    const label = JSON.stringify({ items, voucherCode, bundles: bundles.length });

    assert.equal(next.cartDiscountEligible, previous.cartDiscountEligible, label);
    assert.deepEqual(next.appliedBundleIds, previous.appliedBundleIds, label);
    for (const item of items) {
      assert.equal(
        next.unitPrices.get(item.Product_ID),
        Math.round((previous.unitPrices.get(item.Product_ID)! + Number.EPSILON) * 100) / 100,
        label
      );
    }
    if (next.shippingFee !== previous.shippingFee) {
      // The one intended change: a zero-value cart no longer pays shipping.
      zeroCartDifferences += 1;
      assert.equal(items.reduce((total, item) => total + item.Price * item.Quantity, 0), 0, label);
    }
  }
  assert.equal(zeroCartDifferences, 0, 'random carts never have a zero subtotal, so shipping must match exactly');
});
