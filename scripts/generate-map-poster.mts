// Renders the landing map to a transparent WebP per language, using the same drawMap code the page uses, so the poster
// shown while the live canvas loads is the same picture. Run it after changing the map, the cities or the palette:
//   npm run build && npx vite preview --port 4173 & npx tsx scripts/generate-map-poster.mts
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'public';

const browser = await chromium.launch();
try {
  for (const locale of ['en', 'bn'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript((value) => window.localStorage.setItem('shopniro_locale', value), locale);
    const page = await context.newPage();
    await page.goto(BASE + '/');
    const canvas = page.locator('canvas');
    await canvas.waitFor();
    await page.waitForFunction(() => document.querySelector('canvas')?.style.opacity === '1');
    // The bold Bangla labels need the system Bengali font; wait until fonts have settled before reading the pixels.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    // Half the live canvas's pixel density: the poster is on screen only until the sharp canvas replaces it, and this keeps
    // each file small enough to be worth showing first.
    const dataUrl = await canvas.evaluate((element) => {
      const source = element as HTMLCanvasElement;
      const small = document.createElement('canvas');
      small.width = Math.round(source.width / 1.5);
      small.height = Math.round(source.height / 1.5);
      small.getContext('2d')!.drawImage(source, 0, 0, small.width, small.height);
      return small.toDataURL('image/webp', 0.6);
    });
    writeFileSync(`${OUT}/map-poster-${locale}.webp`, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', locale);
    await context.close();
  }
} finally {
  await browser.close();
}
