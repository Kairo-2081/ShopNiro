import { expect, test } from '@playwright/test';
import { blockNonLocalTraffic } from './helpers.ts';

const guestStorageState = { cookies: [], origins: [] };

test('the landing map stays still, ignores dragging, and only brightens its routes on request', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The map is checked once per CI workflow.');
  test.setTimeout(90_000);
  // No reduced-motion preference: the map must be still for everyone, not only for people who ask.
  const context = await browser.newContext({ baseURL, storageState: guestStorageState });
  const page = await context.newPage();
  try {
    await blockNonLocalTraffic(page);
    await page.goto('/');
    const map = page.locator('canvas');
    await expect(map).toBeVisible();
    // The first draw waits for an idle moment and then fades the picture in, so wait for it before reading pixels.
    await expect(map).toHaveCSS('opacity', '1');
    const frame = () => map.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());

    // The page has a slow backdrop drift on the body, which is not part of the map. Everything between the map and the
    // page root (its wrapper and the hero around it) must have no running CSS animation.
    const movingAroundMap = await map.evaluate((canvas) => {
      const chain = new Set<Element>();
      for (let node: Element | null = canvas; node && node.parentElement && node.parentElement !== document.body; node = node.parentElement) {
        chain.add(node);
      }
      // The outermost element in the chain is the app root, which carries only theme colour transitions.
      return document.getAnimations()
        .filter((animation) => animation instanceof CSSAnimation)
        .map((animation) => (animation.effect as KeyframeEffect | null)?.target as Element | null)
        .filter((target): target is Element => Boolean(target) && chain.has(target!))
        .map((target) => `${target.tagName} ${target.className.toString().slice(0, 50)}`);
    });
    expect(movingAroundMap, 'nothing wrapping the map floats or spins').toEqual([]);

    const first = await frame();
    await page.waitForTimeout(2500);
    expect(await frame(), 'the map does not move over time').toBe(first);

    const box = await map.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 90, box!.y + box!.height / 2 + 10, { steps: 8 });
    await page.mouse.up();
    expect(await frame(), 'dragging does not move the map').toBe(first);

    await page.getByRole('button', { name: 'Trace the delivery routes' }).click();
    await expect.poll(frame, { message: 'the routes brighten when asked' }).not.toBe(first);
    await expect.poll(frame, { timeout: 8000, message: 'the routes settle back to rest' }).toBe(first);

    await expect(page.getByText(/delivery routes linking .*Dhaka is connected to every other city/i)).toBeAttached();
  } finally {
    await context.close();
  }
});

test('the floating badges never sit on top of the map at any width', async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Widths are set here, so this runs once per CI workflow.');
  test.setTimeout(90_000);
  for (const width of [360, 768, 900, 1024, 1099, 1100, 1280, 1536]) {
    const context = await browser.newContext({ baseURL, storageState: guestStorageState, viewport: { width, height: 800 } });
    const page = await context.newPage();
    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      const canvas = await page.locator('canvas').boundingBox();
      expect(canvas, `map is on the page at ${width}px`).not.toBeNull();
      for (const badge of await page.locator('.floating-badge:visible').all()) {
        const box = await badge.boundingBox();
        const overlaps = box !== null
          && box.x < canvas!.x + canvas!.width && box.x + box.width > canvas!.x
          && box.y < canvas!.y + canvas!.height && box.y + box.height > canvas!.y;
        expect(overlaps, `a floating badge covers the map at ${width}px`).toBe(false);
      }
    } finally {
      await context.close();
    }
  }
});
