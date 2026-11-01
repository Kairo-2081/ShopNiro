import { expect, test } from '@playwright/test';
import { blockNonLocalTraffic, withDb } from './helpers.ts';

// A visitor has no stored session, so this file starts signed out.
test.use({ storageState: { cookies: [], origins: [] } });

const NEW_USER = { email: 'e2e-new-customer@example.test', password: 'E2e-password-1!' };

async function removeNewUser() {
  await withDb(async (c) => {
    const ids = (await c.query('SELECT id FROM users WHERE username = $1 OR email = $1', [NEW_USER.email])).rows.map((r) => r.id);
    if (!ids.length) return;
    await c.query('DELETE FROM customers WHERE id = ANY($1)', [ids]);
    await c.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  });
}

test.beforeEach(async ({ page }) => {
  await blockNonLocalTraffic(page);
  await removeNewUser();
});

test.afterEach(async () => {
  await removeNewUser();
});

test('a visitor registers, is signed in, and is asked to finish their profile before ordering', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await page.getByRole('button', { name: /Create Account/ }).first().click();
  await page.getByPlaceholder('Choose a username or enter your email').fill(NEW_USER.email);
  await page.getByPlaceholder('At least 8 characters').fill(NEW_USER.password);

  // The terms checkbox is required: submitting without it must not create an account.
  await page.getByRole('button', { name: 'Register & Sign In' }).click();
  await expect(page.getByText(/accept the Terms of Service/)).toBeVisible();

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Register & Sign In' }).click();
  await expect(page.getByText(/Complete your profile before making account changes or placing orders/)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
