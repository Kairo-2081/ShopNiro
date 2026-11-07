import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { blockNonLocalTraffic } from './helpers.ts';

test('keeps a readable offline notice on every role home and navigation screen', async ({ browser, baseURL }) => {
  const cases = [
    { role: 'customer', navigation: ['Top charts', 'My orders', 'Live tracking', 'My Profile', 'Support'] },
    { role: 'seller', navigation: ['Preview Storefront', 'Support'] },
    { role: 'admin', navigation: ['Public Storefront', 'Support'] },
    { role: 'rider', navigation: ['Support'] },
  ] as const;

  for (const { role, navigation } of cases) {
    const context = await browser.newContext({ baseURL, storageState: AUTH[role] });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
      await context.setOffline(true);
      const notice = page.getByRole('alert').filter({ hasText: 'You are offline' });
      await expect(notice).toBeVisible();
      await expect(notice.getByRole('button', { name: 'Retry' })).toBeVisible();

      for (const label of navigation) {
        await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: label }).click();
        await expect(notice).toBeVisible();
      }

      await context.setOffline(false);
      await expect(notice).toHaveCount(0);
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
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  await page.goto('/');
  const skeletonGrid = page.getByRole('status', { name: 'Loading products' });
  await expect(skeletonGrid).toBeVisible();
  const cardHeights = await skeletonGrid.locator(':scope > div').evaluateAll((cards) =>
    cards.map((card) => Math.round(card.getBoundingClientRect().height))
  );
  expect(cardHeights).toHaveLength(8);
  expect(new Set(cardHeights).size).toBe(1);
});
