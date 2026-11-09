import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export const CURRENT_POLICY_VERSION = '2026-11-09';

export type ConsentSource = 'signup' | 'oauth_signup' | 'checkout';

export async function recordCustomerPolicyConsent(
  client: PoolClient,
  customerId: string,
  source: ConsentSource,
  policyIds: Array<'terms' | 'privacy'> = ['terms', 'privacy'],
): Promise<void> {
  for (const policyId of policyIds) {
    await client.query(
      `INSERT INTO customer_policy_consents
        (id, customer_id, policy_id, policy_version, consent_source)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), customerId, policyId, CURRENT_POLICY_VERSION, source],
    );
  }
}
