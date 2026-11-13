import { expect, test } from '@playwright/test';
import { blockNonLocalTraffic } from './helpers.ts';

// A keyboard or screen-reader user should be able to jump past the header and navigation on every screen.
async function skipToMain(page: import('@playwright/test').Page) {
  // The link can only move focus once its target exists, and some screens load their code on demand.
  await expect(page.locator('#main-content')).toBeAttached();
  // After a screen change the browser would resume Tab from where the clicked button used to be. Put it back at the top,
  // which is where a keyboard user starts on a freshly loaded page.
  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
}

const guest = { cookies: [], origins: [] };

test.describe('a guest', () => {
  test.use({ storageState: guest });

  test('can skip to the main content on the landing page', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Explore Marketplace' })).toBeVisible();
    await skipToMain(page);
  });

  test('can skip again after entering the marketplace', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore Marketplace' }).click();
    await expect(page.getByText('E2E Linen Blanket').first()).toBeVisible();
    await skipToMain(page);
  });

  test('can skip to the main content on a policy page', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await page.goto('/terms');
    await skipToMain(page);
  });
});

test('a signed-in customer can skip to the main content of the storefront', async ({ page }) => {
  await blockNonLocalTraffic(page);
  await page.goto('/');
  await expect(page.getByText('E2E Linen Blanket').first()).toBeVisible();
  await skipToMain(page);
});
