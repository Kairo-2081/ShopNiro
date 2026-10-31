import { expect, type Page } from '@playwright/test';
import pg from 'pg';
import { E2E, assertLocalDatabase } from './seed.ts';

/** Fail loudly if the page ever talks to a host other than the local test server. */
export async function blockNonLocalTraffic(page: Page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const local = ['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol);
    if (local) return route.continue();
    // Fonts, maps and analytics are irrelevant here; refusing them keeps the test offline and safe.
    return route.abort();
  });
}

/** The session comes from the stored login (see global-setup.ts); just open the storefront. */
export async function openStorefront(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Shopping Cart' })).toBeVisible();
}

export async function addToCart(page: Page, productId: string) {
  const card = page.locator(`[data-testid="product-card"][data-product-id="${productId}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.getByRole('button', { name: 'Shopping Cart' })).toContainText('1');
}

/** Put quantities straight into the cart table, so tests do not depend on clicking Add many times. */
export async function seedCart(lines: Record<string, number>) {
  await withDb(async (client) => {
    for (const [productId, quantity] of Object.entries(lines)) {
      await client.query(
        'INSERT INTO cart (id, customer_id, product_id, quantity, size) VALUES ($1, $2, $3, $4, \'\')',
        [`E2E-CART-${productId}`, E2E.customer.id, productId, quantity]
      );
    }
  });
}

export async function openCheckout(page: Page) {
  const proceed = page.getByRole('button', { name: /Proceed to Checkout/ });
  // Adding an item opens the drawer by itself; otherwise open it from the header.
  const drawerOpened = await proceed.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false);
  if (!drawerOpened) await page.getByRole('button', { name: 'Shopping Cart' }).click();
  await proceed.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('checkout-total')).toBeVisible();
}

export const parseMoney = (text: string): number => Number(text.replace(/[^0-9.]/g, ''));

export async function withDb<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: assertLocalDatabase(process.env.DATABASE_URL) });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function latestOrder() {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT id, subtotal::float8 AS subtotal, shipping_fee::float8 AS shipping_fee, payment_method, payment_status, applied_voucher,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id)::int AS lines
         FROM orders o WHERE customer_id = $1 ORDER BY order_placed_at DESC LIMIT 1`,
      [E2E.customer.id]
    );
    return rows[0] as { id: string; subtotal: number; shipping_fee: number; payment_method: string; payment_status: string; applied_voucher: string; lines: number } | undefined;
  });
}

export async function countOrders() {
  return withDb(async (client) => {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM orders WHERE customer_id = $1', [E2E.customer.id]);
    return rows[0].n as number;
  });
}

export async function clearCartAndOrders() {
  await withDb(async (client) => {
    await client.query('DELETE FROM cart WHERE customer_id = $1', [E2E.customer.id]);
    // Children first: every table with a foreign key to orders, refunds before payments.
    for (const table of ['refunds', 'order_cancellation_requests', 'order_status_audit', 'payments', 'seller_fulfillments', 'order_items']) {
      await client.query(`DELETE FROM ${table} WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $1)`, [E2E.customer.id]);
    }
    await client.query('DELETE FROM orders WHERE customer_id = $1', [E2E.customer.id]);
    // Orders take stock; put it back so every test starts from the seeded quantity.
    await client.query('UPDATE products SET stock = 100 WHERE seller_id = $1', [E2E.seller.id]);
  });
}

export async function cartQuantity(productId: string): Promise<number> {
  return withDb(async (client) => {
    const { rows } = await client.query('SELECT COALESCE(SUM(quantity), 0)::int AS n FROM cart WHERE customer_id = $1 AND product_id = $2', [E2E.customer.id, productId]);
    return rows[0].n as number;
  });
}

export async function productStock(productId: string): Promise<number> {
  return withDb(async (client) => {
    const { rows } = await client.query('SELECT stock FROM products WHERE id = $1', [productId]);
    return rows[0].stock as number;
  });
}

export async function latestPayment() {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `SELECT p.status, p.amount::float8 AS amount, p.payment_method FROM payments p
         JOIN orders o ON o.id = p.order_id WHERE o.customer_id = $1 ORDER BY o.order_placed_at DESC LIMIT 1`,
      [E2E.customer.id]
    );
    return rows[0] as { status: string; amount: number; payment_method: string } | undefined;
  });
}

/** Make the customer's latest payment look older than the server's 30-minute gateway-confirmation window. */
export async function ageLatestPayment(minutes: number) {
  await withDb(async (client) => {
    await client.query(
      `UPDATE payments SET created_at = created_at - ($2 || ' minutes')::interval
         WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $1)`,
      [E2E.customer.id, String(minutes)]
    );
  });
}
