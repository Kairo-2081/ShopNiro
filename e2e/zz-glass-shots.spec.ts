import { test } from '@playwright/test';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, clearCartAndOrders, openCheckout, openStorefront, seedCart } from './helpers.ts';

for (const theme of ['light', 'dark'] as const) {
  test(`glass shots ${theme}`, async ({ page }, info) => {
    await clearCartAndOrders();
    await blockNonLocalTraffic(page);
    await page.addInitScript((v) => localStorage.setItem('marketpulse_theme', v), theme);
    await seedCart({ [E2E.products.blanket.id]: 1 });
    await openStorefront(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/claude-0/-home-claude/d3f18472-90d1-5580-9e2f-22ddb7630a24/scratchpad/glass/' + info.project.name + '-' + theme + '-store.png' });
    await openCheckout(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/claude-0/-home-claude/d3f18472-90d1-5580-9e2f-22ddb7630a24/scratchpad/glass/' + info.project.name + '-' + theme + '-checkout.png' });
  });
}
