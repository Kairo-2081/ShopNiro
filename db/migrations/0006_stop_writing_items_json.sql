-- Stop reading and writing the duplicated order-item JSON. order_items is the source of truth.
-- The column stays (nullable, defaulting to '[]') until 0007 drops it, so code that still writes it keeps working.
ALTER TABLE public.orders
    ALTER COLUMN items_json DROP NOT NULL,
    ALTER COLUMN items_json SET DEFAULT '[]';

-- The whole procedure is restated (rather than patched with string splicing) so a reviewer can read exactly
-- what runs. It is the 0001 definition minus the items_json variable and the two items_json writes. Same
-- signature, and SET search_path is part of the definition because CREATE OR REPLACE would otherwise clear it.
CREATE OR REPLACE PROCEDURE process_checkout(
    p_order_id VARCHAR,
    p_tracking_id VARCHAR,
    p_customer_id VARCHAR,
    p_shipping_fee NUMERIC,
    p_shipping_address TEXT,
    p_billing_address TEXT,
    p_additional_info TEXT
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cart_count INTEGER;
    v_subtotal NUMERIC(10, 2);
    v_product_name TEXT;
    v_requested_quantity INTEGER;
    v_available_stock INTEGER;
BEGIN
    IF p_customer_id IS NULL OR p_shipping_fee IS NULL OR p_shipping_fee < 0 THEN
        RAISE EXCEPTION 'Checkout Failed: Customer and a non-negative shipping fee are required.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_customer_id, 0));

    SELECT COUNT(*) INTO v_cart_count
    FROM cart
    WHERE customer_id = p_customer_id;

    IF v_cart_count = 0 THEN
        RAISE EXCEPTION 'Checkout Failed: The shopping cart is empty.';
    END IF;

    PERFORM c.id
    FROM cart c
    WHERE c.customer_id = p_customer_id
    ORDER BY c.id
    FOR UPDATE;

    PERFORM p.id
    FROM products p
    JOIN cart c ON c.product_id = p.id
    WHERE c.customer_id = p_customer_id
    ORDER BY p.id
    FOR UPDATE OF p;

    SELECT p.name INTO v_product_name
    FROM cart c
    JOIN products p ON p.id = c.product_id
    JOIN sellers s ON s.id = p.seller_id
    WHERE c.customer_id = p_customer_id
      AND (p.product_status <> 'active' OR s.status IN ('suspended', 'rejected'))
    ORDER BY c.id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Checkout Failed: Product % is no longer available.', v_product_name;
    END IF;

    SELECT p.name, c.quantity, p.stock
    INTO v_product_name, v_requested_quantity, v_available_stock
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id
      AND c.quantity > p.stock
    ORDER BY c.id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'Checkout Failed: Insufficient stock for %. Requested %, available %.',
            v_product_name, v_requested_quantity, v_available_stock;
    END IF;

    SELECT COALESCE(SUM(c.quantity * p.price), 0.00)
    INTO v_subtotal
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id;

    INSERT INTO orders (
        id, tracking_id, customer_id, subtotal, shipping_fee, status,
        shipping_address_json, billing_address_json, additional_info, order_placed_at
    ) VALUES (
        p_order_id, p_tracking_id, p_customer_id, v_subtotal, p_shipping_fee,
        'placed', p_shipping_address, p_billing_address, COALESCE(p_additional_info, ''), CURRENT_TIMESTAMP
    );

    INSERT INTO order_items (order_id, product_id, seller_id, product_id_snapshot, seller_id_snapshot, product_name, unit_price, quantity, image, size)
    SELECT p_order_id, p.id, p.seller_id, p.id, p.seller_id, p.name, p.price, c.quantity, p.image, c.size
    FROM cart c
    JOIN products p ON p.id = c.product_id
    WHERE c.customer_id = p_customer_id;

    INSERT INTO seller_fulfillments (id, order_id, seller_id, subtotal)
    SELECT
        'FUL-' || substr(md5(p_order_id || ':' || oi.seller_id_snapshot), 1, 20),
        p_order_id,
        oi.seller_id_snapshot,
        SUM(oi.unit_price * oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = p_order_id
    GROUP BY oi.seller_id_snapshot;

    UPDATE products p
    SET stock = p.stock - c.quantity
    FROM cart c
    WHERE c.customer_id = p_customer_id
      AND p.id = c.product_id;

    DELETE FROM cart WHERE customer_id = p_customer_id;
END;
$$;

DO $migration$
DECLARE
    function_oid oid;
    function_name text;
    function_definition text;
BEGIN
    FOREACH function_name IN ARRAY ARRAY['shopniro_orders_list()', 'shopniro_order_get(character varying)']
    LOOP
        function_oid := to_regprocedure('public.' || function_name);
        IF function_oid IS NULL THEN
            RAISE EXCEPTION 'Expected public.%', function_name;
        END IF;
        function_definition := pg_get_functiondef(function_oid);
        IF lower(function_definition) NOT LIKE '%o.items_json%' THEN
            RAISE EXCEPTION 'Expected public.% to contain the legacy order-items fallback before migration', function_name;
        END IF;
        function_definition := regexp_replace(function_definition, 'o\.items_json[[:space:]]*,[[:space:]]*', '', 'i');
        IF lower(function_definition) LIKE '%o.items_json%' THEN
            RAISE EXCEPTION 'Could not remove the legacy fallback from public.%', function_name;
        END IF;
        EXECUTE function_definition;
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.prokind IN ('f', 'p')
          AND pg_get_functiondef(p.oid) ~* '\.items_json'
    ) THEN
        RAISE EXCEPTION 'A public function or procedure still references an items_json table column';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_views
        WHERE schemaname = 'public'
          AND pg_views.definition ~* '\.items_json'
    ) THEN
        RAISE EXCEPTION 'A public view still references an items_json table column';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE n.nspname = 'public'
          AND NOT t.tgisinternal
          AND pg_get_functiondef(p.oid) ~* '\.items_json'
    ) THEN
        RAISE EXCEPTION 'A public trigger function still references an items_json table column';
    END IF;
END
$migration$;
