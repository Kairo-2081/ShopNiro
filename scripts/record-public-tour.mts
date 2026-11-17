// Records the public-site tour for the README: landing page, browsing, search, a product detail and the sign-up role
// choice, as a 1280x720 WebM. It never signs in, checks out or pays. Run the app on BASE first (see
// capture-readme-screens.mts for the sample data), then: npx tsx scripts/record-public-tour.mts
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, renameSync, rmSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const THEME = process.env.SHOT_THEME === 'dark' ? 'dark' : 'light';
const OUT = process.env.TOUR_OUT ?? '.github/assets/readme/shopniro-public-tour-raw.webm';
const TMP = '/tmp/shopniro-tour-video';
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Scrolls the page the way a person does: in small steps, not one jump. */
async function scrollBy(page: Page, total: number, steps = 24, gap = 45) {
  await page.mouse.move(640, 400);
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, total / steps);
    await pause(page, gap);
  }
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: THEME,
    recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
  });
  await context.addInitScript(([theme]) => {
    window.localStorage.setItem('marketpulse_theme', theme);
    window.localStorage.setItem('shopniro_locale', 'en');
  }, [THEME]);
  const page = await context.newPage();

  // Landing: the map, then the trace button.
  await page.goto(BASE + '/');
  await page.locator('canvas').waitFor();
  await pause(page, 3500);
  await page.getByRole('button', { name: 'Trace the delivery routes' }).click();
  await pause(page, 4500);

  // Scroll through the sections.
  for (let section = 0; section < 5; section += 1) {
    await scrollBy(page, 640);
    await pause(page, 2600);
  }
  await scrollBy(page, -4000, 40, 30);
  await pause(page, 1200);

  // Browse, search, open a product.
  await page.getByRole('button', { name: /Browse products/i }).first().click();
  await pause(page, 4000);
  await scrollBy(page, 520);
  await pause(page, 2500);
  await scrollBy(page, -520);
  await pause(page, 800);
  const search = page.getByPlaceholder('Search products');
  await search.click();
  await search.pressSequentially('mug', { delay: 220 });
  await pause(page, 3000);
  await search.fill('');
  await pause(page, 1500);
  await page.getByRole('button', { name: /view details/i }).first().click();
  await pause(page, 5000);
  await page.keyboard.press('Escape');
  await pause(page, 1200);

  // Sign-up role choice.
  await page.getByRole('button', { name: /Customer signup/i }).first().click();
  await pause(page, 2500);
  await page.getByRole('button', { name: /Merchant/i }).first().click();
  await pause(page, 1800);
  await page.getByRole('button', { name: /Rider/i }).first().click();
  await pause(page, 1800);
  await page.getByRole('button', { name: /Customer/i }).first().click();
  await pause(page, 2500);

  const video = page.video();
  await context.close();
  renameSync(await video!.path(), OUT);
  console.log('recorded', OUT);
} finally {
  await browser.close();
}
