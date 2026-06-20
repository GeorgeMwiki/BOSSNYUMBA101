-- =============================================================================
-- DOWN 0337 — drop tenant_deletion_schedules.
--
-- Reverses 0337_tenant_deletion_schedules.sql. DEV/STAGING ONLY — dropping
-- discards scheduled tenant-wide erasure requests, so the right-to-erasure
-- surface (DELETE /api/v1/tenants/:id) regresses to recording the request
-- only in the audit event bus until the table is re-created. dataLoss: true.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_deletion_schedules_tenant_isolation
  ON tenant_deletion_schedules;
DROP POLICY IF EXISTS tenant_deletion_schedules_service_role_bypass
  ON tenant_deletion_schedules;

DROP TABLE IF EXISTS tenant_deletion_schedules;

COMMIT;
