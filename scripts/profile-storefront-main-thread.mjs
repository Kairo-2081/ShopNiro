// Shows what the browser's main thread spends its time on while a guest opens the site and waits for the first product
// card, on the same emulated phone as scripts/measure-storefront-load.mjs (mobile 4G, CPU four times slower).
//
//   node scripts/profile-storefront-main-thread.mjs [--url http://127.0.0.1:3200] [--h2-port 3443] [--top 15]
//
// It prints two things, both from one cold run:
//   long animation frames  every stretch over 50 ms where the page could not paint, with the scripts that ran in it
//   sampled self time      the CPU profiler's samples grouped by bundle file and function, so a slow file has a name
// Use a production build (see measure-storefront-load.mjs for how to serve one behind an HTTP/2 front). Sampling a dev
// server would profile unbundled React and say nothing about what a visitor runs.
import { chromium, devices } from '@playwright/test';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const upstream = option('url', 'http://127.0.0.1:3200').replace(/\/$/, '');
const baseURL = option('base-url', upstream);
const top = Number(option('top', '15'));
const productName = option('product', 'E2E Linen Blanket');

// PERF_CHROMIUM_PATH points at an already installed browser, for a machine where the one Playwright expects is missing.
const browser = await chromium.launch(process.env.PERF_CHROMIUM_PATH ? { executablePath: process.env.PERF_CHROMIUM_PATH } : {});
const context = await browser.newContext({ ...devices['Pixel 5'], baseURL, ignoreHTTPSErrors: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });

await page.addInitScript(() => {
  window.__frames = [];
  try {
    new PerformanceObserver((list) => {
      for (const frame of list.getEntries()) {
        window.__frames.push({
          start: Math.round(frame.startTime),
          duration: Math.round(frame.duration),
          blocking: Math.round(frame.blockingDuration ?? 0),
          scripts: frame.scripts.map((s) => ({
            source: (s.sourceURL || '').split('/').pop(),
            name: s.sourceFunctionName || s.invoker || '',
            kind: s.invokerType,
            ms: Math.round(s.duration),
          })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {
    // An older browser has no long-animation-frame; the sampled profile below still works.
  }
});

await cdp.send('Profiler.start');
const started = performance.now();
await page.goto('/', { waitUntil: 'commit' });
await page.getByRole('button', { name: 'Explore Marketplace' }).click();
await page.getByText(productName, { exact: false }).first().waitFor({ state: 'visible', timeout: 60_000 });
const elapsed = Math.round(performance.now() - started);
const { profile } = await cdp.send('Profiler.stop');
const frames = await page.evaluate(() => window.__frames);

// Self time per function: each sample is charged to the node it landed on, weighted by the gap to the next sample.
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const self = new Map();
profile.samples.forEach((id, i) => {
  const node = nodes.get(id);
  const { functionName, url, lineNumber } = node.callFrame;
  if (functionName === '(idle)' || functionName === '(program)') return;
  const key = `${(url || '(native)').split('/').pop() || '(native)'} · ${functionName || '(anonymous)'}`;
  const ms = (profile.timeDeltas[i] ?? 0) / 1000;
  self.set(key, (self.get(key) ?? 0) + ms);
});
const byFile = new Map();
for (const [key, ms] of self) {
  const file = key.split(' · ')[0];
  byFile.set(file, (byFile.get(file) ?? 0) + ms);
}
const rank = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, ms]) => ({ name, ms: Math.round(ms) }));

console.log(JSON.stringify({
  firstProductMs: elapsed,
  cpuThrottle: 4,
  longAnimationFrames: frames.filter((f) => f.duration >= 50),
  selfTimeByFileMs: rank(byFile),
  selfTimeByFunctionMs: rank(self),
}, null, 2));
await browser.close();
