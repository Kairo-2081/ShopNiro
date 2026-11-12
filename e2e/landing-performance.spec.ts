import { expect, test } from '@playwright/test';
import { blockNonLocalTraffic } from './helpers.ts';

const guestStorageState = { cookies: [], origins: [] };

// The overview figures count up from zero. That animation used to run from page load, calling setState on every frame
// for a section the visitor had not reached, which kept the main thread busy during the first seconds. It now waits until
// the figures are on screen.
test.describe('landing page figures', () => {
  test('stay at zero until scrolled into view, then count up to the real numbers', async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The count-up is checked once per CI workflow.');
    const context = await browser.newContext({ baseURL, storageState: guestStorageState, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      const section = page.getByRole('region', { name: 'ShopNiro marketplace overview' });
      await expect(section).toBeAttached();
      const figures = section.locator('dd');
      const count = await figures.count();
      expect(count).toBeGreaterThan(0);

      // The animated digits are aria-hidden; the screen-reader copy carries the final value from the start.
      const finals = await figures.evaluateAll((nodes) => nodes.map((node) => node.querySelector('.sr-only')?.textContent ?? ''));
      const visibleDigits = () => figures.evaluateAll((nodes) => nodes.map((node) => node.querySelector('[aria-hidden="true"]')?.textContent ?? ''));
      const nonZero = finals.map((text, index) => ({ text, index })).filter(({ text }) => Number(text.replace(/,/g, '')) > 0);
      test.skip(nonZero.length === 0, 'The seeded marketplace has no figures above zero to count up to.');

      // Before the section is reached nothing has moved, however long we wait.
      const inViewBefore = await section.evaluate((node) => { const r = node.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
      if (!inViewBefore) {
        await page.waitForTimeout(1500);
        for (const { index } of nonZero) expect((await visibleDigits())[index]).toBe('0');
      }

      await section.scrollIntoViewIfNeeded();
      await section.evaluate((node) => node.scrollIntoView({ block: 'center' }));
      for (const { index, text } of nonZero) await expect.poll(async () => (await visibleDigits())[index], { timeout: 5000 }).toBe(text);
    } finally {
      await context.close();
    }
  });

  test('show the real numbers straight away when the visitor prefers reduced motion', async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The count-up is checked once per CI workflow.');
    const context = await browser.newContext({ baseURL, storageState: guestStorageState, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      const section = page.getByRole('region', { name: 'ShopNiro marketplace overview' });
      await expect(section).toBeAttached();
      const pairs = await section.locator('dd').evaluateAll((nodes) => nodes.map((node) => [
        node.querySelector('.sr-only')?.textContent ?? '',
        node.querySelector('[aria-hidden="true"]')?.textContent ?? '',
      ]));
      for (const [final, shown] of pairs) expect(shown).toBe(final);
    } finally {
      await context.close();
    }
  });
});
