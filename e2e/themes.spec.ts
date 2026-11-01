import { expect, test } from '@playwright/test';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, clearCartAndOrders, latestOrder, openCheckout, openStorefront, parseMoney, seedCart } from './helpers.ts';

// Checkout must work, and fit the screen, in both themes. The narrow project repeats this at 360 px.
for (const theme of ['dark', 'light'] as const) {
  test(`checkout works and fits the screen in the ${theme} theme`, async ({ page }) => {
    await clearCartAndOrders();
    await blockNonLocalTraffic(page);
    await page.addInitScript((value) => localStorage.setItem('marketpulse_theme', value), theme);
    await seedCart({ [E2E.products.blanket.id]: 1 });
    await openStorefront(page);
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
    await openCheckout(page);

    await page.getByText('Cash on Delivery (COD)').click();
    await page.getByRole('checkbox').check();
    const confirm = page.getByRole('button', { name: /Confirm Order \(Cash on Delivery\)/ });
    await expect(confirm).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(1);

    const shown = parseMoney(await page.getByTestId('checkout-total').innerText());
    await confirm.click();
    await expect(page.getByRole('heading', { name: 'Order Placed' })).toBeVisible();
    const order = await latestOrder();
    expect(shown).toBeCloseTo(order!.subtotal + order!.shipping_fee, 2);
  });
}
