-- Rollback: drop the validated constraints added by 0002_reconcile_missing_constraints.sql.
ALTER TABLE public.cart VALIDATE CONSTRAINT cart_customer_id_fkey;
ALTER TABLE public.cart VALIDATE CONSTRAINT cart_product_id_fkey;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_customer_id_fkey;
ALTER TABLE public.products VALIDATE CONSTRAINT products_category_id_fkey;
ALTER TABLE public.products VALIDATE CONSTRAINT products_seller_id_fkey;
ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_customer_id_fkey;
ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_product_id_fkey;
ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_rating_check;
