// Fails the build when a built file grows past its budget. Sizes are raw bytes in dist/assets.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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
if (failures.length) {
  console.error(`Bundle budget exceeded:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('Bundle budget ok');
