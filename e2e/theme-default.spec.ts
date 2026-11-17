import { expect, test } from '@playwright/test';
import { blockNonLocalTraffic } from './helpers.ts';

// Light is the default theme, a saved choice wins over it, and the app screenshots on the landing page follow the theme.
const guest = { cookies: [], origins: [] };

test.use({ storageState: guest });

test('a first-time visitor sees the light theme', async ({ page }) => {
  await blockNonLocalTraffic(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Switch to dark mode' }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('marketpulse_theme'))).toBe('light');
});

test('a saved dark choice is honoured, and is already applied before the app starts', async ({ page }) => {
  await blockNonLocalTraffic(page);
  await page.addInitScript(() => localStorage.setItem('marketpulse_theme', 'dark'));
  // The class comes from /theme-init.js, which runs before the app bundle; stop the bundle and it must still be there.
  await page.route(/\/(assets\/index-|src\/main\.tsx)/, (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('landing screenshots switch with the theme', async ({ page }) => {
  await blockNonLocalTraffic(page);
  await page.goto('/');
  const shots = page.locator('#features img');
  await expect(shots).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await shots.nth(index).scrollIntoViewIfNeeded();
    await expect(shots.nth(index)).toHaveAttribute('src', /-light/);
  }

  await page.getByRole('button', { name: 'Switch to dark mode' }).first().click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  for (let index = 0; index < 4; index += 1) {
    await expect(shots.nth(index)).not.toHaveAttribute('src', /-light/);
  }
  // Every image really loads, in both themes.
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#features img')).every((img) => (img as HTMLImageElement).complete));
  const broken = await shots.evaluateAll((images) => images.filter((img) => (img as HTMLImageElement).naturalWidth === 0).length);
  expect(broken).toBe(0);
});
