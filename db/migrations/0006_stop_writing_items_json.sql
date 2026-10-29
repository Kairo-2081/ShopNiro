ALTER TABLE public.orders
    ALTER COLUMN items_json DROP NOT NULL,
    ALTER COLUMN items_json SET DEFAULT '[]';

DO $migration$
DECLARE
    procedure_oid oid := to_regprocedure(
        'public.process_checkout(character varying, character varying, character varying, numeric, text, text, text)'
    );
    definition text;
    searchable_definition text;
    start_position integer;
    end_position integer;
    function_oid oid;
    function_name text;
BEGIN
    IF procedure_oid IS NULL THEN
        RAISE EXCEPTION 'Expected public.process_checkout with the production checkout signature';
    END IF;

    definition := pg_get_functiondef(procedure_oid);
    searchable_definition := lower(definition);

    start_position := strpos(searchable_definition, '    select coalesce(json_agg(json_build_object(');
    IF start_position = 0 THEN
        RAISE EXCEPTION 'Could not locate the items_json construction in process_checkout';
    END IF;
    end_position := start_position - 1
        + strpos(substring(searchable_definition FROM start_position), '    insert into orders (');
    IF end_position < start_position THEN
        RAISE EXCEPTION 'Could not locate the orders insert in process_checkout';
    END IF;
    definition := substring(definition FROM 1 FOR start_position - 1)
        || substring(definition FROM end_position);
    searchable_definition := lower(definition);

    start_position := strpos(searchable_definition, '    insert into orders (');
    IF start_position = 0 THEN
        RAISE EXCEPTION 'Could not locate the orders insert in process_checkout';
    END IF;
    end_position := start_position - 1
        + strpos(substring(searchable_definition FROM start_position), '    insert into order_items (');
    IF end_position < start_position THEN
        RAISE EXCEPTION 'Could not locate the order_items insert in process_checkout';
    END IF;
    definition := substring(definition FROM 1 FOR start_position - 1)
        || substring(definition FROM end_position);
    searchable_definition := lower(definition);

    start_position := strpos(searchable_definition, '    insert into seller_fulfillments (');
    IF start_position = 0 THEN
        RAISE EXCEPTION 'Could not locate the seller fulfillment insert in process_checkout';
    END IF;
    end_position := start_position - 1
        + strpos(substring(searchable_definition FROM start_position), '    update products p');
    IF end_position < start_position THEN
        RAISE EXCEPTION 'Could not locate the products update in process_checkout';
    END IF;
    definition := substring(definition FROM 1 FOR start_position - 1)
        || substring(definition FROM end_position);
    definition := regexp_replace(definition, E'\n[[:space:]]*v_items_json[[:space:]]+text;', '', 'i');

    IF lower(definition) LIKE '%items_json%' THEN
        RAISE EXCEPTION 'process_checkout still references items_json after transformation';
    END IF;
    IF definition !~* 'SET search_path (TO|=).*public.*pg_temp' THEN
        RAISE EXCEPTION 'process_checkout must retain search_path public, pg_temp';
    END IF;

    EXECUTE definition;

    FOREACH function_name IN ARRAY ARRAY['shopniro_orders_list()', 'shopniro_order_get(character varying)']
    LOOP
        function_oid := to_regprocedure('public.' || function_name);
        IF function_oid IS NULL THEN
            RAISE EXCEPTION 'Expected public.%', function_name;
        END IF;
        definition := pg_get_functiondef(function_oid);
        IF lower(definition) NOT LIKE '%o.items_json%' THEN
            RAISE EXCEPTION 'Expected public.% to contain the legacy order-items fallback before migration', function_name;
        END IF;
        definition := regexp_replace(definition, 'o\.items_json[[:space:]]*,[[:space:]]*', '', 'i');
        IF lower(definition) LIKE '%o.items_json%' THEN
            RAISE EXCEPTION 'Could not remove the legacy fallback from public.%', function_name;
        END IF;
        EXECUTE definition;
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
          AND definition ~* '\.items_json'
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
