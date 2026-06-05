-- =============================================================================
-- Down-migration 0310 - reverse property development pro-forma plans.
--
-- Dev/staging only. Dropping these tables loses every development pro-forma
-- plan and section. A production rollback must export these tables first if
-- any are forensic-retained.
--
-- Reverses migration 0310_development_plans.sql. development_plan_sections
-- FK to development_plans (ON DELETE CASCADE), so we drop the child first
-- for clarity.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS development_plan_sections_tenant_isolation ON development_plan_sections;
DROP POLICY IF EXISTS development_plans_tenant_isolation         ON development_plans;

DROP INDEX IF EXISTS development_plan_sections_tenant_plan;
DROP INDEX IF EXISTS development_plan_sections_plan_key_uq;
DROP INDEX IF EXISTS development_plans_tenant_property;
DROP INDEX IF EXISTS development_plans_tenant_status;

DROP TABLE IF EXISTS development_plan_sections;
DROP TABLE IF EXISTS development_plans;

COMMIT;
