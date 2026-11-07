import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, openStorefront, withDb } from './helpers.ts';

test.describe('storefront assistant spacing', () => {
  test.use({ storageState: AUTH.customer });

  test('keeps one assistant entry point and reserves 96px below storefront content', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await openStorefront(page);

    await expect(page.getByRole('button', { name: 'Open ShopNiro AI Assistant' })).toHaveCount(1);
    await expect(page.locator('main')).toHaveCSS('padding-bottom', '96px');
  });
});

test.describe('seller dashboard row actions', () => {
  test.use({ storageState: AUTH.seller });

  test('keeps product row actions 40px, labeled, and clickable', async ({ page }) => {
    const productId = 'E2E-DASHBOARD-ACTION-PRODUCT';
    const productName = 'E2E Dashboard Action Product';
    await withDb((client) => client.query(`
      INSERT INTO products (id, name, price, stock, category_id, seller_id)
      VALUES ($1, $2, 100, 10, 'E2E-CAT', $3)
    `, [productId, productName, E2E.newSeller.id]));

    try {
      await blockNonLocalTraffic(page);
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Product Catalog/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open ShopNiro AI Assistant' })).toHaveCount(1);

      const restock = page.getByRole('button', { name: 'Restock' });
      const status = page.getByRole('switch', { name: `Pause ${productName}` });
      const edit = page.getByRole('button', { name: `Edit ${productName}` });
      const remove = page.getByRole('button', { name: `Delete ${productName}` });
      for (const [action, title] of [
        [restock, `Restock ${productName}`],
        [status, `Pause ${productName}`],
        [edit, `Edit ${productName}`],
        [remove, `Delete ${productName}`],
      ] as const) {
        await expect(action).toBeVisible();
        await expect(action).toHaveAttribute('title', title);
        const bounds = await action.boundingBox();
        expect(bounds?.width).toBeGreaterThanOrEqual(40);
        expect(bounds?.height).toBeGreaterThanOrEqual(40);
      }
      await status.click({ trial: true });

      await restock.click();
      await expect(page.getByRole('spinbutton', { name: `Quantity to add for ${productName}` })).toBeVisible();
      const cancelRestock = page.getByRole('button', { name: `Cancel restock for ${productName}` });
      expect((await cancelRestock.boundingBox())?.width).toBe(40);
      expect((await cancelRestock.boundingBox())?.height).toBe(40);
      await cancelRestock.click();

      await edit.click();
      await expect(page.getByRole('dialog', { name: 'Edit Product Listing' })).toBeVisible();
      await page.getByRole('button', { name: 'Close product editor' }).click();

      await remove.click();
      await expect(page.getByRole('dialog', { name: `Delete ${productName}?` })).toBeVisible();
      await page.getByRole('button', { name: 'Keep product' }).click();
    } finally {
      await withDb((client) => client.query('DELETE FROM products WHERE id = $1', [productId]));
    }
  });
});

test.describe('admin dashboard row actions', () => {
  test.use({ storageState: AUTH.admin });

  test('keeps category row actions labeled, 40px, and clickable', async ({ page }) => {
    await blockNonLocalTraffic(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: /Governance Overview/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open ShopNiro AI Assistant' })).toHaveCount(1);
    await page.getByRole('button', { name: /Category Registry/ }).click();

    const edit = page.getByRole('button', { name: 'Edit category E2E Category' });
    const remove = page.getByRole('button', { name: 'Delete category E2E Category' });
    await expect(edit).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(edit).toHaveAttribute('title', 'Edit category E2E Category');
    await expect(remove).toHaveAttribute('title', 'Delete category E2E Category');

    const editBounds = await edit.boundingBox();
    const removeBounds = await remove.boundingBox();
    expect(editBounds?.width).toBe(40);
    expect(editBounds?.height).toBe(40);
    expect(removeBounds?.width).toBe(40);
    expect(removeBounds?.height).toBe(40);

    await remove.click({ trial: true });
    await edit.click();
    const save = page.getByRole('button', { name: 'Save' });
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(save).toBeVisible();
    await expect(cancel).toBeVisible();
    expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(40);
    expect((await cancel.boundingBox())?.height).toBeGreaterThanOrEqual(40);
    await cancel.click();
    await expect(edit).toBeVisible();
  });
});
