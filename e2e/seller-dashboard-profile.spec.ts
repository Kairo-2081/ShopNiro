import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, withDb } from './helpers.ts';

type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

async function withSellerStatus<T>(status: SellerStatus, run: () => Promise<T>): Promise<T> {
  const previousStatus = await withDb(async (client) => {
    const result = await client.query<{ status: string }>(
      'SELECT status FROM sellers WHERE id = $1',
      [E2E.newSeller.id]
    );
    if (!result.rows[0]) throw new Error(`E2E seller ${E2E.newSeller.id} is missing`);
    return result.rows[0].status;
  });

  try {
    await withDb((client) => client.query(
      'UPDATE sellers SET status = $1 WHERE id = $2',
      [status, E2E.newSeller.id]
    ));
    return await run();
  } finally {
    await withDb((client) => client.query(
      'UPDATE sellers SET status = $1 WHERE id = $2',
      [previousStatus, E2E.newSeller.id]
    ));
  }
}

async function openSellerDashboard(page: Parameters<typeof blockNonLocalTraffic>[0]) {
  await blockNonLocalTraffic(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: E2E.newSeller.name, exact: true })).toBeVisible();
}

test.describe('seller dashboard profile', () => {
  test.use({ storageState: AUTH.seller });

  test('shows a single approval chip and no status banner for approved sellers', async ({ page }) => {
    await withSellerStatus('approved', async () => {
      await openSellerDashboard(page);
      await expect(page.getByText('Approved', { exact: true })).toHaveCount(1);
      await expect(page.getByText(/Awaiting verification:|Account (rejected|suspended):/)).toHaveCount(0);
    });
  });
});
