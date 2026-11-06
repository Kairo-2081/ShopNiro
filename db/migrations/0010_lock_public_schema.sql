-- Lock the public schema so the Supabase Data API cannot reach application tables.
--
-- ShopNiro talks to Postgres directly as the table owner, which ignores row-level security, so
-- nothing in the application depends on the anon or authenticated roles. A database built only from
-- the migrations used to leave every table readable and writable by anon (found on staging, where
-- the Supabase "enable RLS automatically" trigger was missing). Production already looks like this
-- after the change, so applying it there changes nothing.
--
-- Idempotent: tables that already have RLS are skipped, and the role steps run only where the
-- Supabase roles exist (a plain Postgres, such as CI, has none).
-- Manual rollback: ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY, then GRANT back whatever
-- is needed to anon and authenticated.
DO $$
DECLARE
  target_table record;
  api_role text;
BEGIN
  FOR target_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table.relname);
  END LOOP;

  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      -- Tables created by later migrations must not get the default Supabase grants back.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
