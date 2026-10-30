import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCheckoutPricing, calculateLineItemsSubtotal, calculateOrderTotal } from '../server/lib/orderPricing.ts';
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
