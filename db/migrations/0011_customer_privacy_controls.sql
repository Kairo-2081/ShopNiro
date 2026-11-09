ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_deleted_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS customer_policy_consents (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  policy_id VARCHAR(24) NOT NULL CHECK (policy_id IN ('terms', 'privacy')),
  policy_version VARCHAR(32) NOT NULL,
  consent_source VARCHAR(24) NOT NULL CHECK (consent_source IN ('signup', 'oauth_signup', 'checkout')),
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_policy_consents_customer
  ON customer_policy_consents(customer_id, consented_at DESC);

ALTER TABLE customer_policy_consents ENABLE ROW LEVEL SECURITY;
