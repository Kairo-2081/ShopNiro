-- Production's column defaults were written before 0001 existed and differ from it in seven places.
-- 0004 deliberately kept them while it changed types; this aligns them so a database built from the
-- migration files and production end up identical. Setting a default is metadata only and does not
-- touch existing rows.
--
-- One default is intentionally NOT taken from 0001: sellers.status. 0001 says 'approved', which would
-- let a seller row inserted without a status skip admin review. Production already uses 'pending',
-- and every code path sets the status explicitly, so 'pending' is made the default everywhere.
--
-- Rollback: set the defaults back to the values listed in the comments (all are safe to change again).

ALTER TABLE public.orders
    ALTER COLUMN payment_method SET DEFAULT 'unknown'::character varying,   -- production had 'cash_on_delivery'
    ALTER COLUMN shipping_fee SET DEFAULT 0.00,                              -- production had none
    ALTER COLUMN status SET DEFAULT 'placed'::character varying;             -- production had none

ALTER TABLE public.products
    ALTER COLUMN product_status SET DEFAULT 'active'::character varying,
    ALTER COLUMN voucher SET DEFAULT ''::character varying;                  -- production had none

ALTER TABLE public.users
    ALTER COLUMN role SET DEFAULT 'customer'::character varying;             -- production had none

ALTER TABLE public.sellers
    ALTER COLUMN status SET DEFAULT 'pending'::character varying;            -- 0001 says 'approved'; see above
