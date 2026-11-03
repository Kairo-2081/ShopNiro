-- Manual rollback: DROP TABLE public.payment_reconciliation_findings; DROP TABLE public.payment_reconciliation_runs.
CREATE TABLE public.payment_reconciliation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT current_timestamp,
    finished_at timestamptz,
    window_from timestamptz NOT NULL,
    window_to timestamptz NOT NULL,
    checked integer NOT NULL DEFAULT 0 CHECK (checked >= 0),
    matched integer NOT NULL DEFAULT 0 CHECK (matched >= 0),
    repaired integer NOT NULL DEFAULT 0 CHECK (repaired >= 0),
    findings_opened integer NOT NULL DEFAULT 0 CHECK (findings_opened >= 0),
    status text NOT NULL DEFAULT 'failed' CHECK (status IN ('ok', 'partial', 'failed')),
    error text
);

CREATE TABLE public.payment_reconciliation_findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.payment_reconciliation_runs(id) ON DELETE RESTRICT,
    payment_id varchar(64) REFERENCES public.payments(id) ON DELETE SET NULL,
    order_id varchar(64) REFERENCES public.orders(id) ON DELETE SET NULL,
    refund_id varchar(64) REFERENCES public.refunds(id) ON DELETE SET NULL,
    kind varchar(100) NOT NULL,
    severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
    acknowledged_by varchar(64) REFERENCES public.users(id) ON DELETE SET NULL,
    acknowledged_at timestamptz,
    first_seen_at timestamptz NOT NULL DEFAULT current_timestamp,
    last_seen_at timestamptz NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX payment_reconciliation_findings_open_identity
    ON public.payment_reconciliation_findings (
        kind,
        (coalesce(payment_id, '')),
        (coalesce(order_id, '')),
        (coalesce(refund_id, ''))
    )
    WHERE status = 'open';

CREATE INDEX payment_reconciliation_findings_open_created
    ON public.payment_reconciliation_findings (first_seen_at, id)
    WHERE status = 'open';

CREATE INDEX payment_reconciliation_runs_started
    ON public.payment_reconciliation_runs (started_at DESC);
