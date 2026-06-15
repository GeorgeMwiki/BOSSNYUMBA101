-- =============================================================================
-- Migration 0344 — service_role_bypass policy for event_outbox (#29).
--
-- WHY
-- ───
-- event_outbox is FORCE-RLS (0014 ENABLE + 0173 FORCE) with a single
-- tenant-isolation policy:
--   event_outbox_tenant_isolation USING (tenant_id =
--     current_setting('app.current_tenant_id', true))
--
-- The admin superpower dispatchers
-- (services/api-gateway/src/routes/admin/superpowers/
-- bulk-action-dispatchers.ts → enqueueOutbox) write a CROSS-TENANT actuation
-- row: tenant_id is the TARGET tenant (or NULL for a platform-wide
-- broadcast), NOT the acting admin's tenant. The admin's request runs under
-- the admin's own app.current_tenant_id GUC, so the insert FAILS the
-- tenant_isolation WITH CHECK for any cross-tenant target — yet the route's
-- journal/pending row already says 'applied'. The actuation was born-dark:
-- "tenant Acme suspended" with no outbox row ever written, nothing for the
-- outbox worker to drain.
--
-- WHAT IT DOES
-- ────────────
-- Adds an additive permissive `event_outbox_service_role_bypass` policy gated
-- solely on app.is_service_role = 'true'. enqueueOutbox now wraps the insert
-- in withServiceRoleContext (packages/database/src/rls/with-tenant-context.ts)
-- which binds that GUC transactionally, so this policy's WITH CHECK passes and
-- the cross-tenant actuation row is durably written. Because the policy is
-- PERMISSIVE FOR ALL, it OR-composes with event_outbox_tenant_isolation —
-- ordinary tenant-scoped outbox writes/reads (the payouts-worker picker, the
-- per-tenant publishers) are entirely unchanged.
--
-- Same shape as 0336_service_role_bypass_cot_briefing.sql /
-- 0337_tenant_deletion_schedules.sql (service_role_bypass on a later-needed
-- cross-tenant table). Idempotent: DROP POLICY IF EXISTS + table-existence
-- guard. Replayable. Append-only / IMMUTABLE — never edit after merge.
-- =============================================================================

BEGIN;

DO $do_event_outbox_bypass$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_outbox'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS event_outbox_service_role_bypass ON public.event_outbox;';
    EXECUTE 'CREATE POLICY event_outbox_service_role_bypass ON public.event_outbox
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';
  END IF;
END
$do_event_outbox_bypass$;

COMMIT;
