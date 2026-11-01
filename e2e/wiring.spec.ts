import { expect, test } from '@playwright/test';
import { blockNonLocalTraffic, openStorefront } from './helpers.ts';

// The browser build bakes the API address in (VITE_API_URL) and falls back to the production API when it is unset.
// A staging site built without it would look fine while talking to production. Every API call must go to the site
// under test, whichever server that is.
test('the page calls only its own API', async ({ page, baseURL }) => {
  const apiHosts = new Set<string>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiHosts.add(url.host);
  });
  await blockNonLocalTraffic(page);
  await openStorefront(page);
  await page.waitForLoadState('networkidle');

  expect(apiHosts.size, 'the page made API calls').toBeGreaterThan(0);
  expect([...apiHosts]).toEqual([new URL(baseURL!).host]);
});
