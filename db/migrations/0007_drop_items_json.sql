ALTER TABLE public.orders
    DROP COLUMN IF EXISTS items_json;

ALTER TABLE public.seller_fulfillments
    DROP COLUMN IF EXISTS items_json;
