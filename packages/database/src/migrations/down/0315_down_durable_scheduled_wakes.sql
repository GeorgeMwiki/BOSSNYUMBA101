-- =============================================================================
-- Down-migration 0315 — reverse durable scheduled wakes + armed monitors.
--
-- Dev/staging only. Dropping these tables loses every armed wake/monitor that
-- has not yet fired; after a rollback the supervisor degrades to the storeless
-- in-process fallback (arms are then lost on restart again). No money / audit
-- data lives here, so the rollback is operationally cheap.
--
-- Reverses migration 0315_durable_scheduled_wakes.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS durable_scheduled_wakes_service_role_bypass ON durable_scheduled_wakes;
DROP POLICY IF EXISTS durable_scheduled_wakes_tenant_isolation    ON durable_scheduled_wakes;
DROP POLICY IF EXISTS durable_armed_monitors_service_role_bypass  ON durable_armed_monitors;
DROP POLICY IF EXISTS durable_armed_monitors_tenant_isolation     ON durable_armed_monitors;

DROP INDEX IF EXISTS durable_scheduled_wakes_resume_token_uq;
DROP INDEX IF EXISTS durable_scheduled_wakes_wake_at_idx;
DROP INDEX IF EXISTS durable_scheduled_wakes_tenant_idx;
DROP INDEX IF EXISTS durable_armed_monitors_watch_id_uq;
DROP INDEX IF EXISTS durable_armed_monitors_expires_at_idx;
DROP INDEX IF EXISTS durable_armed_monitors_tenant_idx;

DROP TABLE IF EXISTS durable_scheduled_wakes;
DROP TABLE IF EXISTS durable_armed_monitors;

COMMIT;
