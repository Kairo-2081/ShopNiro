// Regenerates the interface screenshots used in README.md from a throwaway local database.
//
//   createdb shopniro_shots_test && npm run migrate        (DATABASE_URL pointing at it)
//   VITE_API_URL=http://127.0.0.1:3100 SKIP_PRECOMPRESS=1 npm run build
//   NODE_ENV=test PORT=3100 APP_URL=http://127.0.0.1:3100 PAYMENT_SIMULATOR=true LOGIN_RATE_LIMIT_MAX=1000 \
//     npx tsx server/index.ts &
//   npx tsx scripts/capture-readme-screens.mts
//
// It replays the same story as e2e/marketplace-flow.spec.ts (admin approves a seller, the seller lists a product, a
// customer buys it with cash on delivery, the seller ships it, a rider delivers it) and photographs each role at each
// step, so every picture is the real interface running on sample data. Nothing here touches a real database: the
// e2e seeding guard refuses anything that is not a local database, and the sample names below are invented.
import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { AUTH, resetWorld } from '../e2e/global-setup.ts';
import { E2E } from '../e2e/seed.ts';
import { openCheckout, selectWorkspaceNavigationItem, withDb } from '../e2e/helpers.ts';

const BASE = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3100}`;
const OUT = process.env.SHOT_OUT ?? '.github/assets/readme';
// SHOT_THEME=light retakes the screens in the light theme; SHOT_SUFFIX is added to every file name (for example
// "-light") and SHOT_ONLY is a comma-separated list of screen names to keep when only a few are wanted.
const THEME = process.env.SHOT_THEME === 'light' ? 'light' : 'dark';
const SUFFIX = process.env.SHOT_SUFFIX ?? '';
const ONLY = process.env.SHOT_ONLY ? new Set(process.env.SHOT_ONLY.split(',')) : null;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
// The chart pages are long, so they are photographed in a tall window starting at the section heading.
const TALL = { width: 1440, height: 1560 };
mkdirSync(OUT, { recursive: true });

// A small, plain tile used for product and store pictures, so no screenshot shows a broken image and none uses
// someone else's photograph. Colours differ per tile so the catalogue does not look like one repeated square.
function tile(label: string, from: string, to: string): string {
  // Portrait, like the product cards (about 4:5), so the app does not pad it with a blurred strip.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="480" height="600" fill="url(#g)"/><circle cx="240" cy="270" r="116" fill="rgba(255,255,255,.2)"/><text x="240" y="302" text-anchor="middle" font-family="Georgia,serif" font-size="104" fill="rgba(255,255,255,.95)">${label}</text><rect x="160" y="440" width="160" height="14" rx="7" fill="rgba(255,255,255,.4)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function sampleData() {
  await withDb(async (c) => {
    await c.query(`UPDATE categories SET name = 'Home & Living' WHERE name = 'E2E Category'`);
    const rename: Array<[string, string, string, string, string]> = [
      [E2E.products.blanket.id, 'Linen Throw Blanket', 'L', '#7c8f7a', '#3f5646'],
      [E2E.products.dripper.id, 'Ceramic Coffee Dripper', 'C', '#c79a6b', '#7a4e2d'],
      [E2E.products.lamp.id, 'Walnut Desk Lamp', 'W', '#d9b45a', '#8a5a1f'],
      [E2E.products.voucher.id, 'Stoneware Mug', 'S', '#8aa4c8', '#3c5278'],
    ];
    for (const [id, name, letter, from, to] of rename) {
      await c.query('UPDATE products SET name = $2, image = $3 WHERE id = $1', [id, name, tile(letter, from, to)]);
      await c.query('UPDATE order_items SET product_name = $2 WHERE product_id = $1', [id, name]);
    }
    await c.query(`UPDATE sellers SET name = 'Dhaka Home Studio', logo = $2 WHERE id = $1`, [E2E.seller.id, tile('D', '#6d8f86', '#2c4f48')]);
    await c.query(`UPDATE sellers SET name = 'Banani Craft House', logo = $2 WHERE id = $1`, [E2E.newSeller.id, tile('B', '#b0786a', '#6b3a30')]);
    await c.query(`UPDATE customers SET name = 'Sample Customer' WHERE id = $1`, [E2E.customer.id]);
    await c.query(`UPDATE riders SET name = 'Sample Rider' WHERE id = $1`, [E2E.rider.id]);
    await c.query(`UPDATE users SET email = 'owner@banani-craft.example' WHERE id = $1`, [E2E.newSeller.id]);
    await c.query(`UPDATE users SET email = 'customer@sample.example' WHERE id = $1`, [E2E.customer.id]);
    await c.query(`UPDATE users SET username = 'banani-craft' WHERE id = $1`, [E2E.newSeller.id]);
    await c.query(`UPDATE users SET email = 'owner@dhaka-home.example' WHERE id = $1`, [E2E.seller.id]);
  });
}

// About eleven months of invented order history, so the charts have a shape instead of one dot. Deterministic (a
// fixed seed, no Math.random) so a retake looks the same. It runs on the throwaway database only, like everything here.
async function sampleHistory() {
  let seed = 20261122;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  // The history belongs to the store the seller screens show (Banani Craft House), with its own small catalogue.
  const SELLER = E2E.newSeller.id;
  const products = [
    { id: 'SAMPLE-P-1', name: 'Handwoven Jute Rug', price: 3200, tile: tile('J', '#b59a6a', '#6e5530') },
    { id: 'SAMPLE-P-2', name: 'Terracotta Planter Set', price: 1850, tile: tile('T', '#c98b6b', '#7d3f26') },
    { id: 'SAMPLE-P-3', name: 'Cane Pendant Light', price: 4600, tile: tile('P', '#d8c38a', '#8a6f2c') },
    { id: 'SAMPLE-P-4', name: 'Clay Tea Cups', price: 650, tile: tile('C', '#9db2a0', '#4a6650') },
  ];
  const methods = ['cash_on_delivery', 'cash_on_delivery', 'bkash', 'bkash', 'nagad', 'sslcommerz', 'visa_mastercard'];
  const address = JSON.stringify({ House_Name: 'House 1', Street: 'Road 1', City: 'Dhaka', Postal_Code: '1207' });
  await withDb(async (c) => {
    for (const product of products) {
      await c.query(`INSERT INTO products (id, name, price, stock, category_id, seller_id, image) VALUES ($1, $2, $3, 40, 'E2E-CAT', $4, $5)`,
        [product.id, product.name, product.price, SELLER, product.tile]);
    }
    const now = new Date();
    let n = 0;
    for (let back = 11; back >= 0; back -= 1) {
      // Growth with a dip or two, so it is not a ruler-straight line. The app loads the newest 50 orders first, so the whole
      // history stays under that (about 40 orders) and every month reaches the charts.
      const base = 1.2 + (11 - back) * 0.28 + (back === 6 ? -0.9 : 0) + (back === 3 ? -0.6 : 0);
      const count = Math.max(1, Math.round(base + rand() * 1.6));
      for (let i = 0; i < count; i += 1) {
        const day = 1 + Math.floor(rand() * (back === 0 ? Math.max(1, now.getDate() - 1) : 27));
        const placed = new Date(now.getFullYear(), now.getMonth() - back, day, 9 + Math.floor(rand() * 11), Math.floor(rand() * 60));
        const roll = rand();
        const status = roll < 0.07 ? 'cancelled' : back === 0 && roll < 0.3 ? 'processing' : 'delivered';
        const method = methods[Math.floor(rand() * methods.length)];
        const lines = 1 + Math.floor(rand() * 2);
        let subtotal = 0;
        const id = `SAMPLE-O-${++n}`;
        const first = Math.floor(rand() * products.length);
        // Consecutive products, so one order never lists the same product twice.
        const picked = Array.from({ length: lines }, (_, line) => ({ product: products[(first + line) % products.length], quantity: 1 + Math.floor(rand() * 2) }));
        picked.forEach(({ product, quantity }) => { subtotal += product.price * quantity; });
        const paid = status === 'delivered';
        await c.query(
          `INSERT INTO orders (id, tracking_id, customer_id, subtotal, shipping_fee, status, shipping_address_json, billing_address_json,
                               payment_status, payment_method, order_placed_at)
           VALUES ($1, $2, $3, $4, 80, $5, $6, $6, $7, $8, $9)`,
          [id, `TRK-${n}`, E2E.customer.id, subtotal, status, address, status === 'cancelled' ? 'pending' : paid ? 'paid' : 'pending', method, placed]);
        for (const { product, quantity } of picked) {
          await c.query(
            `INSERT INTO order_items (order_id, product_id, seller_id, product_id_snapshot, seller_id_snapshot, product_name, unit_price, quantity, image)
             VALUES ($1, $2, $3, $2, $3, $4, $5, $6, $7)`,
            [id, product.id, SELLER, product.name, product.price, quantity, product.tile]);
        }
        await c.query(
          `INSERT INTO seller_fulfillments (id, order_id, seller_id, subtotal, status, created_at, shipped_at, delivered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [`SAMPLE-F-${n}`, id, SELLER, subtotal, status, placed,
            status === 'delivered' ? new Date(placed.getTime() + 864e5) : null,
            status === 'delivered' ? new Date(placed.getTime() + 3 * 864e5) : null]);
      }
    }
  });
}

async function open(browser: Browser, role: keyof typeof AUTH, viewport = DESKTOP): Promise<Page> {
  const context = await browser.newContext({ storageState: AUTH[role], viewport, deviceScaleFactor: 1, colorScheme: THEME });
  await context.addInitScript((theme) => window.localStorage.setItem('marketpulse_theme', theme), THEME);
  const page = await context.newPage();
  await page.goto(BASE + '/');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1200);
  return page;
}

async function showCatalogue(page: Page) {
  // The workspace scrolls inside its own container, and the heading is already partly on screen, so scroll it to the top.
  await page.getByRole('heading', { name: 'All catalog products' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(500);
}

// Scrolls a section to the top and gives the count-up numbers and the arcs, which start when they scroll into view,
// time to finish before the picture is taken.
async function showSection(page: Page, heading: string | RegExp) {
  await page.getByRole('heading', { name: heading }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, 40);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(2600);
}

async function shot(page: Page, name: string) {
  if (ONLY && !ONLY.has(name)) return;
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}${SUFFIX}.jpg`, type: 'jpeg', quality: 86 });
  console.log('captured', name);
}

const browser = await chromium.launch(process.env.SHOT_CHROMIUM ? { executablePath: process.env.SHOT_CHROMIUM } : {});
try {
  await resetWorld();
  await sampleData();

  // Admin reviews and approves the new seller.
  {
    const admin = await open(browser, 'admin');
    await selectWorkspaceNavigationItem(admin, /Merchant approvals/);
    await admin.getByRole('button', { name: /Banani Craft House.*View application/ }).first().click();
    for (const label of ['Identity verified', 'Documents reviewed', 'Payout account verified']) await admin.getByLabel(label).check();
    await shot(admin, 'app-admin-seller-review');
    await admin.getByRole('button', { name: /Approve seller/i }).click();
    await withDb(async (c) => c.query(`SELECT 1`));
    await admin.waitForTimeout(800);
    await admin.context().close();
  }

  // The approved seller lists a product.
  {
    const seller = await open(browser, 'seller');
    await seller.getByRole('button', { name: /Add your first product/i }).click();
    await seller.getByPlaceholder('e.g. Wireless Noise-Canceling Headphones').fill('Brass Pour-Over Kettle');
    await seller.locator('select[required]').first().selectOption({ label: 'Home & Living' });
    const numbers = seller.locator('input[type="number"][required]');
    await numbers.nth(0).fill('2450');
    await numbers.nth(1).fill('14');
    await shot(seller, 'app-seller-new-product');
    await seller.getByRole('button', { name: /Add product/i }).click();
    await seller.waitForTimeout(1200);
    await withDb(async (c) => c.query(
      // A new product keeps its default photo, an external image, in the gallery too; point both at the local tile so the
      // product detail dialog does not show a broken image when the capture machine is offline.
      `UPDATE products SET image = $1, images_json = jsonb_build_array($1::text) WHERE name = 'Brass Pour-Over Kettle'`,
      [tile('K', '#b8863b', '#5e3d12')]));
    await seller.reload();
    await seller.waitForTimeout(1200);
    await shot(seller, 'app-seller-catalog');
    // From here on the store has a year of invented history, so the sales charts have something to show.
    await sampleHistory();
    await seller.context().close();
  }

  // The customer shops and checks out with cash on delivery.
  let orderId = '';
  {
    const customer = await open(browser, 'customer');
    await showCatalogue(customer);
    await shot(customer, 'app-customer-storefront');
    const card = customer.locator('[data-testid="product-card"]', { hasText: 'Brass Pour-Over Kettle' });
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await openCheckout(customer);
    await customer.getByText(/Cash on Delivery \(COD\)/i).click();
    await customer.getByRole('checkbox').check();
    await shot(customer, 'app-customer-checkout');
    await customer.getByTestId('checkout-submit').click();
    await customer.getByRole('heading', { name: 'Order placed' }).waitFor();
    await shot(customer, 'app-customer-order-placed');
    orderId = (await withDb(async (c) => (await c.query(
      `SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE oi.product_name = 'Brass Pour-Over Kettle' ORDER BY o.order_placed_at DESC LIMIT 1`)).rows[0])).id;
    await customer.context().close();
  }

  // The seller ships it.
  {
    const seller = await open(browser, 'seller');
    await selectWorkspaceNavigationItem(seller, /Fulfillment Orders/);
    await seller.getByRole('combobox').first().selectOption('shipped');
    await seller.waitForTimeout(1200);
    await shot(seller, 'app-seller-fulfillment');
    await seller.context().close();
    const analytics = await open(browser, 'seller', TALL);
    await selectWorkspaceNavigationItem(analytics, /Sales analytics/);
    await showSection(analytics, 'Sales Analytics');
    await shot(analytics, 'app-seller-analytics');
    await analytics.context().close();
  }

  // The rider claims and delivers it.
  let code = '';
  {
    const rider = await open(browser, 'rider');
    await rider.getByRole('button', { name: /^Refresh$/i }).click();
    await shot(rider, 'app-rider-available');
    await rider.getByRole('button', { name: /Claim delivery/i }).click();
    await rider.getByRole('button', { name: /On the way/i }).click();
    await rider.getByText(/Tell the customer this delivery code/i).waitFor();
    await shot(rider, 'app-rider-active');
    await rider.getByRole('button', { name: /Confirm received/i }).click();
    await rider.getByText(/COD collection recorded/).waitFor();
    await shot(rider, 'app-rider-cash-recorded');
    await rider.context().close();
    code = (await withDb(async (c) => (await c.query(
      `SELECT rd.confirmation_code FROM rider_deliveries rd JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
        WHERE sf.order_id = $1`, [orderId])).rows[0])).confirmation_code as string;
  }

  // The customer confirms with the rider's code.
  {
    const customer = await open(browser, 'customer');
    await selectWorkspaceNavigationItem(customer, /Orders|My orders/);
    await customer.getByPlaceholder('6-digit code').fill(code);
    await shot(customer, 'app-customer-orders-confirm');
    await customer.getByRole('button', { name: /Confirm received/i }).click();
    await customer.getByText(/Delivery confirmed/).waitFor();
    await shot(customer, 'app-customer-delivered');
    await customer.context().close();
    const spending = await open(browser, 'customer', TALL);
    await selectWorkspaceNavigationItem(spending, /Orders|My orders/);
    await showSection(spending, 'Your spending');
    await shot(spending, 'app-customer-spending');
    await spending.context().close();
  }

  // Admin views after the order has moved through the marketplace.
  {
    const admin = await open(browser, 'admin');
    await shot(admin, 'app-admin-overview');
    await admin.context().close();
    const charts = await open(browser, 'admin', TALL);
    await showSection(charts, 'Overall Platform Metrics');
    await shot(charts, 'app-admin-charts');
    await charts.context().close();
    const admin2 = await open(browser, 'admin');
    await selectWorkspaceNavigationItem(admin2, /Marketplace metrics/);
    await shot(admin2, 'app-admin-metrics');
    await selectWorkspaceNavigationItem(admin2, /Online payments/);
    await shot(admin2, 'app-admin-payments');
    await admin2.context().close();
  }

  // The same storefront on a phone.
  {
    const phone = await open(browser, 'customer', PHONE);
    await shot(phone, 'app-phone-storefront');
    await showCatalogue(phone);
    await shot(phone, 'app-phone-catalog');
    await phone.context().close();
  }

  // The guest storefront: marketplace, the charts card, a product detail and the sign-up dialog.
  {
    const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, colorScheme: THEME });
    await context.addInitScript(([theme]) => {
      window.localStorage.setItem('marketpulse_theme', theme);
      window.localStorage.setItem('shopniro_locale', 'en');
    }, [THEME]);
    const guest = await context.newPage();
    await guest.goto(BASE + '/');
    await guest.waitForTimeout(2500);
    await guest.getByRole('button', { name: /Browse products/i }).first().click();
    await guest.waitForTimeout(3000);
    await shot(guest, 'shopniro-marketplace');
    if (!ONLY || ONLY.has('shopniro-marketplace-current')) {
      const charts = guest.locator('section', { hasText: 'Marketplace Charts & Trends' }).first();
      await charts.scrollIntoViewIfNeeded();
      await guest.waitForTimeout(1000);
      await charts.screenshot({ path: `${OUT}/shopniro-marketplace-current${SUFFIX}.jpg`, type: 'jpeg', quality: 86 });
      console.log('captured shopniro-marketplace-current');
      await guest.evaluate(() => document.querySelectorAll('*').forEach((element) => { if (element.scrollTop) element.scrollTop = 0; }));
    }
    await guest.getByRole('button', { name: /Brass Pour-Over Kettle|view details/i }).first().click();
    await guest.waitForTimeout(1500);
    await shot(guest, 'shopniro-product-detail');
    await guest.keyboard.press('Escape');
    await guest.waitForTimeout(500);
    await guest.getByRole('button', { name: /Customer signup/i }).first().click();
    await guest.waitForTimeout(1500);
    await shot(guest, 'shopniro-sign-up');
    await context.close();
  }
} finally {
  await browser.close();
}
