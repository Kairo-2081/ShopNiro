import { expect, test } from '@playwright/test';
import type { Address, Order, PaymentStatus } from '../src/types.ts';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic } from './helpers.ts';

const address: Address = {
  Street: 'Market Road',
  House_Name: 'Shop 1',
  City: 'Dhaka',
  Postal_Code: '1207',
};

function makeOrder(id: string, status: Order['Status'], paymentStatus: PaymentStatus): Order {
  return {
    Order_ID: id,
    Tracking_ID: `TRACK-${id}`,
    Customer_ID: E2E.customer.id,
    Items: [{
      Product_ID: 'E2E-P-BLANKET',
      Name: `${paymentStatus} status sample`,
      Price: 100,
      Quantity: 1,
      Image: '',
      Seller_ID: E2E.seller.id,
    }],
    Subtotal: 100,
    Shipping_Fee: 0,
    Status: status,
    Payment_Status: paymentStatus,
    Payment_Method: 'sslcommerz',
    Shipping_Address: address,
    Billing_Address: address,
    Order_Placed_At: '2026-01-15T12:00:00.000Z',
  };
}

const orders = [
  makeOrder('E2E-PAID', 'placed', 'paid'),
  makeOrder('E2E-PENDING', 'placed', 'pending'),
  makeOrder('E2E-FAILED', 'placed', 'failed'),
  makeOrder('E2E-CANCELLED', 'cancelled', 'refunded'),
];

test.describe('semantic order status colors', () => {
  test.use({ storageState: AUTH.customer });

  test('distinguishes paid, pending, failed, and cancelled in both themes', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await page.route('**/api/orders?*', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(orders),
    }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /Orders|My orders/ }).first().click();

    const paid = page.locator('[data-testid="payment-status-badge"][data-status="paid"]');
    const pending = page.locator('[data-testid="payment-status-badge"][data-status="pending"]');
    const failed = page.locator('[data-testid="payment-status-badge"][data-status="failed"]');
    const cancelled = page.locator('[data-testid="order-status-badge"][data-status="cancelled"]');
    const states = [paid, pending, failed, cancelled];

    for (const [badge, label] of [
      [paid, 'Paid'],
      [pending, 'Pending'],
      [failed, 'Failed'],
      [cancelled, 'Cancelled'],
    ] as const) {
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(label);
    }

    for (const theme of ['light', 'dark'] as const) {
      await page.locator('html').evaluate((element, nextTheme) => {
        element.classList.toggle('dark', nextTheme === 'dark');
      }, theme);
      const colors = await Promise.all(states.map((badge) => badge.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, foreground: style.color };
      })));

      expect(new Set(colors.map(({ background }) => background)).size).toBe(states.length);
      for (const { background, foreground } of colors) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unexpected computed color: ${color}`);
    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
