-- =============================================================================
-- Down-migration 0316 — reverse person_links RLS + disbursements atomic-claim
-- unique index.
--
-- Dev/staging only. Dropping the person_links policies + disabling RLS
-- RE-OPENS the cross-tenant identity-linkage leak that 0316 closed, so this
-- down must NEVER run in production — it is purely a dev/staging reset hook.
-- No table or row data is destroyed (person_links rows survive); only the
-- RLS posture and the redundant claim index are removed, so dataLoss is the
-- security posture, not the data itself.
--
-- The disbursements partial unique index from 0174
-- (disbursements_idempotency_idx) is left intact — this only drops the
-- non-partial arbiter index 0316 added.
--
-- Reverses migration 0316_person_links_rls.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS service_role_bypass       ON public.person_links;
DROP POLICY IF EXISTS tenant_isolation_modify   ON public.person_links;
DROP POLICY IF EXISTS tenant_isolation_select   ON public.person_links;

ALTER TABLE IF EXISTS public.person_links NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.person_links DISABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS disbursements_tenant_idempotency_uq;

COMMIT;
