-- =============================================================================
-- 0336 — service_role_bypass policies for two cross-tenant system-job tables.
--
-- Two FORCE-RLS tables are read/written by background workers that
-- legitimately span tenants in a SINGLE query and therefore have no one
-- tenant id to bind:
--
--   * kernel_cot_reservoir   — the consolidation-worker fetches ALL
--     unconsolidated chain-of-thought rows (some with tenant_id NULL) and
--     marks them consolidated.
--   * briefing_subscriptions — the executive-brief cron scans ALL due
--     subscriptions by next_due_at across every tenant.
--
-- The 0179 RLS sweep installed a `service_role_bypass` policy on every
-- tenant-scoped table so such jobs can opt in via `app.is_service_role =
-- 'true'` (bound transactionally by withServiceRoleContext /
-- withWorkerServiceRoleContext) — but these two tables were created later
-- (0146 / 0224) and never received the bypass. Without it, under the
-- mandated NON-BYPASS production DB role the cross-tenant SELECT/UPDATE
-- matches ZERO rows and the worker is silently born-dark:
--   - CoT is never distilled into semantic memory (brain learning loop dark)
--   - no executive brief is ever generated for any tenant
--
-- This migration closes the 0179 gap for exactly these two tables. The
-- policy is the SAME shape 0179 installed elsewhere (permissive, FOR ALL,
-- gated solely on the service-role GUC) so it OR-composes with the existing
-- tenant_isolation policies — tenant-scoped access is entirely unchanged.
--
-- Idempotent: guarded by table existence + DROP POLICY IF EXISTS.
-- =============================================================================

BEGIN;

-- ---- kernel_cot_reservoir (FORCE RLS + cot_tenant_isolation from 0146) ----
DO $do_cot_reservoir$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kernel_cot_reservoir'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.kernel_cot_reservoir;';
    EXECUTE 'CREATE POLICY service_role_bypass ON public.kernel_cot_reservoir
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';
  END IF;
END
$do_cot_reservoir$;

-- ---- briefing_subscriptions (FORCE RLS + tenant_isolation_* from 0224/0239) ----
DO $do_briefing_subscriptions$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'briefing_subscriptions'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.briefing_subscriptions;';
    EXECUTE 'CREATE POLICY service_role_bypass ON public.briefing_subscriptions
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';
  END IF;
END
$do_briefing_subscriptions$;

COMMIT;
