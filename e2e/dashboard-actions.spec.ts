import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, openStorefront, openWorkspaceNavigationItem, withDb } from './helpers.ts';

const expectWorkspaceNavigationItem = async (page: import('@playwright/test').Page, name: string | RegExp) => {
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  const sidebar = page.getByRole('navigation', { name: 'Workspace navigation' });
  // The page may still be rendering. Wait for whichever of the two navigation forms this viewport uses before choosing.
  await expect(trigger.or(sidebar.first())).toBeVisible();
  if (await trigger.isVisible()) {
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(drawer.getByRole('button', { name })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    return;
  }

  await expect(page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name })).toBeVisible();
};

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
      await expectWorkspaceNavigationItem(page, /Product Catalog/);
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
        // Layout can land a hair under 40px (39.9999) from sub-pixel rounding, which is still a 40px target.
        expect(bounds?.width).toBeGreaterThanOrEqual(39.9);
        expect(bounds?.height).toBeGreaterThanOrEqual(39.9);
      }
      await status.click({ trial: true });

      await restock.click();
      await expect(page.getByRole('spinbutton', { name: `Quantity to add for ${productName}` })).toBeVisible();
      const cancelRestock = page.getByRole('button', { name: `Cancel restock for ${productName}` });
      expect((await cancelRestock.boundingBox())?.width).toBeCloseTo(40, 1);
      expect((await cancelRestock.boundingBox())?.height).toBeCloseTo(40, 1);
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

    await expectWorkspaceNavigationItem(page, /Governance Overview/);
    await expect(page.getByRole('button', { name: 'Open ShopNiro AI Assistant' })).toHaveCount(1);
    await openWorkspaceNavigationItem(page, /Category Registry/);

    const edit = page.getByRole('button', { name: 'Edit category E2E Category' });
    const remove = page.getByRole('button', { name: 'Delete category E2E Category' });
    await expect(edit).toBeVisible();
    await expect(remove).toBeVisible();
    await expect(edit).toHaveAttribute('title', 'Edit category E2E Category');
    await expect(remove).toHaveAttribute('title', 'Delete category E2E Category');

    const editBounds = await edit.boundingBox();
    const removeBounds = await remove.boundingBox();
    expect(editBounds?.width).toBeCloseTo(40, 1);
    expect(editBounds?.height).toBeCloseTo(40, 1);
    expect(removeBounds?.width).toBeCloseTo(40, 1);
    expect(removeBounds?.height).toBeCloseTo(40, 1);

    await remove.click({ trial: true });
    await edit.click();
    const save = page.getByRole('button', { name: 'Save' });
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(save).toBeVisible();
    await expect(cancel).toBeVisible();
    expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(39.9);
    expect((await cancel.boundingBox())?.height).toBeGreaterThanOrEqual(39.9);
    await cancel.click();
    await expect(edit).toBeVisible();
  });
});
