-- =============================================================================
-- 00-roles.sql — Supabase-compatible roles for a PLAIN Postgres container.
--
-- Runs once, on a FRESH data volume, via the Postgres image's
-- `/docker-entrypoint-initdb.d` hook (mounted by docker-compose). Supabase
-- ships these roles built-in; a stock `postgres` / `pgvector` image does
-- NOT. The BossNyumba migrations install 457 RLS policies that
-- `GRANT … TO authenticated` / `… TO service_role` / `… TO anon`, so
-- without these roles migration 0155 aborts on a fresh DB with
-- `role "authenticated" does not exist` (SQLSTATE 42704).
--
-- Each CREATE ROLE is wrapped in a DO/EXCEPTION block so re-running (or a
-- volume that somehow already has the role) is a harmless no-op — init
-- scripts only run on a fresh volume, but this keeps the file safe to apply
-- by hand too.
--
-- Privilege model mirrors Supabase's defaults closely enough for local dev:
--   * anon           — unauthenticated REST role; granted nothing by these
--                      migrations beyond explicit policy grants.
--   * authenticated  — logged-in end users; subject to tenant RLS policies.
--   * service_role   — server-side workers; BYPASSRLS (matches Supabase).
--   * authenticator  — the login role PostgREST/Supabase switches FROM into
--                      the above via SET ROLE; granted membership in them.
-- =============================================================================

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticator NOINHERIT LOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Let the authenticator role assume the three request roles (Supabase /
-- PostgREST switch into these per request via SET ROLE). Idempotent.
GRANT anon          TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role  TO authenticator;
