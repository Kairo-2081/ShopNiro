import { expect, test, type Browser, type Page } from '@playwright/test';
import { AUTH, resetWorld } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, openCheckout, openWorkspaceNavigationItem, parseMoney, withDb } from './helpers.ts';

// One story across four roles: an admin approves a new seller, the seller lists a product, a customer buys it
// with cash on delivery, the seller ships it, and a rider delivers it with the customer's confirmation code.
const STORY_TIMEOUT_MS = 120_000;
const PRODUCT = { name: 'E2E Flow Kettle', price: 120, stock: 5 };

async function asRole(browser: Browser, role: keyof typeof AUTH): Promise<Page> {
  const context = await browser.newContext({ storageState: AUTH[role] });
  const page = await context.newPage();
  await blockNonLocalTraffic(page);
  await page.goto('/');
  return page;
}

// The story changes a lot (an approval, a product, a delivered order with rider and wallet rows). Reseeding before it
// keeps every project (desktop, phone, narrow) starting from the same pending seller, and reseeding after it keeps
// that delivered order out of the way of the other specs. Reseeding empties the session table, so resetWorld signs every role in again.
test.beforeAll(async () => { await resetWorld(); });
test.afterAll(async () => { await resetWorld(); });

test('admin approves a seller, who lists a product that a customer buys and a rider delivers', async ({ browser }) => {
  // Four roles, each in its own browser context: about 35 s on a quiet laptop, so the usual 30 s is too tight even locally.
  test.setTimeout(STORY_TIMEOUT_MS);
  await test.step('admin approves the new seller', async () => {
    const admin = await asRole(browser, 'admin');
    // Approval needs the review checklist, so it goes through the application panel, not the quick button.
    await admin.getByRole('button', { name: new RegExp(`${E2E.newSeller.name}.*View application`) }).first().click();
    for (const label of ['Identity verified', 'Documents reviewed', 'Payout account verified']) await admin.getByLabel(label).check();
    await admin.getByRole('button', { name: 'Approve seller' }).click();
    await expect.poll(async () => withDb(async (c) => (await c.query('SELECT status FROM sellers WHERE id = $1', [E2E.newSeller.id])).rows[0].status)).toBe('approved');
    await admin.context().close();
  });

  await test.step('seller lists a product', async () => {
    const seller = await asRole(browser, 'seller');
    // A seller with no products sees the first-product prompt; the header button appears after the first listing.
    await seller.getByRole('button', { name: 'Add your first product' }).click();
    await seller.getByPlaceholder('e.g. Wireless Noise-Canceling Headphones').fill(PRODUCT.name);
    // The form's labels are not tied to their inputs, so the fields are found by type and order.
    await seller.locator('select[required]').first().selectOption({ label: 'E2E Category' });
    const numbers = seller.locator('input[type="number"][required]');
    await numbers.nth(0).fill(String(PRODUCT.price));
    await numbers.nth(1).fill(String(PRODUCT.stock));
    await seller.getByRole('button', { name: 'Save Product' }).click();
    await expect.poll(async () => withDb(async (c) => (await c.query('SELECT COUNT(*)::int AS n FROM products WHERE name = $1', [PRODUCT.name])).rows[0].n)).toBe(1);
    await seller.context().close();
  });

  let orderId = '';
  await test.step('customer buys it with cash on delivery', async () => {
    const customer = await asRole(browser, 'customer');
    const card = customer.locator('[data-testid="product-card"]', { hasText: PRODUCT.name });
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('button', { name: 'Add to Cart' }).click();
    await openCheckout(customer);
    await customer.getByText('Cash on Delivery (COD)').click();
    await customer.getByRole('checkbox').check();
    const shown = parseMoney(await customer.getByTestId('checkout-total').innerText());
    await customer.getByTestId('checkout-submit').click();
    await expect(customer.getByRole('heading', { name: 'Order placed' })).toBeVisible();
    const order = await withDb(async (c) => (await c.query(
      `SELECT o.id, o.subtotal::float8 + o.shipping_fee::float8 AS total FROM orders o
        JOIN order_items oi ON oi.order_id = o.id WHERE oi.product_name = $1 ORDER BY o.order_placed_at DESC LIMIT 1`, [PRODUCT.name])).rows[0]);
    expect(order.total).toBeCloseTo(shown, 2);
    orderId = order.id;
    await customer.context().close();
  });

  await test.step('seller ships the order', async () => {
    const seller = await asRole(browser, 'seller');
    await openWorkspaceNavigationItem(seller, /Fulfillment Orders/);
    await seller.getByRole('combobox').first().selectOption('shipped');
    await expect.poll(async () => withDb(async (c) => (await c.query('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status)).toBe('shipped');
    await seller.context().close();
  });

  await test.step('rider accepts, starts and records cash for the delivery', async () => {
    const rider = await asRole(browser, 'rider');
    await rider.getByRole('button', { name: 'Refresh jobs' }).click();
    await rider.getByRole('button', { name: 'Accept shipment' }).click();
    await rider.getByRole('button', { name: 'Start delivery' }).click();
    await expect(rider.getByText('Tell the customer this delivery code')).toBeVisible();
    await rider.getByRole('button', { name: /collected/ }).click();
    await expect(rider.getByText(/COD collection recorded/)).toBeVisible();
    await rider.context().close();
  });

  await test.step('customer confirms receipt with the rider code and the order is delivered', async () => {
    const code = await withDb(async (c) => (await c.query(
      `SELECT rd.confirmation_code FROM rider_deliveries rd JOIN seller_fulfillments sf ON sf.id = rd.fulfillment_id
        WHERE sf.order_id = $1`, [orderId])).rows[0].confirmation_code as string);
    const customer = await asRole(browser, 'customer');
    await openWorkspaceNavigationItem(customer, /Orders|My orders/);
    await customer.getByPlaceholder('6-digit code').fill(code);
    await customer.getByRole('button', { name: 'Confirm received' }).click();
    await expect(customer.getByText(/Delivery confirmed/)).toBeVisible();
    await expect.poll(async () => withDb(async (c) => (await c.query('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status)).toBe('delivered');
    await customer.context().close();
  });
});
