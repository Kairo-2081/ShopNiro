-- Rewrites a database built from 0001 into the shape production actually has, as found by a read-only
-- catalog comparison (see docs/database-design.md): looser column types, missing NOT NULLs, seven missing
-- foreign keys, a missing unique constraint, CHECK constraints written against text columns, two
-- unvalidated payment constraints, four extra legacy columns and a few historical rows that predate the
-- current rules. tests/production-reconcile.test.ts applies it, then runs the real migrations.

-- Fifteen functions return the views' row types, so they have to be dropped and recreated with the views.
CREATE TEMP TABLE legacy_functions AS
SELECT DISTINCT p.oid AS func_oid, format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) AS identity,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.refclassid = 'pg_type'::regclass
JOIN pg_type t ON t.oid = d.refobjid
JOIN pg_class c ON c.oid = t.typrelid AND c.relkind = 'v'
WHERE p.pronamespace = 'public'::regnamespace;

CREATE TEMP TABLE legacy_triggers AS
SELECT t.oid AS trigger_oid, t.tgname AS name, t.tgrelid::regclass::text AS table_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid AND c.relnamespace = 'public'::regnamespace
WHERE NOT t.tgisinternal AND cardinality(t.tgattr::int2[]) > 0;

CREATE TEMP TABLE legacy_views AS
SELECT c.oid AS view_oid, c.relname AS name,
       regexp_replace(pg_get_viewdef(c.oid, true), ';\s*$', '') AS definition
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'v';

DO $legacy$
DECLARE view_rec record;
BEGIN
    FOR view_rec IN SELECT name, table_name FROM legacy_triggers LOOP
        EXECUTE format('DROP TRIGGER %I ON %s', view_rec.name, view_rec.table_name);
    END LOOP;
    FOR view_rec IN SELECT identity FROM legacy_functions ORDER BY func_oid DESC LOOP
        EXECUTE format('DROP FUNCTION %s', view_rec.identity);
    END LOOP;
    FOR view_rec IN SELECT name FROM legacy_views ORDER BY view_oid DESC LOOP
        EXECUTE format('DROP VIEW public.%I', view_rec.name);
    END LOOP;
END
$legacy$;

ALTER TABLE cart DROP CONSTRAINT cart_customer_id_fkey, DROP CONSTRAINT cart_product_id_fkey;
ALTER TABLE orders DROP CONSTRAINT orders_customer_id_fkey, DROP CONSTRAINT chk_orders_status;
ALTER TABLE products DROP CONSTRAINT products_category_id_fkey, DROP CONSTRAINT products_seller_id_fkey, DROP CONSTRAINT chk_products_status;
ALTER TABLE reviews DROP CONSTRAINT reviews_customer_id_fkey, DROP CONSTRAINT reviews_product_id_fkey,
    DROP CONSTRAINT reviews_rating_check, DROP CONSTRAINT chk_reviews_rating;
ALTER TABLE sellers DROP CONSTRAINT chk_sellers_status;
ALTER TABLE users DROP CONSTRAINT users_username_key, DROP CONSTRAINT chk_users_role;
ALTER TABLE payments DROP CONSTRAINT fk_payments_customer, DROP CONSTRAINT chk_payments_order_required;

ALTER TABLE admins ALTER COLUMN address_city DROP DEFAULT, ALTER COLUMN address_house_name DROP DEFAULT, ALTER COLUMN address_postal_code DROP DEFAULT, ALTER COLUMN address_street DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN name DROP DEFAULT, ALTER COLUMN number DROP DEFAULT;
ALTER TABLE admins ALTER COLUMN address_city TYPE text USING address_city::text, ALTER COLUMN address_house_name TYPE text USING address_house_name::text, ALTER COLUMN address_postal_code TYPE text USING address_postal_code::text, ALTER COLUMN address_street TYPE text USING address_street::text, ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN name TYPE text USING name::text, ALTER COLUMN number TYPE text USING number::text;
ALTER TABLE admins ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN name DROP NOT NULL;
ALTER TABLE cart ALTER COLUMN customer_id DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN product_id DROP DEFAULT, ALTER COLUMN quantity DROP DEFAULT;
ALTER TABLE cart ALTER COLUMN customer_id TYPE text USING customer_id::text, ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN product_id TYPE text USING product_id::text;
ALTER TABLE cart ALTER COLUMN customer_id DROP NOT NULL, ALTER COLUMN product_id DROP NOT NULL, ALTER COLUMN quantity DROP NOT NULL, ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE categories ALTER COLUMN id DROP DEFAULT, ALTER COLUMN name DROP DEFAULT;
ALTER TABLE categories ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN name TYPE text USING name::text;
ALTER TABLE customers ALTER COLUMN address_city DROP DEFAULT, ALTER COLUMN address_house_name DROP DEFAULT, ALTER COLUMN address_postal_code DROP DEFAULT, ALTER COLUMN address_street DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN name DROP DEFAULT, ALTER COLUMN number DROP DEFAULT;
ALTER TABLE customers ALTER COLUMN address_city TYPE text USING address_city::text, ALTER COLUMN address_house_name TYPE text USING address_house_name::text, ALTER COLUMN address_postal_code TYPE text USING address_postal_code::text, ALTER COLUMN address_street TYPE text USING address_street::text, ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN name TYPE text USING name::text, ALTER COLUMN number TYPE text USING number::text;
ALTER TABLE customers ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN name DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN customer_id DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN items_json DROP DEFAULT, ALTER COLUMN order_placed_at DROP DEFAULT, ALTER COLUMN payment_method DROP DEFAULT, ALTER COLUMN payment_status DROP DEFAULT, ALTER COLUMN shipping_fee DROP DEFAULT, ALTER COLUMN status DROP DEFAULT, ALTER COLUMN subtotal DROP DEFAULT, ALTER COLUMN tracking_id DROP DEFAULT, ALTER COLUMN transaction_id DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN customer_id TYPE text USING customer_id::text, ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN order_placed_at TYPE timestamp without time zone USING order_placed_at AT TIME ZONE 'UTC', ALTER COLUMN payment_method TYPE character varying(64) USING payment_method::character varying(64), ALTER COLUMN shipping_fee TYPE numeric USING shipping_fee::numeric, ALTER COLUMN status TYPE text USING status::text, ALTER COLUMN subtotal TYPE numeric USING subtotal::numeric, ALTER COLUMN tracking_id TYPE text USING tracking_id::text, ALTER COLUMN transaction_id TYPE character varying(128) USING transaction_id::character varying(128);
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL, ALTER COLUMN items_json DROP NOT NULL, ALTER COLUMN order_placed_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN payment_method DROP NOT NULL, ALTER COLUMN payment_method SET DEFAULT 'cash_on_delivery'::character varying, ALTER COLUMN payment_status DROP NOT NULL, ALTER COLUMN payment_status SET DEFAULT 'pending'::character varying, ALTER COLUMN shipping_fee DROP NOT NULL, ALTER COLUMN status DROP NOT NULL, ALTER COLUMN subtotal DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN amount DROP DEFAULT, ALTER COLUMN bank_tran_id DROP DEFAULT, ALTER COLUMN card_brand DROP DEFAULT, ALTER COLUMN card_issuer DROP DEFAULT, ALTER COLUMN card_type DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN currency DROP DEFAULT, ALTER COLUMN customer_phone DROP DEFAULT, ALTER COLUMN gateway DROP DEFAULT, ALTER COLUMN payment_method DROP DEFAULT, ALTER COLUMN status DROP DEFAULT, ALTER COLUMN transaction_id DROP DEFAULT, ALTER COLUMN val_id DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN amount TYPE numeric USING amount::numeric, ALTER COLUMN bank_tran_id TYPE character varying(128) USING bank_tran_id::character varying(128), ALTER COLUMN card_brand TYPE character varying(64) USING card_brand::character varying(64), ALTER COLUMN card_issuer TYPE character varying(128) USING card_issuer::character varying(128), ALTER COLUMN card_type TYPE character varying(64) USING card_type::character varying(64), ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN customer_phone TYPE character varying(32) USING customer_phone::character varying(32), ALTER COLUMN gateway TYPE character varying(64) USING gateway::character varying(64), ALTER COLUMN payment_method TYPE character varying(64) USING payment_method::character varying(64), ALTER COLUMN transaction_id TYPE character varying(128) USING transaction_id::character varying(128), ALTER COLUMN val_id TYPE character varying(128) USING val_id::character varying(128);
ALTER TABLE payments ALTER COLUMN created_at DROP NOT NULL, ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN currency DROP NOT NULL, ALTER COLUMN currency SET DEFAULT 'BDT'::character varying, ALTER COLUMN gateway DROP NOT NULL, ALTER COLUMN gateway SET DEFAULT 'sslcommerz'::character varying, ALTER COLUMN status DROP NOT NULL, ALTER COLUMN status SET DEFAULT 'PENDING'::character varying;
ALTER TABLE products ALTER COLUMN category_id DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN name DROP DEFAULT, ALTER COLUMN price DROP DEFAULT, ALTER COLUMN product_status DROP DEFAULT, ALTER COLUMN seller_id DROP DEFAULT, ALTER COLUMN stock DROP DEFAULT, ALTER COLUMN voucher DROP DEFAULT;
ALTER TABLE products ALTER COLUMN category_id TYPE text USING category_id::text, ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN name TYPE text USING name::text, ALTER COLUMN price TYPE numeric USING price::numeric, ALTER COLUMN product_status TYPE text USING product_status::text, ALTER COLUMN seller_id TYPE text USING seller_id::text, ALTER COLUMN voucher TYPE text USING voucher::text;
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL, ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN product_status DROP NOT NULL, ALTER COLUMN product_status SET DEFAULT 'active'::text, ALTER COLUMN seller_id DROP NOT NULL, ALTER COLUMN stock DROP NOT NULL, ALTER COLUMN stock SET DEFAULT 0;
ALTER TABLE reviews ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN customer_id DROP DEFAULT, ALTER COLUMN customer_name DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN product_id DROP DEFAULT, ALTER COLUMN rating DROP DEFAULT, ALTER COLUMN review_text DROP DEFAULT;
ALTER TABLE reviews ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN customer_id TYPE text USING customer_id::text, ALTER COLUMN customer_name TYPE text USING customer_name::text, ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN product_id TYPE text USING product_id::text, ALTER COLUMN rating TYPE numeric USING rating::numeric;
ALTER TABLE reviews ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN customer_id DROP NOT NULL, ALTER COLUMN customer_name DROP NOT NULL, ALTER COLUMN product_id DROP NOT NULL, ALTER COLUMN rating DROP NOT NULL, ALTER COLUMN review_text DROP NOT NULL;
ALTER TABLE sellers ALTER COLUMN address_city DROP DEFAULT, ALTER COLUMN address_house_name DROP DEFAULT, ALTER COLUMN address_postal_code DROP DEFAULT, ALTER COLUMN address_street DROP DEFAULT, ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN name DROP DEFAULT, ALTER COLUMN number DROP DEFAULT, ALTER COLUMN status DROP DEFAULT;
ALTER TABLE sellers ALTER COLUMN address_city TYPE text USING address_city::text, ALTER COLUMN address_house_name TYPE text USING address_house_name::text, ALTER COLUMN address_postal_code TYPE text USING address_postal_code::text, ALTER COLUMN address_street TYPE text USING address_street::text, ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN name TYPE text USING name::text, ALTER COLUMN number TYPE text USING number::text, ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE sellers ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN name DROP NOT NULL, ALTER COLUMN status DROP NOT NULL, ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT, ALTER COLUMN email DROP DEFAULT, ALTER COLUMN id DROP DEFAULT, ALTER COLUMN password DROP DEFAULT, ALTER COLUMN role DROP DEFAULT, ALTER COLUMN username DROP DEFAULT;
ALTER TABLE users ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC', ALTER COLUMN email TYPE text USING email::text, ALTER COLUMN id TYPE text USING id::text, ALTER COLUMN password TYPE text USING password::text, ALTER COLUMN role TYPE text USING role::text, ALTER COLUMN username TYPE text USING username::text;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN email DROP NOT NULL, ALTER COLUMN password DROP NOT NULL, ALTER COLUMN role DROP NOT NULL, ALTER COLUMN username DROP NOT NULL;

ALTER TABLE orders ADD COLUMN currency VARCHAR(10) DEFAULT 'BDT', ADD COLUMN payment_id VARCHAR(128);
ALTER TABLE payments ADD COLUMN raw_response_json TEXT, ADD COLUMN validated_at TIMESTAMP;

ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (status IN ('placed', 'processing', 'shipped', 'delivered', 'cancelled'));
ALTER TABLE products ADD CONSTRAINT chk_products_status CHECK (product_status IN ('active', 'inactive', 'deactivated'));
ALTER TABLE sellers ADD CONSTRAINT chk_sellers_status CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('customer', 'seller', 'admin', 'rider'));
ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5);
-- Historical rows that predate the current rules. Shaped like the ones found in production: orders with
-- no payment method or status, an order subtotal with floating point noise, and a validated payment that
-- has no order and points at a customer that does not exist.
INSERT INTO users (id, username, password, email, role) VALUES ('CUST-LEGACY', 'legacy-customer', 'x', 'legacy@example.test', 'customer');
INSERT INTO customers (id, name) VALUES ('CUST-LEGACY', 'Legacy Customer');

INSERT INTO orders (id, tracking_id, customer_id, items_json, subtotal, shipping_fee, status, payment_method, payment_status,
                    shipping_address_json, billing_address_json)
VALUES
    ('ORD-LEGACY-1', 'TRK-LEGACY-1', 'CUST-LEGACY', '[]', 598, 0, 'delivered', NULL, NULL, '{}', '{}'),
    ('ORD-LEGACY-2', 'TRK-LEGACY-2', 'CUST-LEGACY', '[]', 68, 5, 'placed', NULL, NULL, '{}', '{}'),
    ('ORD-LEGACY-3', 'TRK-LEGACY-3', 'CUST-LEGACY', '[]', 183.58999999999997, 5, 'cancelled', 'bkash', 'refunded', '{}', '{}');
INSERT INTO payments (id, order_id, customer_id, amount, status, payment_method, transaction_id)
VALUES ('PAY-LEGACY-1', NULL, 'CUST-MISSING', 3000, 'VALIDATED', 'bkash', 'SSLCZ-LEGACY-1');

ALTER TABLE payments ADD CONSTRAINT chk_payments_order_required CHECK (order_id IS NOT NULL) NOT VALID;
ALTER TABLE payments ADD CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT NOT VALID;

DO $legacy$
DECLARE view_rec record;
BEGIN
    FOR view_rec IN SELECT name, definition FROM legacy_views ORDER BY view_oid LOOP
        EXECUTE format('CREATE VIEW public.%I AS %s', view_rec.name, view_rec.definition);
    END LOOP;
    FOR view_rec IN SELECT definition FROM legacy_functions ORDER BY func_oid LOOP
        EXECUTE view_rec.definition;
    END LOOP;
    FOR view_rec IN SELECT definition FROM legacy_triggers ORDER BY trigger_oid LOOP
        EXECUTE view_rec.definition;
    END LOOP;
END
$legacy$;
DROP TABLE legacy_triggers;
DROP TABLE legacy_views;
DROP TABLE legacy_functions;
