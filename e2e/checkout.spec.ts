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
  await page.getByTestId('checkout-submit').click();
  await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
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
  await page.getByTestId('checkout-submit').dblclick();
  await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
  expect(await countOrders()).toBe(1);
});

test('a first order completes at 360px with the total and pay action pinned together', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedCart({ [blanket.id]: 1 });
  await openStorefront(page);
  await openCheckout(page);

  const checkout = page.getByRole('dialog', { name: 'Direct Checkout & Payment' });
  await expect(checkout.getByRole('navigation', { name: 'Checkout steps' })).toBeVisible();
  for (const step of ['Address', 'Payment', 'Review']) {
    await expect(checkout.getByRole('navigation', { name: 'Checkout steps' })).toContainText(step);
  }
  await expect(page.getByRole('button', { name: 'Open ShopNiro AI Assistant' })).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

  const footer = page.getByTestId('checkout-action-footer');
  const submit = page.getByTestId('checkout-submit');
  const footerBounds = await footer.boundingBox();
  const submitBounds = await submit.boundingBox();
  const totalBounds = await page.getByTestId('checkout-footer-total').boundingBox();
  expect(footerBounds?.height).toBeLessThanOrEqual(100);
  expect(submitBounds?.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs((submitBounds?.y || 0) + (submitBounds?.height || 0) / 2 - ((totalBounds?.y || 0) + (totalBounds?.height || 0) / 2))).toBeLessThanOrEqual(12);

  for (const button of await checkout.getByRole('button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }

  for (const inputId of ['checkout-house', 'checkout-street', 'checkout-city', 'checkout-postal']) {
    const bounds = await page.locator(`#${inputId}`).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('button', { name: 'Select cash on delivery as payment method' }).click();
  await checkout.getByRole('checkbox').check();
  await page.route('**/api/orders', async (route) => {
    if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toContainText('Processing');
  await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Direct Checkout & Payment' }).getByRole('button')).toHaveCount(1);

  await page.getByRole('button', { name: 'View order' }).click();
  const receiptButton = page.getByRole('button', { name: 'View SSLCommerz Receipt' });
  await expect(receiptButton).toBeVisible();
  await receiptButton.click();
  const receipt = page.getByRole('dialog', { name: 'ShopNiro Marketplace BD' });
  await expect(receipt).toContainText('Cash on delivery');
  await expect(receipt).toContainText((await latestOrder())!.id);
  const downloadPromise = page.waitForEvent('download');
  await receipt.getByRole('button', { name: 'Download receipt as HTML' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^ShopNiro-receipt-.*\.html$/);
});

test('the secure payment phone field opens a telephone keyboard with autofill', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedCart({ [blanket.id]: 1 });
  await openStorefront(page);
  await openCheckout(page);
  await page.getByRole('checkbox').check();
  await page.getByTestId('checkout-submit').click();

  const gateway = page.getByRole('dialog', { name: 'SSLCOMMERZ' });
  const phone = gateway.getByLabel('Your bKash Account Number');
  await expect(phone).toHaveAttribute('inputmode', 'tel');
  await expect(phone).toHaveAttribute('autocomplete', 'tel');
});
