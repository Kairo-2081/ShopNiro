import { expect, test } from '@playwright/test';
import type { Address, Order, PaymentStatus } from '../src/types.ts';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, clearCartAndOrders } from './helpers.ts';

const address: Address = {
  Street: 'Market Road',
  House_Name: 'Shop 1',
  City: 'Dhaka',
  Postal_Code: '1207',
};

function returnedOrder(id: string, status: PaymentStatus): Order {
  return {
    Order_ID: id,
    Tracking_ID: `TRACK-${id}`,
    Customer_ID: E2E.customer.id,
    Items: [],
    Subtotal: 100,
    Shipping_Fee: 5,
    Status: 'placed',
    Payment_Status: status,
    Payment_Method: 'bkash',
    Shipping_Address: address,
    Billing_Address: address,
    Order_Placed_At: '2026-01-15T12:00:00.000Z',
  };
}

test.describe('payment return results', () => {
  test.use({ storageState: AUTH.customer });
  test.beforeEach(async () => { await clearCartAndOrders(); });

  test('shows one recovery action for paid, failed, and cancelled returns', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await page.route('**/api/orders/E2E-PAYMENT-*/revert-failed-payment', async (route) => {
      const { pathname } = new URL(route.request().url());
      const id = pathname.split('/').filter(Boolean)[2] || '';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ success: true, order_id: id, restored_to_cart: true }),
      });
    });
    await page.route('**/api/orders/E2E-PAYMENT-*', async (route) => {
      const { pathname } = new URL(route.request().url());
      const id = pathname.split('/').filter(Boolean)[2] || '';
      const status: PaymentStatus = id.endsWith('PAID') ? 'paid' : 'failed';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(returnedOrder(id, status)),
      });
    });

    const cases = [
      { query: 'success', id: 'E2E-PAYMENT-PAID', title: 'Payment complete', action: 'View order' },
      { query: 'failed', id: 'E2E-PAYMENT-FAILED', title: 'Payment failed', action: 'Try again' },
      { query: 'cancelled', id: 'E2E-PAYMENT-CANCELLED', title: 'Payment cancelled', action: 'Choose cash on delivery' },
    ] as const;

    for (const result of cases) {
      await page.goto(`/?sslcommerz=${result.query}&orderId=${result.id}`);
      const dialog = page.getByRole('dialog', { name: result.title });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(result.id);
      await expect(dialog).toContainText('bKash');
      await expect(dialog).toContainText('105');
      const actions = dialog.getByRole('button');
      await expect(actions).toHaveCount(1);
      await expect(actions).toHaveText(result.action);

      await actions.click();
      if (result.query === 'success') {
        await expect(dialog).toHaveCount(0);
      } else {
        const checkout = page.getByRole('dialog', { name: /Direct checkout and payment/i });
        await expect(checkout).toBeVisible();
        if (result.query === 'cancelled') {
          await expect(checkout.getByRole('button', { name: /Select cash on delivery.*as payment method/i })).toHaveAttribute('aria-pressed', 'true');
        }
      }
    }
  });
});
