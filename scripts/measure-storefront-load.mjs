// Times how long a phone on mobile 4G waits for the first product card, from a cold cache.
//
//   node scripts/measure-storefront-load.mjs [--url http://127.0.0.1:3200] [--runs 7] [--budget-ms 3000]
//
// Point it at a production build (npm run build, then node dist/server.cjs) over a seeded database. The dev server
// ships unbundled React and says nothing about what a visitor downloads.
//
// Two scenarios, because they take different roads to the same screen:
//   guest      opens the site, taps "Explore Marketplace", waits for the first product card
//   returning  a signed-in customer opens the site and lands on the storefront directly
//
// Render serves the site over HTTP/2, where twenty small requests share one connection. A plain Node server speaks
// HTTP/1.1, where a browser opens at most six connections per host and queues the rest, which would make this script
// punish a page for the number of requests it makes in a way production never does. Pass --h2-port to put an HTTP/2 (TLS,
// self-signed) front on the server, the way Render's edge sits in front of the app. The app must have been built with
// VITE_API_URL set to that https origin, and started with APP_URL and CORS_ORIGINS set to it too.
//
// The network and CPU profile is the one Lighthouse calls "Slow 4G on a mid-range phone": 150 ms round trip, 1.6 Mbps
// down, 750 kbps up, a CPU four times slower than this machine. The budget applies to the median AND the slowest run,
// so one lucky run cannot pass and one unlucky run cannot hide.
import { chromium, devices, request } from '@playwright/test';
import { startH2Front } from './lib/h2-front.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const upstreamURL = option('url', 'http://127.0.0.1:3200').replace(/\/$/, '');
const h2Port = Number(option('h2-port', '0'));
const baseURL = h2Port ? `https://127.0.0.1:${h2Port}` : upstreamURL;
const runs = Number(option('runs', '7'));
const budgetMs = Number(option('budget-ms', '3000'));
const productName = option('product', 'E2E Linen Blanket');
// How the guest's tap and the first card are timed:
//   click    Playwright finds the button, waits until it is stable and can receive the tap, clicks, then polls for the
//            card. On the throttled processor those waits are slow while the page is busy, so this is a strict upper bound
//            that includes the test tool's own time. It is the original method and stays the default.
//   in-page  the page itself taps the button the moment it exists and stamps the time the card appears, so nothing of the
//            tool runs on the throttled thread. Times are from the start of navigation.
const method = option('method', 'click');
if (!['click', 'in-page'].includes(method)) throw new Error(`--method must be click or in-page, not ${method}`);
// The seeded customer from e2e/seed.ts. The script signs in once through the real login API, so it works against any
// production build whatever secret it was started with.
const customerLogin = { email: option('customer', 'e2e-customer'), password: option('password', 'E2e-password-1!'), role: 'customer' };

// The server allows 120 API calls a minute per address. A cold load makes about twenty, so back-to-back runs would trip
// the limit and measure error pages. Stay under 100 a minute by pacing the runs, and fail loudly if a 429 slips through.
const API_CALLS_PER_MINUTE = 80;
let nextRunId = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PROFILE = {
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  cpuSlowdown: 4,
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// A returning visitor has the session cookie and the browser-only hint the app writes after a confirmed sign-in.
async function signedInState() {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true, extraHTTPHeaders: { Origin: baseURL } });
  const response = await api.post('/api/auth/login', { data: customerLogin });
  if (!response.ok()) throw new Error(`Sign-in failed: ${response.status()} ${await response.text()}`);
  const state = await api.storageState();
  await api.dispose();
  state.origins = [{ origin: baseURL, localStorage: [{ name: 'shopniro_signed_in_hint', value: String(Date.now()) }] }];
  return state;
}

async function oneRun(browser, scenario, returningState) {
  const storageState = scenario === 'returning' ? returningState : { cookies: [], origins: [] };
  const context = await browser.newContext({
    ...devices['Pixel 5'], baseURL, storageState, ignoreHTTPSErrors: true,
    extraHTTPHeaders: h2Port ? { 'x-measure-run': String(nextRunId += 1) } : {},
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: PROFILE.latency,
    downloadThroughput: PROFILE.downloadThroughput,
    uploadThroughput: PROFILE.uploadThroughput,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE.cpuSlowdown });

  let transferred = 0;
  let apiCalls = 0;
  let rateLimited = 0;
  page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls += 1; });
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/') && response.status() === 429) rateLimited += 1;
  });
  cdp.on('Network.loadingFinished', (event) => { transferred += event.encodedDataLength; });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  if (method === 'in-page') {
    await page.addInitScript(({ name, guest }) => {
      window.__marks = {};
      const mark = (key) => { if (window.__marks[key] === undefined) window.__marks[key] = performance.now(); };
      const check = () => {
        if (guest && window.__marks.tap === undefined) {
          const button = [...document.querySelectorAll('button')].find((candidate) => /Explore Marketplace/i.test(candidate.textContent || ''));
          if (button) { mark('button'); mark('tap'); button.click(); }
        }
        if ((!guest || window.__marks.tap !== undefined) && (document.body?.innerText || '').includes(name)) mark('product');
      };
      new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
    }, { name: productName, guest: scenario === 'guest' });
  }

  const started = performance.now();
  await page.goto('/', { waitUntil: 'commit' });
  let elapsed;
  let tapMs = 0;
  if (method === 'in-page') {
    try {
      await page.waitForFunction(() => window.__marks && window.__marks.product !== undefined, null, { timeout: 60_000, polling: 250 });
    } catch (error) {
      throw new Error(`${scenario}: "${productName}" never appeared (page text starts: ${(await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 160).replace(/\s+/g, ' ')}): ${error.message.split('\n')[0]}`);
    }
    const marks = await page.evaluate(() => window.__marks);
    elapsed = marks.product;
    tapMs = Math.round(marks.tap ?? 0);
  } else {
    if (scenario === 'guest') {
      await page.getByRole('button', { name: 'Explore Marketplace' }).click();
    }
    try {
      await page.getByText(productName, { exact: false }).first().waitFor({ state: 'visible', timeout: 60_000 });
    } catch (error) {
      throw new Error(`${scenario}: "${productName}" never appeared (page text starts: ${(await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 160).replace(/\s+/g, ' ')}): ${error.message.split('\n')[0]}`);
    }
    elapsed = performance.now() - started;
  }
  const lcp = await page.evaluate(() => window.__lcp).catch(() => 0);
  // The page keeps calling the API for a moment after the first product shows. Let those finish so they are counted.
  await sleep(1500);
  await context.close();
  if (rateLimited > 0) throw new Error(`${scenario}: the server answered ${rateLimited} API call(s) with 429, so this run measured an error page. Wait a minute and run again.`);
  return { elapsedMs: Math.round(elapsed), tapMs, lcpMs: Math.round(lcp), transferredKb: Math.round(transferred / 1024), apiCalls, wallMs: Math.round(performance.now() - started) };
}

const front = h2Port ? await startH2Front(h2Port, upstreamURL) : null;
// PERF_CHROMIUM_PATH points at an already installed browser, for a machine where the one Playwright expects is missing.
const browser = await chromium.launch(process.env.PERF_CHROMIUM_PATH ? { executablePath: process.env.PERF_CHROMIUM_PATH } : {});
const report = { baseURL, protocol: h2Port ? 'h2' : 'http/1.1', method, runs, budgetMs, profile: PROFILE, scenarios: {} };
let failed = false;
try {
  const returningState = await signedInState();
  for (const scenario of ['guest', 'returning']) {
    // One throwaway run first: it warms the server's own caches (module compile, connection pool) so the numbers describe
    // the visitor's network and CPU rather than a server that has just started.
    const paced = async () => {
      const result = await oneRun(browser, scenario, returningState);
      // Behind the HTTP/2 front every run has its own address, so there is nothing to pace.
      if (!h2Port) await sleep(Math.max(0, (result.apiCalls * 60_000) / API_CALLS_PER_MINUTE - result.wallMs));
      return result;
    };
    await paced();
    const results = [];
    for (let i = 0; i < runs; i += 1) results.push(await paced());
    const times = results.map((r) => r.elapsedMs);
    const summary = {
      medianMs: Math.round(median(times)),
      worstMs: Math.max(...times),
      bestMs: Math.min(...times),
      medianTapMs: Math.round(median(results.map((r) => r.tapMs))),
      medianLcpMs: Math.round(median(results.map((r) => r.lcpMs))),
      medianTransferredKb: Math.round(median(results.map((r) => r.transferredKb))),
      runsMs: times,
    };
    report.scenarios[scenario] = summary;
    if (summary.medianMs > budgetMs || summary.worstMs > budgetMs) failed = true;
  }
} finally {
  await browser.close();
  front?.close();
}
report.withinBudget = !failed;
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
