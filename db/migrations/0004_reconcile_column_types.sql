-- Rollback: restore from the pre-migration backup. Reverse timestamp conversions using UTC and
-- restore the original column types only after checking that no dependent objects have changed.
DO $$
DECLARE
    item RECORD;
    saved_view RECORD;
    view_acl RECORD;
    saved_routine RECORD;
    routine_acl RECORD;
    saved_default RECORD;
    changed_type BOOLEAN := FALSE;
    pending_count INTEGER;
    restored_count INTEGER;
    constraint_definition TEXT;
    object_name TEXT;
    option_list TEXT;
    view_definition TEXT;
    acl_role TEXT;
    grant_sql TEXT;
BEGIN
    CREATE TEMP TABLE _shopniro_type_targets (
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        target_type TEXT NOT NULL,
        using_expression TEXT NOT NULL,
        max_length INTEGER,
        must_be_not_null BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (table_name, column_name)
    ) ON COMMIT DROP;

    INSERT INTO _shopniro_type_targets
        (table_name, column_name, target_type, using_expression, max_length, must_be_not_null)
    VALUES
        ('admins', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('admins', 'name', 'character varying(255)', 'name::character varying(255)', 255, TRUE),
        ('admins', 'number', 'character varying(50)', 'number::character varying(50)', 50, FALSE),
        ('admins', 'address_house_name', 'character varying(255)', 'address_house_name::character varying(255)', 255, FALSE),
        ('admins', 'address_street', 'character varying(255)', 'address_street::character varying(255)', 255, FALSE),
        ('admins', 'address_city', 'character varying(100)', 'address_city::character varying(100)', 100, FALSE),
        ('admins', 'address_postal_code', 'character varying(50)', 'address_postal_code::character varying(50)', 50, FALSE),
        ('admins', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE),

        ('users', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('users', 'username', 'character varying(100)', 'username::character varying(100)', 100, TRUE),
        ('users', 'password', 'character varying(255)', 'password::character varying(255)', 255, TRUE),
        ('users', 'email', 'character varying(255)', 'email::character varying(255)', 255, TRUE),
        ('users', 'role', 'character varying(32)', 'role::character varying(32)', 32, TRUE),
        ('users', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE),

        ('customers', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('customers', 'name', 'character varying(255)', 'name::character varying(255)', 255, TRUE),
        ('customers', 'number', 'character varying(50)', 'number::character varying(50)', 50, FALSE),
        ('customers', 'address_house_name', 'character varying(255)', 'address_house_name::character varying(255)', 255, FALSE),
        ('customers', 'address_street', 'character varying(255)', 'address_street::character varying(255)', 255, FALSE),
        ('customers', 'address_city', 'character varying(100)', 'address_city::character varying(100)', 100, FALSE),
        ('customers', 'address_postal_code', 'character varying(50)', 'address_postal_code::character varying(50)', 50, FALSE),
        ('customers', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE),

        ('sellers', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('sellers', 'name', 'character varying(255)', 'name::character varying(255)', 255, TRUE),
        ('sellers', 'number', 'character varying(50)', 'number::character varying(50)', 50, FALSE),
        ('sellers', 'address_house_name', 'character varying(255)', 'address_house_name::character varying(255)', 255, FALSE),
        ('sellers', 'address_street', 'character varying(255)', 'address_street::character varying(255)', 255, FALSE),
        ('sellers', 'address_city', 'character varying(100)', 'address_city::character varying(100)', 100, FALSE),
        ('sellers', 'address_postal_code', 'character varying(50)', 'address_postal_code::character varying(50)', 50, FALSE),
        ('sellers', 'status', 'character varying(32)', 'status::character varying(32)', 32, TRUE),
        ('sellers', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE),

        ('categories', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('categories', 'name', 'character varying(255)', 'name::character varying(255)', 255, TRUE),

        ('products', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('products', 'name', 'character varying(255)', 'name::character varying(255)', 255, TRUE),
        ('products', 'price', 'numeric(10,2)', 'price::numeric(10,2)', NULL, TRUE),
        ('products', 'product_status', 'character varying(32)', 'product_status::character varying(32)', 32, TRUE),
        ('products', 'category_id', 'character varying(64)', 'category_id::character varying(64)', 64, TRUE),
        ('products', 'seller_id', 'character varying(64)', 'seller_id::character varying(64)', 64, TRUE),
        ('products', 'stock', 'integer', 'stock::integer', NULL, TRUE),
        ('products', 'voucher', 'character varying(50)', 'voucher::character varying(50)', 50, FALSE),
        ('products', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE),

        ('cart', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('cart', 'customer_id', 'character varying(64)', 'customer_id::character varying(64)', 64, TRUE),
        ('cart', 'product_id', 'character varying(64)', 'product_id::character varying(64)', 64, TRUE),
        ('cart', 'quantity', 'integer', 'quantity::integer', NULL, TRUE),

        ('orders', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('orders', 'tracking_id', 'character varying(100)', 'tracking_id::character varying(100)', 100, TRUE),
        ('orders', 'customer_id', 'character varying(64)', 'customer_id::character varying(64)', 64, TRUE),
        ('orders', 'items_json', 'text', 'items_json::text', NULL, TRUE),
        ('orders', 'subtotal', 'numeric(10,2)', 'subtotal::numeric(10,2)', NULL, TRUE),
        ('orders', 'shipping_fee', 'numeric(10,2)', 'shipping_fee::numeric(10,2)', NULL, TRUE),
        ('orders', 'status', 'character varying(32)', 'status::character varying(32)', 32, TRUE),
        ('orders', 'payment_status', 'character varying(32)', 'payment_status::character varying(32)', 32, TRUE),
        ('orders', 'payment_method', 'character varying(32)', 'payment_method::character varying(32)', 32, TRUE),
        ('orders', 'transaction_id', 'character varying(100)', 'transaction_id::character varying(100)', 100, FALSE),
        ('orders', 'order_placed_at', 'timestamp with time zone', 'order_placed_at AT TIME ZONE ''UTC''', NULL, TRUE),

        ('payments', 'amount', 'numeric(10,2)', 'amount::numeric(10,2)', NULL, TRUE),
        ('payments', 'bank_tran_id', 'character varying(100)', 'bank_tran_id::character varying(100)', 100, FALSE),
        ('payments', 'card_brand', 'character varying(50)', 'card_brand::character varying(50)', 50, FALSE),
        ('payments', 'card_issuer', 'character varying(100)', 'card_issuer::character varying(100)', 100, FALSE),
        ('payments', 'card_type', 'character varying(50)', 'card_type::character varying(50)', 50, FALSE),
        ('payments', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE),
        ('payments', 'currency', 'character varying(10)', 'currency::character varying(10)', 10, TRUE),
        ('payments', 'gateway', 'character varying(32)', 'gateway::character varying(32)', 32, TRUE),
        ('payments', 'customer_phone', 'character varying(50)', 'customer_phone::character varying(50)', 50, FALSE),
        ('payments', 'payment_method', 'character varying(32)', 'payment_method::character varying(32)', 32, TRUE),
        ('payments', 'status', 'character varying(32)', 'status::character varying(32)', 32, TRUE),
        ('payments', 'transaction_id', 'character varying(100)', 'transaction_id::character varying(100)', 100, TRUE),
        ('payments', 'val_id', 'character varying(100)', 'val_id::character varying(100)', 100, FALSE),

        ('reviews', 'id', 'character varying(64)', 'id::character varying(64)', 64, TRUE),
        ('reviews', 'product_id', 'character varying(64)', 'product_id::character varying(64)', 64, TRUE),
        ('reviews', 'customer_id', 'character varying(64)', 'customer_id::character varying(64)', 64, TRUE),
        ('reviews', 'customer_name', 'character varying(255)', 'customer_name::character varying(255)', 255, TRUE),
        ('reviews', 'review_text', 'text', 'review_text::text', NULL, TRUE),
        ('reviews', 'rating', 'integer', 'rating::integer', NULL, TRUE),
        ('reviews', 'created_at', 'timestamp with time zone', 'created_at AT TIME ZONE ''UTC''', NULL, TRUE);

    UPDATE public.orders SET payment_method = 'unknown' WHERE payment_method IS NULL;
    UPDATE public.orders SET payment_status = 'pending' WHERE payment_status IS NULL;

    FOR item IN SELECT * FROM _shopniro_type_targets WHERE max_length IS NOT NULL
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM public.%I WHERE %I IS NOT NULL AND length(%I::text) > $1',
            item.table_name, item.column_name, item.column_name
        ) INTO pending_count USING item.max_length;
        IF pending_count > 0 THEN
            RAISE EXCEPTION 'Cannot narrow %.%: % values exceed % characters',
                item.table_name, item.column_name, pending_count, item.max_length;
        END IF;
    END LOOP;

    FOR item IN
        SELECT * FROM _shopniro_type_targets
        WHERE target_type = 'numeric(10,2)'
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM public.%I WHERE %I IS NOT NULL AND '
            '(%I::numeric <> round(%I::numeric, 2) OR abs(%I::numeric) >= 100000000 '
            'OR %I::text IN (''NaN'', ''Infinity'', ''-Infinity''))',
            item.table_name, item.column_name, item.column_name, item.column_name,
            item.column_name, item.column_name
        ) INTO pending_count;
        IF pending_count > 0 THEN
            RAISE EXCEPTION 'Cannot convert %.% to numeric(10,2): % values need rounding or exceed its range',
                item.table_name, item.column_name, pending_count;
        END IF;
    END LOOP;

    FOR item IN
        SELECT * FROM _shopniro_type_targets WHERE target_type = 'integer'
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM public.%I WHERE %I IS NOT NULL AND '
            '(%I::numeric <> trunc(%I::numeric) OR %I::numeric < -2147483648 '
            'OR %I::numeric > 2147483647 OR %I::text IN (''NaN'', ''Infinity'', ''-Infinity''))',
            item.table_name, item.column_name, item.column_name, item.column_name,
            item.column_name, item.column_name, item.column_name
        ) INTO pending_count;
        IF pending_count > 0 THEN
            RAISE EXCEPTION 'Cannot convert %.% to integer: % fractional or out-of-range values require review',
                item.table_name, item.column_name, pending_count;
        END IF;
    END LOOP;

    FOR item IN
        SELECT * FROM _shopniro_type_targets WHERE must_be_not_null
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM public.%I WHERE %I IS NULL',
            item.table_name, item.column_name
        ) INTO pending_count;
        IF pending_count > 0 THEN
            RAISE EXCEPTION 'Cannot set %.% NOT NULL: % rows still contain NULL; review and backfill them first',
                item.table_name, item.column_name, pending_count;
        END IF;
    END LOOP;

    FOR item IN
        SELECT * FROM _shopniro_type_targets t
        JOIN pg_attribute a ON a.attrelid = format('public.%I', t.table_name)::regclass
            AND a.attname = t.column_name AND NOT a.attisdropped
        WHERE format_type(a.atttypid, a.atttypmod) <> t.target_type
    LOOP
        changed_type := TRUE;
    END LOOP;

    IF changed_type THEN
        CREATE TEMP TABLE _shopniro_saved_defaults ON COMMIT DROP AS
        SELECT t.table_name, t.column_name, pg_get_expr(d.adbin, d.adrelid) AS default_expression
        FROM _shopniro_type_targets t
        JOIN pg_class relation ON relation.oid = format('public.%I', t.table_name)::regclass
        JOIN pg_attribute a ON a.attrelid = relation.oid AND a.attname = t.column_name
        JOIN pg_attrdef d ON d.adrelid = relation.oid AND d.adnum = a.attnum
        WHERE format_type(a.atttypid, a.atttypmod) <> t.target_type;

        CREATE TEMP TABLE _shopniro_saved_view_column_acl ON COMMIT DROP AS
        SELECT c.relname AS view_name, a.attname AS column_name,
               CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee_name,
               acl.privilege_type, acl.is_grantable, pg_get_userbyid(c.relowner) AS owner_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        CROSS JOIN LATERAL aclexplode(a.attacl) AS acl
        WHERE n.nspname = 'public' AND c.relkind = 'v' AND a.attacl IS NOT NULL;

        CREATE TEMP TABLE _shopniro_saved_views ON COMMIT DROP AS
        SELECT c.oid AS old_oid, n.nspname AS schema_name, c.relname AS view_name,
               pg_get_viewdef(c.oid, TRUE) AS view_definition,
               pg_get_userbyid(c.relowner) AS owner_name,
               c.reloptions,
               obj_description(c.oid, 'pg_class') AS comment_text,
               ARRAY(
                   SELECT DISTINCT dependency.relname
                   FROM pg_rewrite rewrite
                   JOIN pg_depend dependency_link
                     ON dependency_link.classid = 'pg_rewrite'::regclass
                    AND dependency_link.objid = rewrite.oid
                    AND dependency_link.refclassid = 'pg_class'::regclass
                   JOIN pg_class dependency ON dependency.oid = dependency_link.refobjid
                   WHERE rewrite.ev_class = c.oid
                     AND dependency.relkind = 'v'
                     AND dependency.relnamespace = c.relnamespace
                     AND dependency.oid <> c.oid
               ) AS dependencies,
               FALSE AS recreated
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'v';

        IF EXISTS (
            SELECT 1
            FROM pg_rewrite rewrite
            JOIN pg_class dependent_view ON dependent_view.oid = rewrite.ev_class
            JOIN pg_namespace dependent_namespace ON dependent_namespace.oid = dependent_view.relnamespace
            JOIN pg_depend dependency
              ON dependency.classid = 'pg_rewrite'::regclass
             AND dependency.objid = rewrite.oid
             AND dependency.refclassid = 'pg_class'::regclass
            JOIN pg_class referenced_relation ON referenced_relation.oid = dependency.refobjid
            JOIN pg_namespace referenced_namespace ON referenced_namespace.oid = referenced_relation.relnamespace
            WHERE dependent_namespace.nspname <> 'public'
              AND (
                  EXISTS (
                      SELECT 1 FROM _shopniro_type_targets target
                      WHERE referenced_namespace.nspname = 'public'
                        AND referenced_relation.relname = target.table_name
                  )
                  OR referenced_relation.oid IN (
                      SELECT old_oid FROM _shopniro_saved_views
                  )
              )
        ) THEN
            RAISE EXCEPTION 'Type reconciliation found dependent views outside public; migrate those views explicitly before retrying.';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_depend dependency
            JOIN pg_proc routine ON routine.oid = dependency.objid
            JOIN pg_namespace routine_namespace ON routine_namespace.oid = routine.pronamespace
            WHERE dependency.classid = 'pg_proc'::regclass
              AND dependency.refclassid = 'pg_type'::regclass
              AND dependency.refobjid IN (
                  SELECT relation.reltype
                  FROM _shopniro_saved_views saved_view
                  JOIN pg_class relation ON relation.oid = saved_view.old_oid
              )
              AND routine_namespace.nspname <> 'public'
        ) THEN
            RAISE EXCEPTION 'Type reconciliation found dependent routines outside public; migrate those routines explicitly before retrying.';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM pg_trigger view_trigger
            JOIN pg_class relation ON relation.oid = view_trigger.tgrelid
            JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
            WHERE relation_namespace.nspname = 'public'
              AND relation.relkind = 'v'
              AND NOT view_trigger.tgisinternal
        ) OR EXISTS (
            SELECT 1
            FROM pg_rewrite rewrite
            JOIN pg_class relation ON relation.oid = rewrite.ev_class
            JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
            WHERE relation_namespace.nspname = 'public'
              AND relation.relkind = 'v'
              AND rewrite.rulename <> '_RETURN'
        ) THEN
            RAISE EXCEPTION 'Type reconciliation cannot safely recreate views with custom triggers or rewrite rules.';
        END IF;

        CREATE TEMP TABLE _shopniro_saved_view_columns ON COMMIT DROP AS
        SELECT c.relname AS view_name, a.attname AS column_name,
               col_description(c.oid, a.attnum) AS comment_text
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE n.nspname = 'public' AND c.relkind = 'v'
          AND col_description(c.oid, a.attnum) IS NOT NULL;

        CREATE TEMP TABLE _shopniro_saved_view_acl ON COMMIT DROP AS
        SELECT c.relname AS view_name,
               CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee_name,
               acl.privilege_type,
               acl.is_grantable,
               pg_get_userbyid(c.relowner) AS owner_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
        WHERE n.nspname = 'public' AND c.relkind = 'v';

        CREATE TEMP TABLE _shopniro_saved_routines ON COMMIT DROP AS
        SELECT p.oid AS old_oid, n.nspname AS schema_name, p.proname AS routine_name,
               p.prokind AS routine_kind,
               format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS signature,
               pg_get_functiondef(p.oid) AS routine_definition,
               pg_get_userbyid(p.proowner) AS owner_name,
               obj_description(p.oid, 'pg_proc') AS comment_text,
               ARRAY(
                   SELECT DISTINCT format(
                       '%I.%I(%s)', dependency_namespace.nspname, dependency.proname,
                       pg_get_function_identity_arguments(dependency.oid)
                   )
                   FROM pg_depend dependency_link
                   JOIN pg_proc dependency ON dependency.oid = dependency_link.refobjid
                   JOIN pg_namespace dependency_namespace ON dependency_namespace.oid = dependency.pronamespace
                   WHERE dependency_link.classid = 'pg_proc'::regclass
                     AND dependency_link.objid = p.oid
                     AND dependency_link.refclassid = 'pg_proc'::regclass
                     AND dependency_namespace.nspname = 'public'
                     AND dependency.oid <> p.oid
               ) AS dependencies
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p');

        CREATE TEMP TABLE _shopniro_saved_routine_acl ON COMMIT DROP AS
        SELECT p.oid AS old_oid,
               CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee_name,
               acl.privilege_type,
               acl.is_grantable,
               pg_get_userbyid(p.proowner) AS owner_name
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
        WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p');

        CREATE TEMP TABLE _shopniro_saved_foreign_keys ON COMMIT DROP AS
        SELECT c.conrelid AS relation_oid, c.conname,
               regexp_replace(pg_get_constraintdef(c.oid, TRUE), '[[:space:]]+NOT VALID$', '', 'i') AS definition,
               c.convalidated
        FROM pg_constraint c
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
          AND (
              EXISTS (
                  SELECT 1
                  FROM unnest(c.conkey) AS key_column(attnum)
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key_column.attnum
                  JOIN pg_class relation ON relation.oid = c.conrelid
                  JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
                  JOIN _shopniro_type_targets t ON t.table_name = relation.relname
                      AND relation_namespace.nspname = 'public'
                      AND t.column_name = a.attname
              )
              OR EXISTS (
                  SELECT 1
                  FROM unnest(c.confkey) AS key_column(attnum)
                  JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = key_column.attnum
                  JOIN pg_class relation ON relation.oid = c.confrelid
                  JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
                  JOIN _shopniro_type_targets t ON t.table_name = relation.relname
                      AND relation_namespace.nspname = 'public'
                      AND t.column_name = a.attname
              )
          );

        CREATE TEMP TABLE _shopniro_saved_checks ON COMMIT DROP AS
        SELECT c.conrelid AS relation_oid, c.conname,
               regexp_replace(pg_get_constraintdef(c.oid, TRUE), '[[:space:]]+NOT VALID$', '', 'i') AS definition,
               c.convalidated
        FROM pg_constraint c
        WHERE c.contype = 'c'
          AND c.connamespace = 'public'::regnamespace
          AND EXISTS (
              SELECT 1
              FROM unnest(c.conkey) AS key_column(attnum)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key_column.attnum
              JOIN pg_class relation ON relation.oid = c.conrelid
              JOIN pg_namespace relation_namespace ON relation_namespace.oid = relation.relnamespace
              JOIN _shopniro_type_targets t ON t.table_name = relation.relname
                  AND relation_namespace.nspname = 'public'
                  AND t.column_name = a.attname
          );

        FOR item IN SELECT schema_name, view_name FROM _shopniro_saved_views
        LOOP
            IF to_regclass(format('%I.%I', item.schema_name, item.view_name)) IS NOT NULL THEN
                EXECUTE format('DROP VIEW %I.%I CASCADE', item.schema_name, item.view_name);
            END IF;
        END LOOP;

        FOR item IN
            SELECT relation_oid::regclass AS relation_name, conname
            FROM _shopniro_saved_foreign_keys
        LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.relation_name, item.conname);
        END LOOP;

        FOR item IN
            SELECT relation_oid::regclass AS relation_name, conname
            FROM _shopniro_saved_checks
        LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', item.relation_name, item.conname);
        END LOOP;

        FOR saved_default IN SELECT * FROM _shopniro_saved_defaults
        LOOP
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT',
                saved_default.table_name, saved_default.column_name
            );
        END LOOP;
    END IF;

    FOR item IN
        SELECT * FROM _shopniro_type_targets t
        JOIN pg_attribute a ON a.attrelid = format('public.%I', t.table_name)::regclass
            AND a.attname = t.column_name AND NOT a.attisdropped
        WHERE format_type(a.atttypid, a.atttypmod) <> t.target_type
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN %I TYPE %s USING %s',
            item.table_name, item.column_name, item.target_type, item.using_expression
        );
    END LOOP;

    IF changed_type THEN
        FOR saved_default IN SELECT * FROM _shopniro_saved_defaults
        LOOP
            EXECUTE format(
                'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',
                saved_default.table_name, saved_default.column_name, saved_default.default_expression
            );
        END LOOP;
    END IF;

    FOR item IN
        SELECT * FROM _shopniro_type_targets WHERE must_be_not_null
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', item.table_name, item.column_name);
    END LOOP;

    IF changed_type THEN
        FOR item IN SELECT * FROM _shopniro_saved_checks
        LOOP
            constraint_definition := item.definition;
            IF item.relation_oid = 'public.orders'::regclass AND item.conname = 'chk_orders_status' THEN
                constraint_definition :=
                    'CHECK (status IN (''placed'', ''processing'', ''shipped'', ''delivered'', ''cancelled''))';
            ELSIF item.relation_oid = 'public.products'::regclass AND item.conname = 'chk_products_status' THEN
                constraint_definition :=
                    'CHECK (product_status IN (''active'', ''inactive'', ''deactivated''))';
            ELSIF item.relation_oid = 'public.sellers'::regclass AND item.conname = 'chk_sellers_status' THEN
                constraint_definition :=
                    'CHECK (status IN (''pending'', ''approved'', ''rejected'', ''suspended''))';
            ELSIF item.relation_oid = 'public.users'::regclass AND item.conname = 'chk_users_role' THEN
                constraint_definition :=
                    'CHECK (role IN (''customer'', ''seller'', ''admin'', ''rider''))';
            ELSIF item.relation_oid = 'public.reviews'::regclass
                AND item.conname IN ('chk_reviews_rating', 'reviews_rating_check') THEN
                constraint_definition := 'CHECK (rating >= 1 AND rating <= 5)';
            END IF;

            EXECUTE format(
                'ALTER TABLE %s ADD CONSTRAINT %I %s NOT VALID',
                item.relation_oid::regclass, item.conname, constraint_definition
            );
            IF item.convalidated THEN
                EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', item.relation_oid::regclass, item.conname);
            END IF;
        END LOOP;

        FOR item IN SELECT * FROM _shopniro_saved_foreign_keys
        LOOP
            EXECUTE format(
                'ALTER TABLE %s ADD CONSTRAINT %I %s NOT VALID',
                item.relation_oid::regclass, item.conname, item.definition
            );
            IF item.convalidated THEN
                EXECUTE format(
                    'ALTER TABLE %s VALIDATE CONSTRAINT %I',
                    item.relation_oid::regclass, item.conname
                );
            END IF;
        END LOOP;

        LOOP
            restored_count := 0;
            FOR saved_view IN
                SELECT * FROM _shopniro_saved_views
                WHERE NOT recreated
                  AND NOT EXISTS (
                      SELECT 1
                      FROM unnest(dependencies) AS dependency(view_name)
                      JOIN _shopniro_saved_views dependency_view
                        ON dependency_view.view_name = dependency.view_name
                       AND NOT dependency_view.recreated
                  )
                ORDER BY view_name
            LOOP
                view_definition := saved_view.view_definition;
                -- Reparse these queries from the baseline to remove casts introduced by the old text column types.
                CASE saved_view.view_name
                    WHEN 'trending_products' THEN
                        view_definition := $view_definition$
                            WITH lifetime_sales AS (
                                SELECT
                                    oi.product_id_snapshot AS product_id,
                                    SUM(oi.quantity)::BIGINT AS total_units_sold
                                FROM order_items oi
                                JOIN orders o ON o.id = oi.order_id
                                WHERE o.status <> 'cancelled'
                                GROUP BY oi.product_id_snapshot
                            )
                            SELECT
                                p.id AS product_id,
                                p.name AS product_name,
                                p.image,
                                cat.name AS category_name,
                                p.price,
                                p.stock AS available_stock,
                                sales.total_units_sold
                            FROM products p
                            JOIN categories cat ON cat.id = p.category_id
                            JOIN lifetime_sales sales ON sales.product_id = p.id
                            WHERE p.product_status = 'active'
                        $view_definition$;
                    WHEN 'top_rated_products' THEN
                        view_definition := $view_definition$
                            SELECT
                                p.id AS product_id,
                                p.name AS product_name,
                                p.image,
                                c.name AS category_name,
                                s.name AS seller_name,
                                p.price,
                                ROUND(AVG(r.rating), 1) AS average_rating,
                                COUNT(r.id) AS total_reviews
                            FROM products p
                            JOIN categories c ON c.id = p.category_id
                            JOIN sellers s ON s.id = p.seller_id
                            JOIN reviews r ON r.product_id = p.id
                            WHERE p.product_status = 'active'
                                AND s.status = 'approved'
                            GROUP BY p.id, p.name, p.image, c.name, s.name, p.price
                            HAVING COUNT(r.id) >= 3 AND AVG(r.rating) >= 4.0
                        $view_definition$;
                    WHEN 'top_rated_sellers' THEN
                        view_definition := $view_definition$
                            SELECT
                                s.id AS seller_id,
                                s.name AS seller_name,
                                s.logo,
                                ROUND(AVG(r.rating), 1) AS average_rating,
                                COUNT(r.id) AS total_reviews
                            FROM sellers s
                            JOIN products p ON p.seller_id = s.id
                            JOIN reviews r ON r.product_id = p.id
                            WHERE s.status = 'approved'
                            GROUP BY s.id, s.name, s.logo
                        $view_definition$;
                    WHEN 'admin_dashboard_stats' THEN
                        view_definition := $view_definition$
                            SELECT
                                (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
                                (SELECT COUNT(*) FROM sellers) AS total_sellers,
                                (SELECT COUNT(*) FROM sellers WHERE status = 'approved') AS approved_sellers,
                                (SELECT COUNT(*) FROM sellers WHERE status = 'pending') AS pending_sellers,
                                (SELECT COUNT(*) FROM products) AS total_products,
                                (SELECT COUNT(*) FROM products WHERE product_status = 'active') AS active_products,
                                (SELECT COUNT(*) FROM orders) AS total_orders,
                                (SELECT COALESCE(SUM(subtotal), 0) FROM orders) AS total_revenue
                        $view_definition$;
                    WHEN 'customer_profiles' THEN
                        view_definition := $view_definition$
                            SELECT c.id, u.username, c.name, u.email, c.number,
                                   c.address_house_name, c.address_street, c.address_city,
                                   c.address_postal_code, c.address_additional_info, c.created_at,
                                   c.address_latitude, c.address_longitude
                            FROM customers c
                            JOIN users u ON u.id = c.id AND u.role = 'customer'
                        $view_definition$;
                    WHEN 'seller_profiles' THEN
                        view_definition := $view_definition$
                            SELECT s.id, u.username, s.name, u.email, s.number, s.logo, s.description, s.status,
                                   s.address_house_name, s.address_street, s.address_city,
                                   s.address_postal_code, s.address_additional_info,
                                   s.address_latitude, s.address_longitude, s.created_at,
                                   s.identity_verified, s.documents_reviewed, s.payout_verified,
                                   s.payout_method, s.payout_account
                            FROM sellers s
                            JOIN users u ON u.id = s.id AND u.role = 'seller'
                        $view_definition$;
                    WHEN 'admin_profiles' THEN
                        view_definition := $view_definition$
                            SELECT a.id, u.username, a.name, u.email, a.number,
                                   a.address_house_name, a.address_street, a.address_city,
                                   a.address_postal_code, a.address_additional_info, a.created_at
                            FROM admins a
                            JOIN users u ON u.id = a.id AND u.role = 'admin'
                        $view_definition$;
                    ELSE
                        NULL;
                END CASE;

                SELECT CASE
                    WHEN saved_view.reloptions IS NULL OR cardinality(saved_view.reloptions) = 0 THEN ''
                    ELSE ' WITH (' || (
                        SELECT string_agg(
                            format('%I=%s', split_part(option, '=', 1), split_part(option, '=', 2)),
                            ', '
                        )
                        FROM unnest(saved_view.reloptions) AS option
                    ) || ')'
                END INTO option_list;

                EXECUTE format(
                    'CREATE VIEW %I.%I%s AS %s',
                    saved_view.schema_name, saved_view.view_name, option_list, view_definition
                );
                IF saved_view.comment_text IS NOT NULL THEN
                    EXECUTE format(
                        'COMMENT ON VIEW %I.%I IS %L',
                        saved_view.schema_name, saved_view.view_name, saved_view.comment_text
                    );
                END IF;

                FOR object_name IN
                    SELECT column_name FROM _shopniro_saved_view_columns
                    WHERE view_name = saved_view.view_name AND comment_text IS NOT NULL
                LOOP
                    SELECT comment_text INTO grant_sql
                    FROM _shopniro_saved_view_columns
                    WHERE view_name = saved_view.view_name AND column_name = object_name;
                    EXECUTE format(
                        'COMMENT ON COLUMN %I.%I.%I IS %L',
                        saved_view.schema_name, saved_view.view_name, object_name, grant_sql
                    );
                END LOOP;

                FOR acl_role IN SELECT rolname FROM pg_roles WHERE rolname <> current_user
                LOOP
                    EXECUTE format(
                        'REVOKE ALL ON VIEW %I.%I FROM %I',
                        saved_view.schema_name, saved_view.view_name, acl_role
                    );
                END LOOP;
                EXECUTE format(
                    'REVOKE ALL ON VIEW %I.%I FROM PUBLIC',
                    saved_view.schema_name, saved_view.view_name
                );

                FOR view_acl IN
                    SELECT grantee_name, privilege_type, is_grantable
                    FROM _shopniro_saved_view_acl
                    WHERE view_name = saved_view.view_name
                      AND grantee_name <> owner_name
                LOOP
                    grant_sql := format(
                        'GRANT %s ON VIEW %I.%I TO %s%s',
                        view_acl.privilege_type,
                        saved_view.schema_name,
                        saved_view.view_name,
                        CASE WHEN view_acl.grantee_name = 'PUBLIC' THEN 'PUBLIC'
                             ELSE format('%I', view_acl.grantee_name) END,
                        CASE WHEN view_acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
                    );
                    EXECUTE grant_sql;
                END LOOP;

                FOR view_acl IN
                    SELECT column_name, grantee_name, privilege_type, is_grantable
                    FROM _shopniro_saved_view_column_acl
                    WHERE view_name = saved_view.view_name
                      AND grantee_name <> owner_name
                LOOP
                    EXECUTE format(
                        'GRANT %s (%I) ON VIEW %I.%I TO %s%s',
                        view_acl.privilege_type,
                        view_acl.column_name,
                        saved_view.schema_name,
                        saved_view.view_name,
                        CASE WHEN view_acl.grantee_name = 'PUBLIC' THEN 'PUBLIC'
                             ELSE format('%I', view_acl.grantee_name) END,
                        CASE WHEN view_acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
                    );
                END LOOP;

                EXECUTE format(
                    'ALTER VIEW %I.%I OWNER TO %I',
                    saved_view.schema_name, saved_view.view_name, saved_view.owner_name
                );
                UPDATE _shopniro_saved_views SET recreated = TRUE
                WHERE view_name = saved_view.view_name;
                restored_count := restored_count + 1;
            END LOOP;

            SELECT count(*) INTO pending_count FROM _shopniro_saved_views WHERE NOT recreated;
            EXIT WHEN pending_count = 0;
            IF restored_count = 0 THEN
                RAISE EXCEPTION 'Could not restore dependent views; unresolved view dependency cycle or missing dependency.';
            END IF;
        END LOOP;

        LOOP
            restored_count := 0;
            FOR saved_routine IN
                SELECT saved.*
                FROM _shopniro_saved_routines saved
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM pg_proc existing
                    JOIN pg_namespace existing_namespace ON existing_namespace.oid = existing.pronamespace
                    WHERE format(
                        '%I.%I(%s)', existing_namespace.nspname, existing.proname,
                        pg_get_function_identity_arguments(existing.oid)
                    ) = saved.signature
                )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM unnest(saved.dependencies) AS dependency(signature)
                      WHERE NOT EXISTS (
                          SELECT 1
                          FROM pg_proc existing_dependency
                          JOIN pg_namespace existing_namespace
                            ON existing_namespace.oid = existing_dependency.pronamespace
                          WHERE format(
                              '%I.%I(%s)', existing_namespace.nspname, existing_dependency.proname,
                              pg_get_function_identity_arguments(existing_dependency.oid)
                          ) = dependency.signature
                      )
                  )
                ORDER BY saved.signature
            LOOP
                EXECUTE saved_routine.routine_definition;
                IF saved_routine.comment_text IS NOT NULL THEN
                    IF saved_routine.routine_kind = 'p' THEN
                        EXECUTE format(
                            'COMMENT ON PROCEDURE %s IS %L',
                            saved_routine.signature, saved_routine.comment_text
                        );
                    ELSE
                        EXECUTE format(
                            'COMMENT ON FUNCTION %s IS %L',
                            saved_routine.signature, saved_routine.comment_text
                        );
                    END IF;
                END IF;

                FOR acl_role IN SELECT rolname FROM pg_roles WHERE rolname <> current_user
                LOOP
                    IF saved_routine.routine_kind = 'p' THEN
                        EXECUTE format(
                            'REVOKE ALL ON PROCEDURE %s FROM %I',
                            saved_routine.signature, acl_role
                        );
                    ELSE
                        EXECUTE format(
                            'REVOKE ALL ON FUNCTION %s FROM %I',
                            saved_routine.signature, acl_role
                        );
                    END IF;
                END LOOP;
                IF saved_routine.routine_kind = 'p' THEN
                    EXECUTE format('REVOKE ALL ON PROCEDURE %s FROM PUBLIC', saved_routine.signature);
                ELSE
                    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', saved_routine.signature);
                END IF;

                FOR routine_acl IN
                    SELECT grantee_name, privilege_type, is_grantable
                    FROM _shopniro_saved_routine_acl
                    WHERE old_oid = saved_routine.old_oid
                      AND grantee_name <> owner_name
                LOOP
                    grant_sql := format(
                        'GRANT %s ON %s %s TO %s%s',
                        routine_acl.privilege_type,
                        CASE WHEN saved_routine.routine_kind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
                        saved_routine.signature,
                        CASE WHEN routine_acl.grantee_name = 'PUBLIC' THEN 'PUBLIC'
                             ELSE format('%I', routine_acl.grantee_name) END,
                        CASE WHEN routine_acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
                    );
                    EXECUTE grant_sql;
                END LOOP;

                IF saved_routine.routine_kind = 'p' THEN
                    EXECUTE format(
                        'ALTER PROCEDURE %s OWNER TO %I',
                        saved_routine.signature, saved_routine.owner_name
                    );
                ELSE
                    EXECUTE format(
                        'ALTER FUNCTION %s OWNER TO %I',
                        saved_routine.signature, saved_routine.owner_name
                    );
                END IF;
                restored_count := restored_count + 1;
            END LOOP;

            SELECT count(*) INTO pending_count
            FROM _shopniro_saved_routines saved
            WHERE NOT EXISTS (
                SELECT 1
                FROM pg_proc existing
                JOIN pg_namespace existing_namespace ON existing_namespace.oid = existing.pronamespace
                WHERE format(
                    '%I.%I(%s)', existing_namespace.nspname, existing.proname,
                    pg_get_function_identity_arguments(existing.oid)
                ) = saved.signature
            );
            EXIT WHEN pending_count = 0;
            IF restored_count = 0 THEN
                RAISE EXCEPTION 'Could not restore dependent routines; unresolved routine dependency cycle or missing dependency.';
            END IF;
        END LOOP;
    END IF;
END;
$$;
