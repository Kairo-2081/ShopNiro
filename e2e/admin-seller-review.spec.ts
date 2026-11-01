import { expect, test } from '@playwright/test';
import { AUTH } from './global-setup.ts';
import { E2E } from './seed.ts';
import { blockNonLocalTraffic, withDb } from './helpers.ts';

// Approving a seller needs the verification checklist. The Approve button in the table used to skip it, so the server
// rejected the request and the admin saw an error. It now opens the review panel, and only the panel approves.
test.use({ storageState: AUTH.admin });

test('the Approve button in the sellers table opens the review panel instead of approving', async ({ page }) => {
  await blockNonLocalTraffic(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Review & approve' }).first().click();

  const approve = page.getByRole('button', { name: 'Approve seller' });
  await expect(approve, 'the review panel opened').toBeVisible();
  await expect(approve, 'approval waits for the checklist').toBeDisabled();
  await expect(page.getByText(/Could not|failed|required/i)).toHaveCount(0);

  const status = await withDb(async (c) => (await c.query('SELECT status FROM sellers WHERE id = $1', [E2E.newSeller.id])).rows[0].status);
  expect(status).toBe('pending');

  for (const label of ['Identity verified', 'Documents reviewed', 'Payout account verified']) await page.getByLabel(label).check();
  await expect(approve).toBeEnabled();
});
