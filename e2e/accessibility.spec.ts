import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, clearCartAndOrders, openCheckout, openStorefront, seedCart } from './helpers.ts';

const rolePages = [
  { role: 'customer', home: 'Shop', pages: ['Top charts', 'Orders', 'Live tracking', 'Profile', 'Support'] },
  { role: 'seller', home: 'Product Catalog', pages: ['Fulfillment Orders', 'Sales Analytics', 'Customer Reviews', 'Deals & Bundles', 'COD remittances', 'Preview storefront', 'Support'] },
  { role: 'admin', home: 'Governance Overview', pages: ['Marketplace Metrics', 'Merchant Approvals', 'Category Registry', 'Rider Hiring', 'Product Moderation', 'Online Payments', 'Order Cancellations', 'Support Inbox', 'Storefront', 'Support'] },
  { role: 'rider', home: 'Deliveries', pages: ['Support'] },
] as const;

const guestStorageState = { cookies: [], origins: [] };

const assertKeyboardReachability = async (page: import('@playwright/test').Page, label: string) => {
  // Controls are tagged in the page, so a late re-render (the catalogue is fetched more than once on load) would drop the
  // tags and make a reachable control look untagged. Let requests finish and the page stop changing first.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.evaluate(() => new Promise<void>((resolve) => {
    let quiet = window.setTimeout(done, 600);
    const observer = new MutationObserver(() => { window.clearTimeout(quiet); quiet = window.setTimeout(done, 600); });
    const limit = window.setTimeout(done, 6000);
    function done() { observer.disconnect(); window.clearTimeout(quiet); window.clearTimeout(limit); resolve(); }
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  }));
  // Start without a pointer-focused navigation item so its existing focus style is not mistaken for the baseline.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    const anchor = document.createElement('div');
    anchor.tabIndex = -1;
    document.body.prepend(anchor);
    anchor.focus();
    anchor.remove();
  });
  const expected = await page.evaluate(() => {
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'))
      .map((element, index) => {
        element.dataset.a11yTabIndex = String(index);
        element.dataset.a11yLabel = element.getAttribute('aria-label') || (element.innerText ?? element.textContent ?? '').trim().replace(/\s+/g, ' ') || element.title || `${element.tagName.toLowerCase()} control`;
        return { index, label: element.dataset.a11yLabel };
      });
  });
  expect(expected.length, `${label} has keyboard-accessible controls`).toBeGreaterThan(0);
  const visited = new Set<number>();
  for (let index = 0; index < expected.length; index += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        index: element?.dataset.a11yTabIndex,
        label: element?.dataset.a11yLabel,
        tagName: element?.tagName,
        className: typeof element?.className === 'string' ? element.className : '',
        outline: element ? getComputedStyle(element).outlineStyle : 'none',
        outlineWidth: element ? getComputedStyle(element).outlineWidth : '0px',
        boxShadow: element ? getComputedStyle(element).boxShadow : 'none',
      };
    });
    if (focus.index !== undefined) visited.add(Number(focus.index));
    const hasIndicator = (
      (focus.outline !== 'none' && focus.outlineWidth !== '0px') ||
      focus.boxShadow !== 'none'
    );
    expect(
      hasIndicator,
      `${label} control ${focus.index ?? 'unknown'} (${focus.label ?? focus.tagName ?? 'no active element'}) has a visible focus indicator; outline=${focus.outline} ${focus.outlineWidth}, shadow=${focus.boxShadow}, class=${focus.className}`,
    ).toBe(true);
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
      const navigation = page.getByRole('navigation', { name: 'Workspace navigation' });
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
      const navigation = page.getByRole('navigation', { name: 'Workspace navigation' });
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

test('mobile navigation drawer closes with Escape and returns focus to its trigger', async ({ browser, baseURL }, testInfo) => {
  test.skip(!['phone', 'narrow'].includes(testInfo.project.name), 'The drawer interaction check runs on phone viewports.');
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Top charts' }).click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await context.close();
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
    await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Orders' }).waitFor();
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

const scanBothThemes = async (page: import('@playwright/test').Page, label: string) => {
  // Contrast is read from computed colours. Freeze transitions so a scan never catches a colour half way between themes,
  // including on page content behind the open dialog.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation-duration: 0s !important; animation-delay: 0s !important; }' });
  const seriousViolations = async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    return results.violations
      .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
      .map((violation) => ({
        id: violation.id,
        help: violation.help,
        targets: violation.nodes.map((node) => `${node.target.join(' ')} :: ${node.any[0]?.message ?? ''}`).slice(0, 4),
      }));
  };
  for (const theme of ['light', 'dark']) {
    await page.evaluate((isDark) => document.documentElement.classList.toggle('dark', isDark), theme === 'dark');
    await page.waitForTimeout(400);
    let found = await seriousViolations();
    if (found.length) {
      // A frame caught between two themes can report colours from both. A real problem is still there after the page settles.
      await page.waitForTimeout(800);
      found = await seriousViolations();
    }
    expect(found.map((violation) => ({ theme, ...violation })), `${label} (${theme})`).toEqual([]);
  }
};

test('create-account dialog has no critical or serious axe violations in either theme', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog sweep runs once per CI workflow.');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: guestStorageState });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Sign in|Log in|Login/i }).first().click();
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Create an Account' })).toBeVisible();
    await scanBothThemes(page, 'Create-account dialog');
  } finally {
    await context.close();
  }
});

test('product detail dialog has no critical or serious axe violations in either theme', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog sweep runs once per CI workflow.');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Orders' }).waitFor();
    await page.locator('[data-testid="product-card"]').first().getByRole('button', { name: /view details|details/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scanBothThemes(page, 'Product detail dialog');
  } finally {
    await context.close();
  }
});

test('payment receipt dialog has no critical or serious axe violations in either theme', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog sweep runs once per CI workflow.');
  test.setTimeout(120_000);
  await clearCartAndOrders();
  await seedCart({ [E2E.products.blanket.id]: 1 });
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await openStorefront(page);
    await openCheckout(page);
    await page.getByText('Cash on Delivery (COD)').click();
    await page.getByRole('checkbox').check();
    await page.getByTestId('checkout-submit').click();
    await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();
    // The confirmation's own button leads to My orders, where each order has its receipt button.
    await page.getByRole('button', { name: 'View order' }).click();
    await page.getByRole('button', { name: /View SSLCommerz Receipt/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scanBothThemes(page, 'Payment receipt dialog');
  } finally {
    await context.close();
    await clearCartAndOrders();
  }
});
