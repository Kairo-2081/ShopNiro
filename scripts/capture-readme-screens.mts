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
const OUT = '.github/assets/readme';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
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

async function open(browser: Browser, role: keyof typeof AUTH, viewport = DESKTOP): Promise<Page> {
  const context = await browser.newContext({ storageState: AUTH[role], viewport, deviceScaleFactor: 1, colorScheme: 'dark' });
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

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 86 });
  console.log('captured', name);
}

const browser = await chromium.launch();
try {
  await resetWorld();
  await sampleData();

  // Admin reviews and approves the new seller.
  {
    const admin = await open(browser, 'admin');
    await shot(admin, 'app-admin-overview');
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
      `UPDATE products SET image = $1 WHERE name = 'Brass Pour-Over Kettle'`, [tile('K', '#b8863b', '#5e3d12')]));
    await seller.reload();
    await seller.waitForTimeout(1200);
    await shot(seller, 'app-seller-catalog');
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
    await selectWorkspaceNavigationItem(seller, /Sales analytics/);
    await shot(seller, 'app-seller-analytics');
    await seller.context().close();
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
  }

  // Admin views after the order has moved through the marketplace.
  {
    const admin = await open(browser, 'admin');
    await selectWorkspaceNavigationItem(admin, /Marketplace metrics/);
    await shot(admin, 'app-admin-metrics');
    await selectWorkspaceNavigationItem(admin, /Online payments/);
    await shot(admin, 'app-admin-payments');
    await admin.context().close();
  }

  // The same storefront on a phone.
  {
    const phone = await open(browser, 'customer', PHONE);
    await shot(phone, 'app-phone-storefront');
    await showCatalogue(phone);
    await shot(phone, 'app-phone-catalog');
    await phone.context().close();
  }
} finally {
  await browser.close();
}
