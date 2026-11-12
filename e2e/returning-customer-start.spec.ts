import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { blockNonLocalTraffic } from './helpers.ts';

const HINT_KEY = 'shopniro_signed_in_hint';

// The landing page's globe is its own lazy chunk, fetched only when the landing page draws. Whether that file was ever
// requested says whether the landing page drew, however briefly, which looking at the page afterwards cannot.
function watchForGlobeChunk(page: import('@playwright/test').Page) {
  const requested: string[] = [];
  page.on('request', (request) => { if (/OrbitGlobe/.test(request.url())) requested.push(request.url()); });
  return requested;
}

test('a returning customer opens on the storefront without the landing page first', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The start screen is the same on every width.');
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  await context.addInitScript(([key]) => window.localStorage.setItem(key, String(Date.now())), [HINT_KEY]);
  const page = await context.newPage();
  const globeRequests = watchForGlobeChunk(page);
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await expect(page.getByText('E2E Linen Blanket').first()).toBeVisible();
    await page.waitForTimeout(1000);
    expect(globeRequests, 'the landing page never drew').toEqual([]);
    // Still signed in: the server confirmed the session and the hint is kept for the next visit.
    expect(await page.evaluate((key) => window.localStorage.getItem(key), HINT_KEY)).not.toBeNull();
  } finally {
    await context.close();
  }
});

test('a stale hint without a session falls back to the landing page and is cleared', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The start screen is the same on every width.');
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  await context.addInitScript(([key]) => window.localStorage.setItem(key, String(Date.now())), [HINT_KEY]);
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Explore Marketplace' })).toBeVisible();
    await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), HINT_KEY)).toBeNull();
  } finally {
    await context.close();
  }
});

test('without the hint the same customer still starts on the landing page, so the check above can tell the difference', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The start screen is the same on every width.');
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  const globeRequests = watchForGlobeChunk(page);
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await expect(page.getByText('E2E Linen Blanket').first()).toBeVisible();
    expect(globeRequests.length, 'the landing page drew first').toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
