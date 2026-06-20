-- =============================================================================
-- DOWN 0339 — restore the non-partial org_memberships unique index.
--
-- Reverses 0339_org_memberships_partial_active_idx.sql. DEV/STAGING ONLY.
--
-- WARNING: restoring the NON-PARTIAL unique index re-introduces the re-join
-- defect — if any (tenant_identity_id, organization_id) has BOTH a retained
-- LEFT/BLOCKED row and an ACTIVE row, recreating the non-partial unique index
-- will FAIL because those rows collide. In that case the down migration aborts
-- (transaction rolls back) and the partial index is retained; that is the safe
-- outcome. dataLoss: false (indexes only; no rows touched).
-- =============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS org_memberships_identity_org_idx
  ON org_memberships (tenant_identity_id, organization_id);

DROP INDEX IF EXISTS org_memberships_identity_org_active_idx;

COMMIT;
