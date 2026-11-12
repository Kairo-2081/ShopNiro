// Rebuilds ShopNiro-new-round.webp from the GIF source. The footer shows the animation at 144 CSS px, so the WebP is
// 432 px (3x) rather than the GIF's 500 px, which keeps it sharp on high-density phones at about 1% of the GIF's size.
//
//   node scripts/encode-closing-animation.mjs
//
// Needs sharp, which is deliberately not a project dependency (it is only used to make this one asset). Install it
// without touching package.json first:  npm install --no-save sharp
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');

const SOURCE = 'ShopNiro-new-round.gif';
const TARGET = 'ShopNiro-new-round.webp';
const SIZE = 432;

const webp = await sharp(SOURCE, { animated: true })
  .resize(SIZE, SIZE)
  .webp({ quality: 75, effort: 6, loop: 0, alphaQuality: 90 })
  .toBuffer();
await writeFile(TARGET, webp);

const { pages, delay } = await sharp(webp, { animated: true }).metadata();
console.log(`${TARGET}: ${(webp.length / 1024).toFixed(0)} kB, ${pages} frames, ${delay.reduce((a, b) => a + b, 0)} ms loop`);
