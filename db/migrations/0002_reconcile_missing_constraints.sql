-- Rollback: drop the constraints added below; do not remove the existing username or review checks.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.cart'::regclass AND conname = 'cart_customer_id_fkey'
    ) THEN
        ALTER TABLE public.cart
            ADD CONSTRAINT cart_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.cart'::regclass AND conname = 'cart_product_id_fkey'
    ) THEN
        ALTER TABLE public.cart
            ADD CONSTRAINT cart_product_id_fkey
            FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_customer_id_fkey'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.products'::regclass AND conname = 'products_category_id_fkey'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.products'::regclass AND conname = 'products_seller_id_fkey'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT products_seller_id_fkey
            FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_customer_id_fkey'
    ) THEN
        ALTER TABLE public.reviews
            ADD CONSTRAINT reviews_customer_id_fkey
            FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_product_id_fkey'
    ) THEN
        ALTER TABLE public.reviews
            ADD CONSTRAINT reviews_product_id_fkey
            FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.reviews'::regclass AND conname = 'reviews_rating_check'
    ) THEN
        ALTER TABLE public.reviews
            ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass AND conname = 'users_username_key'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END;
$$;
