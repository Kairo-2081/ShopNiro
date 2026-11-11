// Fails the build when a built file grows past its budget. Sizes are raw bytes in dist/assets.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = path.join(process.cwd(), 'dist', 'assets');
const KB = 1024;
const budgets = [
  { match: /^(vendor-charts|pdf)-.*\.js$/, max: 450 * KB, label: 'large vendor chunk' },
  { match: /^vendor-.*\.js$/, max: 250 * KB, label: 'vendor chunk' },
  { match: /\.js$/, max: 200 * KB, label: 'app chunk' },
  { match: /\.css$/, max: 200 * KB, label: 'stylesheet' },
  { match: /\.(png|jpe?g|webp)$/, max: 400 * KB, label: 'image' },
  // The closing animation is lazy-loaded below the fold; this only stops it growing further.
  { match: /\.gif$/, max: 5200 * KB, label: 'animated image' },
];
const ignored = /\.(mjs|map)$/; // the pdf.js worker is fetched only on demand

const failures = [];
for (const file of readdirSync(dir)) {
  if (ignored.test(file)) continue;
  const size = statSync(path.join(dir, file)).size;
  const rule = budgets.find((b) => b.match.test(file));
  if (rule && size > rule.max) failures.push(`${file}: ${(size / KB).toFixed(0)} kB is over the ${(rule.max / KB).toFixed(0)} kB ${rule.label} budget`);
}
// What the first page downloads before anything can paint: the scripts and styles that index.html loads itself.
// Measured gzipped, because that is what travels once the server compresses. Lazy chunks are not part of it.
const FIRST_LOAD_BUDGET = 150 * KB;
const distRoot = path.join(process.cwd(), 'dist');
const indexHtml = readFileSync(path.join(distRoot, 'index.html'), 'utf8');
const firstLoadFiles = [...new Set([...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]))];
const firstLoad = firstLoadFiles.map((file) => ({ file, gzip: gzipSync(readFileSync(path.join(distRoot, file))).length }));
const firstLoadTotal = firstLoad.reduce((sum, entry) => sum + entry.gzip, 0);
if (firstLoadFiles.length === 0) failures.push('index.html loads no scripts or styles from /assets, so the first-load budget could not be measured');
if (firstLoadTotal > FIRST_LOAD_BUDGET) {
  failures.push(`first load is ${(firstLoadTotal / KB).toFixed(0)} kB gzipped, over the ${(FIRST_LOAD_BUDGET / KB).toFixed(0)} kB budget (${firstLoad.map((entry) => `${path.basename(entry.file)} ${(entry.gzip / KB).toFixed(0)} kB`).join(', ')})`);
}

if (failures.length) {
  console.error(`Bundle budget exceeded:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Bundle budget ok (first load ${(firstLoadTotal / KB).toFixed(0)} of ${(FIRST_LOAD_BUDGET / KB).toFixed(0)} kB gzipped)`);
