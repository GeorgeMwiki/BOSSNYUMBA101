-- =============================================================================
-- DOWN 0344 — drop the event_outbox service_role_bypass policy.
--
-- Reverses 0344_event_outbox_service_role_bypass.sql. DEV/STAGING ONLY — NOT
-- data loss: drops only the additive bypass policy; every row and the
-- event_outbox_tenant_isolation policy are untouched. While dropped, the
-- admin superpower dispatchers' cross-tenant actuation insert
-- (enqueueOutbox via withServiceRoleContext) is REJECTED by FORCE-RLS for any
-- target tenant other than the acting admin's own, re-darkening the admin
-- four-eye side-effects (#29). Reapplying 0344 restores the bypass.
-- dataLoss: false.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS event_outbox_service_role_bypass ON public.event_outbox;

COMMIT;
