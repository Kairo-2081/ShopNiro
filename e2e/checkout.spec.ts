import { expect, test, type Page } from '@playwright/test';
import { E2E } from './seed.ts';
import {
  addToCart, blockNonLocalTraffic, clearCartAndOrders, countOrders, latestOrder, openCheckout, openStorefront, parseMoney, seedCart,
} from './helpers.ts';

const { blanket, dripper, lamp, voucher } = E2E.products;

test.beforeEach(async ({ page }) => {
  await clearCartAndOrders();
  await blockNonLocalTraffic(page);
});

async function placeCodOrder(page: Page) {
  await page.getByText('Cash on Delivery (COD)').click();
  await page.getByRole('checkbox').check();
  const shownTotal = parseMoney(await page.getByTestId('checkout-total').innerText());
  await page.getByRole('button', { name: /Confirm Order \(Cash on Delivery\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Order Placed' })).toBeVisible();
  const order = await latestOrder();
  expect(order, 'the order was recorded').toBeTruthy();
  // The check that matters: what the screen promised equals what the server charged.
  expect(shownTotal).toBeCloseTo(order!.subtotal + order!.shipping_fee, 2);
  return { shownTotal, order: order! };
}

test('a small cart pays shipping', async ({ page }) => {
  await openStorefront(page);
  // The one test that adds through the real button instead of the database.
  await openStorefront(page);
  await addToCart(page, blanket.id);
  await openCheckout(page);
  const { shownTotal, order } = await placeCodOrder(page);
  expect(shownTotal).toBe(73);
  expect(order.shipping_fee).toBe(5);
  expect(order.payment_method).toBe('cash_on_delivery');
});

test('a cart of 400 or more ships free', async ({ page }) => {
  await seedCart({ [lamp.id]: 1, [blanket.id]: 2 });
  await openStorefront(page);
  await openCheckout(page);
  const { shownTotal, order } = await placeCodOrder(page);
  expect(order.shipping_fee).toBe(0);
  expect(shownTotal).toBe(436);
});

test('a cart of 500 or more gets 5% off and free shipping', async ({ page }) => {
  await seedCart({ [dripper.id]: 13 });
  await openStorefront(page);
  await openCheckout(page);
  await expect(page.getByText(/CART5 applied/)).toBeVisible();
  const { shownTotal, order } = await placeCodOrder(page);
  expect(shownTotal).toBe(555.75);
  expect(order.shipping_fee).toBe(0);
  expect(order.applied_voucher).toContain('CART5');
});

test('a product voucher lowers the price the server charges', async ({ page }) => {
  await seedCart({ [voucher.id]: 1 });
  await openStorefront(page);
  await openCheckout(page);
  await page.getByPlaceholder(/SAVE20/).fill(voucher.code);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('checkout-total')).toContainText('85');
  const { shownTotal, order } = await placeCodOrder(page);
  expect(shownTotal).toBe(85);
  expect(order.subtotal).toBe(80);
});

test('an unknown voucher is rejected and changes no price', async ({ page }) => {
  await seedCart({ [blanket.id]: 1 });
  await openStorefront(page);
  await openCheckout(page);
  await page.getByPlaceholder(/SAVE20/).fill('NOPE99');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/does not match a voucher/)).toBeVisible();
  await expect(page.getByTestId('checkout-total')).toContainText('73');
});

test('double clicking the confirm button creates one order', async ({ page }) => {
  await seedCart({ [blanket.id]: 1 });
  await openStorefront(page);
  await openCheckout(page);
  await page.getByText('Cash on Delivery (COD)').click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Confirm Order \(Cash on Delivery\)/ }).dblclick();
  await expect(page.getByRole('heading', { name: 'Order Placed' })).toBeVisible();
  expect(await countOrders()).toBe(1);
});
