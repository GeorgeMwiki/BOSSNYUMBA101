-- =============================================================================
-- 0154b: Pre-empt the `text = uuid` operator error so 0155 can install its
--        tenant-isolation RLS policies on a FRESH database.
--
-- ORDERING-BUG FIX (fresh-DB blocker). Mirrors the shipped fix-forward
-- `0175_fix_rls_type_coercion.sql`, hoisted to run BEFORE 0155.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- `0155_supabase_rls_policies.sql` defines, in the SAME file:
--
--     CREATE OR REPLACE FUNCTION public.current_app_tenant_id()
--       RETURNS uuid ...                                   -- (helper)
--
--     CREATE POLICY tenant_isolation_select ON public.%I
--       ... USING (tenant_id = public.current_app_tenant_id());
--
-- but every `tenant_id` column platform-wide is TEXT (see `tenants.id`
-- in 0001_initial.sql; `customers.tenant_id` etc. are all TEXT). Comparing
-- TEXT against the UUID-returning helper raises, at policy-creation time:
--
--     ERROR:  operator does not exist: text = uuid            (SQLSTATE 42883)
--
-- so the WHOLE run aborts inside 0155's transaction. Only ~243 of the
-- ~250+ tables get created and every migration from 0155 onward is
-- skipped.
--
-- The repo SHIPS `0175_fix_rls_type_coercion.sql` as the forward-fix: it
-- DROPs the helper and re-creates it `RETURNS text`, which makes
-- `tenant_id (text) = helper (text)` resolve. But 0175 sorts AFTER 0155,
-- so on a fresh DB the run dies long before 0175 can heal anything —
-- exactly the same ordering trap that 0123b solves for owner_statements.
--
-- ─────────────────────────────────────────────────────────────────────
-- Why we cannot simply pre-define the helper as TEXT here
-- ─────────────────────────────────────────────────────────────────────
-- 0155 issues `CREATE OR REPLACE FUNCTION ... RETURNS uuid`. Postgres
-- forbids `CREATE OR REPLACE` from changing a function's return type
-- ("cannot change return type of existing function"). So if THIS file
-- pre-created the helper `RETURNS text`, 0155 itself would then abort on
-- the helper DDL instead. 0155 is merged and IMMUTABLE, so the helper
-- must keep the UUID signature until 0175 legitimately DROPs + recreates
-- it. (This is the very constraint 0175's own header documents.)
--
-- ─────────────────────────────────────────────────────────────────────
-- Fix strategy — bridge the comparison, not the return type
-- ─────────────────────────────────────────────────────────────────────
-- Install an IMPLICIT cast `(uuid AS text)`. With it present, the planner
-- resolves `text = uuid` by widening the UUID side to TEXT, so 0155's
-- (and 0156's, 0163's, 0164c's, 0166b's, 0169b's, 0173's, 0174's) policy
-- DDL all create cleanly while the helper is still UUID. When 0175 later
-- DROPs the helper and recreates it `RETURNS text`, the comparisons
-- become plain `text = text` and the cast is simply never exercised on
-- those predicates again — it stays installed but inert.
--
-- Postgres ships NO built-in cast (implicit or otherwise) between `uuid`
-- and `text` (verified: `pg_cast` has zero rows touching the uuid type),
-- which is precisely why 0155's comparison fails out of the box. Adding
-- the INOUT cast is the smallest possible DDL that unblocks the run.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety on real Supabase + already-migrated DBs
-- ─────────────────────────────────────────────────────────────────────
--   * The cast is created only `IF NOT EXISTS` (guarded by a pg_cast
--     lookup), so re-running this migration — or running it on a DB that
--     already has the cast — is a no-op.
--   * On a real Supabase project the cast does not exist beforehand;
--     adding a uuid→text INOUT cast is a benign widening that never
--     changes the result of any comparison that already type-checks
--     (uuid→text is loss-less and deterministic). It only ENABLES the
--     mixed-type comparison that 0155 needs.
--   * 0175 remains the canonical end-state (helper returns TEXT); this
--     file only carries the run across the 0155→0175 gap on a from-
--     scratch apply. On Supabase, where migrations are applied in order
--     and 0175 always lands, the net effect is identical.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_cast
    WHERE castsource = 'uuid'::regtype
      AND casttarget = 'text'::regtype
  ) THEN
    -- WITH INOUT: route uuid → text through the type's I/O (text-out)
    -- function; AS IMPLICIT: let the planner apply it automatically so
    -- `tenant_id = current_app_tenant_id()` type-checks without an
    -- explicit `::text` in the (immutable) policy DDL.
    CREATE CAST (uuid AS text) WITH INOUT AS IMPLICIT;
  END IF;
END
$$;
