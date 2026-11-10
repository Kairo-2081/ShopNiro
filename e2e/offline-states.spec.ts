import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { blockNonLocalTraffic, selectWorkspaceNavigationItem } from './helpers.ts';

test('keeps a readable offline notice on every role home and navigation screen', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const cases = [
    { role: 'customer', home: 'Shop', dashboard: [], navigation: ['Top charts', 'Live tracking', 'Profile', 'Support'] },
    { role: 'seller', home: 'Product Catalog', dashboard: ['Seller Studio'], navigation: ['Fulfillment Orders', 'Sales Analytics', 'Preview storefront', 'Support'] },
    { role: 'admin', home: 'Governance Overview', dashboard: ['Admin dashboard'], navigation: ['Marketplace Metrics', 'Merchant Approvals', 'Storefront', 'Support'] },
    { role: 'rider', home: 'Deliveries', dashboard: [], navigation: ['Support'] },
  ] as const;

  for (const { role, home, dashboard, navigation } of cases) {
    const context = await browser.newContext({ baseURL, storageState: AUTH[role] });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      await selectWorkspaceNavigationItem(page, home);
      // Visit each screen once while online so its lazy-loaded code is already in the browser.
      for (const label of navigation) {
        await selectWorkspaceNavigationItem(page, label);
        await page.waitForTimeout(700);
      }
      for (const label of dashboard) await selectWorkspaceNavigationItem(page, label);
      await selectWorkspaceNavigationItem(page, home);
      await page.waitForTimeout(700);
      await context.setOffline(true);
      // Chromium does not reliably emit the offline event when the context is switched, so send it explicitly.
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      const notice = page.getByRole('alert').filter({ hasText: 'You are offline' });
      await expect(notice).toBeVisible();
      await expect(notice.getByRole('button', { name: 'Retry' })).toBeVisible();

      for (const label of navigation) {
        await selectWorkspaceNavigationItem(page, label);
        await expect(notice).toBeVisible();
      }
    } finally {
      await context.close();
    }
  }
});

test('surfaces the server request ID and a retry when a catalog request fails', async ({ page }) => {
  await blockNonLocalTraffic(page);
  let attempts = 0;
  await page.route(/\/api\/products(?:\?.*)?$/, async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Catalog temporarily unavailable', requestId: 'req-e2e-catalog-503' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  const failure = page.getByRole('alert').filter({ hasText: 'Catalog temporarily unavailable' });
  await expect(failure).toContainText('req-e2e-catalog-503');
  const retryRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/products');
  await failure.getByRole('button', { name: 'Retry' }).click();
  await retryRequest;
  await expect(page.getByRole('button', { name: 'Shopping Cart' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Catalog temporarily unavailable' })).toHaveCount(0);
  expect(attempts).toBeGreaterThanOrEqual(2);
});

test('product loading cards keep equal reserved heights', async ({ page }) => {
  await blockNonLocalTraffic(page);
  await page.route(/\/api\/products(?:\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });

  await page.goto('/');
  // Guests start on the landing page; the skeleton shows once they enter the storefront while products are still loading.
  await page.getByRole('button', { name: /Browse catalog|Filter Catalog/ }).first().click();
  const skeletonGrid = page.getByRole('status', { name: 'Loading products' });
  await expect(skeletonGrid).toBeVisible();
  const cardHeights = await skeletonGrid.locator(':scope > div').evaluateAll((cards) =>
    cards.map((card) => Math.round(card.getBoundingClientRect().height))
  );
  expect(cardHeights).toHaveLength(8);
  // Cards sit on fractional pixel positions, so rounded heights may differ by 1 px.
  expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThanOrEqual(1);
});
