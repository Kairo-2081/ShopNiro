import { request } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { E2E, seedDatabase } from './seed.ts';

export const AUTH = {
  customer: 'e2e/.auth/customer.json',
  seller: 'e2e/.auth/seller.json',
  admin: 'e2e/.auth/admin.json',
  rider: 'e2e/.auth/rider.json',
} as const;

export default async function globalSetup() {
  await resetWorld();
}

// Seed the database and sign every role in again. Reseeding empties the session table, so a spec that reseeds
// has to call this (not seedDatabase alone) or every saved login stops working.
export async function resetWorld() {
  await seedDatabase(process.env.DATABASE_URL ?? '');
  // Sign each role in once here and let the tests reuse the sessions. The server limits sign-ins per address
  // (the test server raises the limit through LOGIN_RATE_LIMIT_MAX), so tests never sign in through the form
  // except the ones that are about signing in.
  const baseURL = `http://127.0.0.1:${Number(process.env.E2E_PORT) || 3100}`;
  mkdirSync('e2e/.auth', { recursive: true });
  const logins: Array<[keyof typeof AUTH, string, string, string]> = [
    ['customer', E2E.customer.username, E2E.customer.password, 'customer'],
    ['seller', E2E.newSeller.username, E2E.newSeller.password, 'seller'],
    ['admin', E2E.admin.username, E2E.admin.password, 'admin'],
    ['rider', E2E.rider.username, E2E.rider.password, 'rider'],
  ];
  for (const [name, username, password, role] of logins) {
    const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    const response = await api.post('/api/auth/login', { data: { email: username, password, role } });
    if (!response.ok()) throw new Error(`e2e ${name} login failed: ${response.status()} ${await response.text()}`);
    await api.storageState({ path: AUTH[name] });
    await api.dispose();
  }
}
