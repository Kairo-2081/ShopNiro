import { expect, test, type Page } from '@playwright/test';
import { E2E } from './seed.ts';
import {
  ageLatestPayment, blockNonLocalTraffic, cartQuantity, clearCartAndOrders, latestOrder, latestPayment, openCheckout, openStorefront,
  parseMoney, productStock, seedCart,
} from './helpers.ts';

const { blanket } = E2E.products;

test.beforeEach(async ({ page }) => {
  await clearCartAndOrders();
  await blockNonLocalTraffic(page);
});

// Uses the server's built-in fake gateway (PAYMENT_SIMULATOR, test mode only). Nothing leaves localhost.
async function startBkashPayment(page: Page) {
  await seedCart({ [blanket.id]: 1 });
  await openStorefront(page);
  await openCheckout(page);
  await page.getByRole('checkbox').check();
  const shownTotal = parseMoney(await page.getByTestId('checkout-total').innerText());
  await page.getByRole('button', { name: /Pay with bKash/ }).click();
  await page.getByRole('button', { name: /Continue to SSLCommerz/ }).click();
  await expect(page.getByRole('heading', { name: /payment demo/ })).toBeVisible();
  return shownTotal;
}

test('paying online through the gateway marks the order paid for the amount shown', async ({ page }) => {
  const shownTotal = await startBkashPayment(page);
  await expect(page.getByText(`BDT ${shownTotal.toFixed(2)}`)).toBeVisible();
  await page.getByRole('button', { name: 'Complete demo payment' }).click();

  await expect(page.getByText(/Payment complete/)).toBeVisible();
  const order = await latestOrder();
  const payment = await latestPayment();
  expect(order?.payment_status).toBe('paid');
  expect(payment?.status).toBe('VALIDATED');
  expect(payment?.amount).toBeCloseTo(shownTotal, 2);
  expect(order!.subtotal + order!.shipping_fee).toBeCloseTo(shownTotal, 2);
  expect(await cartQuantity(blanket.id), 'a paid order empties the cart').toBe(0);
});

// The server refuses to restore the cart while a gateway confirmation could still arrive (30 minutes).
// These tests pin both sides of that rule, so a change to it is deliberate.
test('leaving the gateway early keeps the order on hold and tells the customer to wait', async ({ page }) => {
  const stockBefore = await productStock(blanket.id);
  await startBkashPayment(page);
  await page.getByRole('link', { name: 'Simulate failed payment' }).click();

  await expect(page.getByText(/Payment is still being confirmed/)).toBeVisible();
  expect((await latestOrder())?.payment_status).toBe('pending');
  expect(await cartQuantity(blanket.id)).toBe(0);
  expect(await productStock(blanket.id)).toBe(stockBefore - 1);
});

test('a failed payment after the confirmation window returns the items to the cart and the stock', async ({ page }) => {
  const stockBefore = await productStock(blanket.id);
  await startBkashPayment(page);
  await ageLatestPayment(31);
  await page.getByRole('link', { name: 'Simulate failed payment' }).click();

  await expect(page.getByText(/Payment failed\. Your items are back in your cart/)).toBeVisible();
  expect((await latestOrder())?.payment_status).not.toBe('paid');
  expect(await cartQuantity(blanket.id)).toBe(1);
  expect(await productStock(blanket.id)).toBe(stockBefore);
});

test('cancelling at the gateway after the window also restores the cart', async ({ page }) => {
  await startBkashPayment(page);
  await ageLatestPayment(31);
  await page.getByRole('link', { name: 'Cancel payment' }).click();

  await expect(page.getByText(/Payment cancelled\. Your items are back in your cart/)).toBeVisible();
  expect(await cartQuantity(blanket.id)).toBe(1);
});

test('wrong demo details are rejected and the order stays unpaid', async ({ page }) => {
  await startBkashPayment(page);
  await page.getByLabel('Demo PIN').fill('00000');
  await page.getByRole('button', { name: 'Complete demo payment' }).click();

  await expect(page.getByRole('alert')).toContainText(/did not match/);
  expect((await latestOrder())?.payment_status).not.toBe('paid');
  expect((await latestPayment())?.status).toBe('PENDING');
});
