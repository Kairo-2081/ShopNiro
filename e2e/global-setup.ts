import { request } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { E2E, seedDatabase } from './seed.ts';

export const AUTH_STATE = 'e2e/.auth/customer.json';

export default async function globalSetup() {
  await seedDatabase(process.env.DATABASE_URL ?? '');
  // The server limits logins to 5 per 15 minutes, so sign in once here and let every test reuse the session.
  const baseURL = `http://127.0.0.1:${Number(process.env.E2E_PORT) || 3100}`;
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const response = await api.post('/api/auth/login', {
    data: { email: E2E.customer.username, password: E2E.customer.password, role: 'customer' },
  });
  if (!response.ok()) throw new Error(`e2e login failed: ${response.status()} ${await response.text()}. A 429 means the running server's login limit is used up; restart it.`);
  mkdirSync('e2e/.auth', { recursive: true });
  await api.storageState({ path: AUTH_STATE });
  await api.dispose();
}
