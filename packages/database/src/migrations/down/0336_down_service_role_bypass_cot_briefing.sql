-- =============================================================================
-- Down-migration 0336 — drop the service_role_bypass policies added to
-- kernel_cot_reservoir + briefing_subscriptions.
--
-- Dev/staging only. NOT data loss — drops only the additive bypass policies;
-- every row and every tenant_isolation policy is untouched. Reapplying 0336
-- restores cross-tenant system-job access. While dropped, the consolidation
-- worker (CoT -> semantic memory) + executive-brief cron revert to born-dark
-- under a non-BYPASS DB role (zero rows visible, no error surfaced).
--
-- Reverses migration 0336_service_role_bypass_cot_briefing.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS service_role_bypass ON public.kernel_cot_reservoir;
DROP POLICY IF EXISTS service_role_bypass ON public.briefing_subscriptions;

COMMIT;
