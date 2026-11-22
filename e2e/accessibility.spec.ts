import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, caseInsensitiveName, clearCartAndOrders, openCheckout, openStorefront, seedCart } from './helpers.ts';

test.describe.configure({ retries: 0 });

const rolePages = [
  { role: 'customer', home: 'Shop', pages: ['Top charts', 'Orders', 'Spending insights', 'Transactions', 'Live tracking', 'Profile', 'Support'] },
  { role: 'seller', home: 'Product Catalog', pages: ['Fulfillment Orders', 'Sales Analytics', 'Customer Reviews', 'Deals and bundles', 'COD remittances', 'Transactions', 'Preview storefront', 'Support'] },
  { role: 'admin', home: 'Governance Overview', pages: ['Marketplace Metrics', 'Merchant Approvals', 'Category Registry', 'Rider Hiring', 'Product Moderation', 'Seller Payout Requests', 'Order Cancellations', 'Support Inbox', 'Storefront', 'Support'] },
  { role: 'rider', home: 'Deliveries', pages: ['Rider analytics', 'Transactions', 'Support'] },
] as const;

const guestStorageState = { cookies: [], origins: [] };

const assertKeyboardReachability = async (page: import('@playwright/test').Page, label: string) => {
  // Wait for the DOM to settle rather than network idle; dashboards can keep requests active while polling.
  await page.evaluate(() => new Promise<void>((resolve) => {
    let quiet = window.setTimeout(done, 600);
    const observer = new MutationObserver(() => { window.clearTimeout(quiet); quiet = window.setTimeout(done, 600); });
    const limit = window.setTimeout(done, 6000);
    function done() { observer.disconnect(); window.clearTimeout(quiet); window.clearTimeout(limit); resolve(); }
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  }));
  const expected = await page.evaluate(() => {
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const closedDetails = element.closest('details:not([open])');
        const visibleInDetails = !closedDetails || (element.tagName === 'SUMMARY' && element.parentElement === closedDetails);
        return element.tabIndex >= 0 && getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0 && !element.closest('[inert]') && visibleInDetails;
      })
      .map((element) => ({
        label: element.getAttribute('aria-label') || (element.innerText ?? element.textContent ?? '').trim().replace(/\s+/g, ' ') || element.title || `${element.tagName.toLowerCase()} control`,
        html: element.outerHTML.slice(0, 240),
      }));
  });
  expect(expected.length, `${label} has keyboard-accessible controls`).toBeGreaterThan(0);
  await page.evaluate(() => {
    const anchor = document.createElement('span');
    anchor.tabIndex = 0;
    anchor.setAttribute('aria-hidden', 'true');
    anchor.dataset.a11yFocusAnchor = 'true';
    anchor.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;outline:none';
    document.body.prepend(anchor);
    anchor.focus();
  });
  const visited = new Set<number>();
  try {
    const maxTabPresses = expected.length * 2;
    for (let tabPress = 0; tabPress < maxTabPresses && visited.size < expected.length; tabPress += 1) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]):not([data-a11y-focus-anchor])';
        const controls = Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter((candidate) => {
            const closedDetails = candidate.closest('details:not([open])');
            const visibleInDetails = !closedDetails || (candidate.tagName === 'SUMMARY' && candidate.parentElement === closedDetails);
            return candidate.tabIndex >= 0 && getComputedStyle(candidate).visibility !== 'hidden' && candidate.getClientRects().length > 0 && !candidate.closest('[inert]') && visibleInDetails;
          });
        const label = element && (element.getAttribute('aria-label') || (element.innerText ?? element.textContent ?? '').trim().replace(/\s+/g, ' ') || element.title || `${element.tagName.toLowerCase()} control`);
        return {
          index: element ? controls.indexOf(element) : -1,
          label,
          tagName: element?.tagName,
          className: typeof element?.className === 'string' ? element.className : '',
          outline: element ? getComputedStyle(element).outlineStyle : 'none',
          outlineWidth: element ? getComputedStyle(element).outlineWidth : '0px',
          boxShadow: element ? getComputedStyle(element).boxShadow : 'none',
        };
      });
      if (focus.index < 0) break;
      visited.add(focus.index);
      const hasIndicator = (
        (focus.outline !== 'none' && focus.outlineWidth !== '0px') ||
        focus.boxShadow !== 'none'
      );
      expect(
        hasIndicator,
        `${label} control ${focus.label ?? focus.tagName ?? 'no active element'} has a visible focus indicator; outline=${focus.outline} ${focus.outlineWidth}, shadow=${focus.boxShadow}, class=${focus.className}`,
      ).toBe(true);
    }
    const missing = expected
      .map((control, index) => ({ index, control }))
      .filter(({ index }) => !visited.has(index));
    expect(
      visited.size,
      `${label} controls missing from tab order: ${missing.map(({ index, control }) => `${index}: ${control.label} (${control.html})`).join('; ')}`,
    ).toBe(expected.length);
  } finally {
    await page.evaluate(() => document.querySelector('body > [data-a11y-focus-anchor]')?.remove());
  }
};

test('public and role-specific pages have no critical or serious axe violations', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(1_500_000);
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
      await settleThemeTransition(page);
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
    // The map is a lazy chunk. On a cold dev server the page can still be painting when the scan starts, so wait for it.
    await publicPage.locator('canvas').waitFor();
    await publicPage.waitForLoadState('networkidle').catch(() => undefined);
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
      await expect(navigation.getByRole('button', { name: caseInsensitiveName(home) })).toBeVisible();
      await scanPage(page, `${role} ${home}`);
      for (const label of pages) {
        await navigation.getByRole('button', { name: caseInsensitiveName(label) }).click();
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
  test.setTimeout(1_500_000);
  test.skip(testInfo.project.name !== 'desktop', 'The complete role-page keyboard sweep runs once per CI workflow.');

  for (const { role, home, pages } of rolePages) {
    const context = await browser.newContext({ baseURL, storageState: AUTH[role] });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      const navigation = page.getByRole('navigation', { name: 'Workspace navigation' });
      await expect(navigation.getByRole('button', { name: caseInsensitiveName(home) })).toBeVisible();
      await assertKeyboardReachability(page, `${role} home`);

      for (const label of pages) {
        await navigation.getByRole('button', { name: caseInsensitiveName(label) }).click();
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
    await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: caseInsensitiveName('Top charts') }).click();
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

test('reduced motion stops the map animation without hiding its content', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The motion preference check runs once per CI workflow.');
  const context = await browser.newContext({ baseURL, storageState: guestStorageState, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    console.log('Opening the marketplace with reduced motion enabled.');
    await page.goto('/');
    const map = page.locator('canvas');
    console.log('Waiting for the map canvas.');
    await expect(map).toBeVisible();
    // The map is drawn at an idle moment (up to 700 ms after load) and fades in only once it has been drawn, so
    // an earlier read would compare the blank canvas with the finished picture and mistake that for motion.
    await expect(map).toHaveCSS('opacity', '1');
    const initialFrame = await map.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    await page.waitForTimeout(150);
    const settledFrame = await map.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
    expect(settledFrame).toBe(initialFrame);
    expect(await page.locator('canvas + span[aria-hidden="true"]').evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  } finally {
    await context.close();
  }
});

test('checkout and cart dialogs have no critical or serious axe violations in either theme', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The dialog sweep runs once per CI workflow.');
  test.setTimeout(120_000);
  // Start from a known cart instead of clicking a product card: earlier specs leave stock and carts in all sorts of states.
  await clearCartAndOrders();
  await seedCart({ [E2E.products.blanket.id]: 1 });
  const context = await browser.newContext({ baseURL, storageState: AUTH.customer });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await openStorefront(page);

    const scan = (label: string) => scanBothThemes(page, label);

    await page.getByRole('button', { name: 'Shopping Cart' }).click();
    await expect(page.getByRole('button', { name: /Proceed to checkout/i })).toBeVisible();
    await scan('Cart drawer');
    await page.getByRole('button', { name: /Proceed to checkout/i }).click();
    await expect(page.getByTestId('checkout-submit')).toBeVisible();
    await scan('Checkout dialog');
  } finally {
    await context.close();
    await clearCartAndOrders();
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
  test.setTimeout(600_000);
  const context = await browser.newContext({ baseURL, storageState: guestStorageState });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    await page.getByRole('button', { name: /Sign in|Log in|Login/i }).first().click();
    await page.getByRole('button', { name: caseInsensitiveName('Create account'), exact: true }).click();
    await expect(page.getByRole('dialog', { name: caseInsensitiveName('Create an account') })).toBeVisible();
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
