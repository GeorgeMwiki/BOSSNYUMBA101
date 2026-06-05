-- =============================================================================
-- Down-migration 0306 - reverse agentic plan / subagent + sandbox surface.
--
-- Dev/staging only. Dropping these tables loses every proposed plan,
-- subagent run, staged sandbox write, and the commit / reject audit logs. A
-- production rollback must export these tables first if any are
-- forensic-retained (the commit + reject logs are append-only audit rows).
--
-- Reverses migration 0306_md_agentic_sandbox.sql. The commit / reject logs
-- FK to md_sandbox_writes (ON DELETE CASCADE) and md_subagent_runs /
-- md_sandbox_writes FK to md_plans (ON DELETE SET NULL), so drop order is
-- not strictly required, but we drop dependents first for clarity.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS md_sandbox_rejects_tenant_isolation ON md_sandbox_rejects;
DROP POLICY IF EXISTS md_sandbox_commits_tenant_isolation ON md_sandbox_commits;
DROP POLICY IF EXISTS md_sandbox_writes_tenant_isolation  ON md_sandbox_writes;
DROP POLICY IF EXISTS md_subagent_runs_tenant_isolation   ON md_subagent_runs;
DROP POLICY IF EXISTS md_plans_tenant_isolation           ON md_plans;

DROP INDEX IF EXISTS md_sandbox_rejects_tenant_created;
DROP INDEX IF EXISTS md_sandbox_rejects_tenant_write;
DROP INDEX IF EXISTS md_sandbox_commits_tenant_created;
DROP INDEX IF EXISTS md_sandbox_commits_tenant_write;
DROP INDEX IF EXISTS md_sandbox_writes_tenant_table;
DROP INDEX IF EXISTS md_sandbox_writes_tenant_status;
DROP INDEX IF EXISTS md_subagent_runs_tenant_status;
DROP INDEX IF EXISTS md_subagent_runs_tenant_team;
DROP INDEX IF EXISTS md_plans_tenant_status;

DROP TABLE IF EXISTS md_sandbox_rejects;
DROP TABLE IF EXISTS md_sandbox_commits;
DROP TABLE IF EXISTS md_sandbox_writes;
DROP TABLE IF EXISTS md_subagent_runs;
DROP TABLE IF EXISTS md_plans;

COMMIT;
