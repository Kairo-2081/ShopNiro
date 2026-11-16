import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { blockNonLocalTraffic } from './helpers.ts';

// The language and theme buttons must be reachable on every screen: the public landing page, the policy pages and each
// signed-in role. Before this check the language button was missing for sellers, riders and admins, from the landing
// header, and the theme button was missing from the policy pages.
const guest = { cookies: [], origins: [] };
const screens: Array<{ name: string; path: string; storageState: typeof guest | string }> = [
  { name: 'landing page', path: '/', storageState: guest },
  { name: 'terms page', path: '/terms', storageState: guest },
  { name: 'privacy page', path: '/privacy', storageState: guest },
  { name: 'customer', path: '/', storageState: AUTH.customer },
  { name: 'seller', path: '/', storageState: AUTH.seller },
  { name: 'rider', path: '/', storageState: AUTH.rider },
  { name: 'admin', path: '/', storageState: AUTH.admin },
];

for (const screen of screens) {
  test(`${screen.name}: language and theme can be changed`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: screen.storageState as never });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.addInitScript(() => {
        localStorage.setItem('marketpulse_theme', 'dark');
        localStorage.setItem('shopniro_locale', 'en');
      });
      await page.goto(screen.path);
      await page.waitForLoadState('networkidle').catch(() => undefined);

      // Theme first: its label is translated, so it is easiest to find while the page is still in English.
      await expect(page.locator('html')).toHaveClass(/dark/);
      await page.getByRole('button', { name: 'Switch to light mode' }).first().click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      await page.getByRole('button', { name: /Switch language to Bangla/ }).first().click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
      // The button's own label is translated too, so the English wording is gone once Bangla is on.
      await expect(page.getByRole('button', { name: /Switch language to Bangla/ })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
