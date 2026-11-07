import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { blockNonLocalTraffic } from './helpers.ts';

const rolePages = [
  { role: 'customer', home: 'My orders', pages: ['Storefront catalog', 'Top charts', 'My orders', 'Live tracking', 'My Profile', 'Support'] },
  { role: 'seller', home: 'Seller Studio', pages: ['Preview Storefront', 'Support'] },
  { role: 'admin', home: 'Admin Governance', pages: ['Public Storefront', 'Support'] },
  { role: 'rider', home: 'Rider deliveries', pages: ['Support'] },
] as const;

const guestStorageState = { cookies: [], origins: [] };

test('public and role-specific pages have no critical or serious axe violations', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== 'desktop', 'The full page sweep runs once per CI workflow.');

  const scanPage = async (page: import('@playwright/test').Page, label: string) => {
    const scanTheme = async (theme: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const violations = results.violations
        .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          targets: violation.nodes.map((node) => node.target),
        }));
      if (violations.length) {
        console.error(JSON.stringify({ page: label, theme, violations }, null, 2));
      }
      expect(violations, `${label} (${theme}) has critical or serious accessibility violations`).toEqual([]);
    };

    await scanTheme('default theme');
    const themeToggle = page.getByRole('button', { name: /switch to (light|dark) mode/i });
    if (await themeToggle.count()) {
      await themeToggle.click();
      await scanTheme('alternate theme');
      await themeToggle.click();
    }
  };

  const publicContext = await browser.newContext({ baseURL, storageState: guestStorageState });
  const publicPage = await publicContext.newPage();
  try {
    await blockNonLocalTraffic(publicPage);
    await publicPage.goto('/');
    await scanPage(publicPage, 'Public marketplace');
    for (const path of ['/terms', '/privacy', '/refunds', '/delivery']) {
      await publicPage.goto(path);
      await scanPage(publicPage, path);
    }
  } finally {
    await publicContext.close();
  }

  for (const { role, home, pages } of rolePages) {
    const context = await browser.newContext({ baseURL, storageState: AUTH[role] });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
      await expect(navigation.getByRole('button', { name: home })).toBeVisible();
      await scanPage(page, `${role} ${home}`);
      for (const label of pages) {
        await navigation.getByRole('button', { name: label }).click();
        await scanPage(page, `${role} ${label}`);
      }
    } finally {
      await context.close();
    }
  }
});

test('storefront controls are keyboard reachable and the login dialog traps and restores focus', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The keyboard sweep runs once per CI workflow.');
  const context = await browser.newContext({ baseURL, storageState: guestStorageState });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    const expected = await page.evaluate(() => {
      const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'))
        .map((element, index) => {
          element.dataset.a11yTabIndex = String(index);
          const style = getComputedStyle(element);
          element.dataset.a11yOutline = `${style.outlineStyle} ${style.outlineWidth}`;
          element.dataset.a11yShadow = style.boxShadow;
          return index;
        });
    });
    const visited = new Set<number>();
    let hasVisibleFocus = false;
    for (let index = 0; index < expected.length + 1; index += 1) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        return {
          index: element?.dataset.a11yTabIndex,
          outline: element ? getComputedStyle(element).outlineStyle : 'none',
          outlineWidth: element ? getComputedStyle(element).outlineWidth : '0px',
          boxShadow: element ? getComputedStyle(element).boxShadow : 'none',
          initialOutline: element?.dataset.a11yOutline,
          initialShadow: element?.dataset.a11yShadow,
        };
      });
      if (focus.index !== undefined) visited.add(Number(focus.index));
      if (
        (focus.outline !== 'none' && focus.outlineWidth !== '0px' && `${focus.outline} ${focus.outlineWidth}` !== focus.initialOutline) ||
        (focus.boxShadow !== 'none' && focus.boxShadow !== focus.initialShadow)
      ) hasVisibleFocus = true;
    }
    expect(visited.size).toBe(expected.length);
    expect(hasVisibleFocus).toBe(true);

    const signIn = page.getByRole('button', { name: 'Sign in' });
    await signIn.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Marketplace Login' });
    await expect(dialog).toBeVisible();
    const focusable = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    const first = focusable.first();
    const last = focusable.last();
    await expect(first).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(signIn).toBeFocused();
  } finally {
    await context.close();
  }
});

test('reduced motion stops the orbit globe animation without hiding its content', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The motion preference check runs once per CI workflow.');
  const context = await browser.newContext({ baseURL, storageState: guestStorageState, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    console.log('Opening the marketplace with reduced motion enabled.');
    await page.goto('/');
    const globe = page.locator('canvas');
    console.log('Waiting for the orbit globe canvas.');
    await expect(globe).toBeVisible();
    const initialFrame = await globe.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await page.waitForTimeout(150);
    const settledFrame = await globe.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    expect(settledFrame).toBe(initialFrame);
    expect(await page.locator('.animate-fade-up').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  } finally {
    await context.close();
  }
});
