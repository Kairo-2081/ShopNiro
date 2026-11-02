-- Manual rollback: DROP TABLE public.checkout_idempotency.
CREATE TABLE public.checkout_idempotency (
  customer_id varchar(64) NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  idempotency_key varchar(128) NOT NULL,
  request_hash varchar(64) NOT NULL,
  order_id varchar(64) REFERENCES public.orders(id) ON DELETE CASCADE,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY (customer_id, idempotency_key),
  CONSTRAINT checkout_idempotency_key_length CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  CONSTRAINT checkout_idempotency_request_hash_length CHECK (length(request_hash) = 64),
  CONSTRAINT checkout_idempotency_result_complete CHECK (
    (order_id IS NULL AND response_json IS NULL) OR
    (order_id IS NOT NULL AND response_json IS NOT NULL)
  )
);
