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

const assertKeyboardReachability = async (page: import('@playwright/test').Page, label: string) => {
  const expected = await page.evaluate(() => {
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'))
      .map((element, index) => {
        element.dataset.a11yTabIndex = String(index);
        element.dataset.a11yLabel = element.getAttribute('aria-label') || element.innerText.trim().replace(/\s+/g, ' ') || element.title || `${element.tagName.toLowerCase()} control`;
        const style = getComputedStyle(element);
        element.dataset.a11yOutline = `${style.outlineStyle} ${style.outlineWidth}`;
        element.dataset.a11yShadow = style.boxShadow;
        return { index, label: element.dataset.a11yLabel };
      });
  });
  expect(expected.length, `${label} has keyboard-accessible controls`).toBeGreaterThan(0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  const visited = new Set<number>();
  for (let index = 0; index < expected.length; index += 1) {
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
    const hasIndicator = (
      (focus.outline !== 'none' && focus.outlineWidth !== '0px' && `${focus.outline} ${focus.outlineWidth}` !== focus.initialOutline) ||
      (focus.boxShadow !== 'none' && focus.boxShadow !== focus.initialShadow)
    );
    expect(hasIndicator, `${label} control ${focus.index ?? 'unknown'} has a visible focus indicator`).toBe(true);
  }
  const missing = expected.filter(({ index }) => !visited.has(index));
  expect(visited.size, `${label} controls missing from tab order: ${missing.map(({ index, label: control }) => `${index}: ${control}`).join('; ')}`).toBe(expected.length);
};

test('public and role-specific pages have no critical or serious axe violations', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== 'desktop', 'The full page sweep runs once per CI workflow.');

  // Contrast is read from computed colours, so let the colour transitions started by a theme switch finish.
  const settleThemeTransition = async (page: import('@playwright/test').Page) => {
    await page.evaluate(async () => {
      // Two frames let the just-triggered transition register before it is awaited.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const finite = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    });
  };

  const scanPage = async (page: import('@playwright/test').Page, label: string) => {
    const scanTheme = async (theme: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const violations = results.violations
        .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
        .map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
            checks: node.any.map((check) => ({ message: check.message, data: check.data })),
          })),
        }));
      if (violations.length) {
        console.error(JSON.stringify({ page: label, theme, violations }, null, 2));
      }
      expect(violations, `${label} (${theme}) has critical or serious accessibility violations`).toEqual([]);
    };

    await scanTheme('default theme');
    const themeToggle = page.getByRole('button', { name: /switch to (light|dark) mode/i });
    if (await themeToggle.count()) {
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      await themeToggle.click();
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!isDark);
      await settleThemeTransition(page);
      await scanTheme('alternate theme');
      await themeToggle.click();
      await settleThemeTransition(page);
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
    const signIn = page.getByRole('button', { name: /sign in or manage accounts/i });
    await expect(signIn).toBeVisible();
    await assertKeyboardReachability(page, 'Public storefront');

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

test('role pages expose every visible control to keyboard navigation', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(testInfo.project.name !== 'desktop', 'The complete role-page keyboard sweep runs once per CI workflow.');

  for (const { role, home, pages } of rolePages) {
    const context = await browser.newContext({ baseURL, storageState: AUTH[role] });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
      await expect(navigation.getByRole('button', { name: home })).toBeVisible();
      await assertKeyboardReachability(page, `${role} home`);

      for (const label of pages) {
        await navigation.getByRole('button', { name: label }).click();
        await assertKeyboardReachability(page, `${role} ${label}`);
      }
    } finally {
      await context.close();
    }
  }
});

test('cart drawer traps focus, closes with Escape, and restores focus to its trigger', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog focus-return check runs once per CI workflow.');
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    const cartTrigger = page.getByRole('button', { name: 'Shopping Cart' });
    await cartTrigger.click();
    const dialog = page.getByRole('dialog', { name: 'Your Cart' });
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
    await expect(cartTrigger).toBeFocused();
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

test('checkout and cart dialogs have no critical or serious axe violations in either theme', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog sweep runs once per CI workflow.');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'My orders' }).waitFor();
    const card = page.locator('[data-testid="product-card"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('button', { name: 'Add to Cart' }).click();

    const scan = async (label: string) => {
      for (const theme of ['light', 'dark']) {
        await page.evaluate((isDark) => document.documentElement.classList.toggle('dark', isDark), theme === 'dark');
        await page.waitForTimeout(1200);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
        expect(serious.map((violation) => ({ label, theme, id: violation.id, targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 4) })), `${label} (${theme})`).toEqual([]);
      }
    };

    await page.getByRole('button', { name: /cart/i }).first().click();
    await expect(page.getByRole('button', { name: /Proceed to checkout/i })).toBeVisible();
    await scan('Cart drawer');
    await page.getByRole('button', { name: /Proceed to checkout/i }).click();
    await expect(page.getByTestId('checkout-submit')).toBeVisible();
    await scan('Checkout dialog');
  } finally {
    await context.close();
  }
});

test('sign-in and sign-up dialogs have no critical or serious axe violations in either theme', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog sweep runs once per CI workflow.');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: guestStorageState });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Sign in|Log in|Login/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((isDark) => document.documentElement.classList.toggle('dark', isDark), theme === 'dark');
      await page.waitForTimeout(1200);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
      expect(serious.map((violation) => ({ theme, id: violation.id, targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 4) })), `Sign-in dialog (${theme})`).toEqual([]);
    }
  } finally {
    await context.close();
  }
});
