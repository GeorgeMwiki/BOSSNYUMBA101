-- =============================================================================
-- Down-migration 0305 - reverse org / team-management write surface.
--
-- Dev/staging only. Dropping these tables loses every staff member, KPI,
-- task, and escalation row in the org-management surface. A production
-- rollback must export these tables first if any are forensic-retained.
--
-- Reverses migration 0305_org_team_management.sql. Child tables FK to
-- staff_members / org_tasks (ON DELETE SET NULL), so drop order is not
-- strictly required, but we drop dependents first for clarity.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS org_escalations_tenant_isolation ON org_escalations;
DROP POLICY IF EXISTS org_tasks_tenant_isolation       ON org_tasks;
DROP POLICY IF EXISTS staff_kpis_tenant_isolation      ON staff_kpis;
DROP POLICY IF EXISTS staff_members_tenant_isolation   ON staff_members;

DROP INDEX IF EXISTS org_escalations_tenant_status;
DROP INDEX IF EXISTS org_tasks_tenant_assigned;
DROP INDEX IF EXISTS org_tasks_tenant_status;
DROP INDEX IF EXISTS staff_kpis_tenant_member;
DROP INDEX IF EXISTS staff_members_tenant_status;
DROP INDEX IF EXISTS staff_members_tenant_name_active_uq;

DROP TABLE IF EXISTS org_escalations;
DROP TABLE IF EXISTS org_tasks;
DROP TABLE IF EXISTS staff_kpis;
DROP TABLE IF EXISTS staff_members;

COMMIT;
