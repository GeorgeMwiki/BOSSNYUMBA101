-- =============================================================================
-- Down-migration 0300 - reverse `owner_tabs` creation.
--
-- Dev/staging only. Production tab state is owner-recoverable (the FE
-- can rebuild the strip from chat history + entity references), but
-- restoring a deleted row would still cost the landlord their
-- in-progress drawer focus on every device. Production rollback must
-- be coordinated by the operator (#ops) before this script runs.
--
-- Reverses migration 0300_owner_tabs.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS owner_tabs_tenant_isolation ON owner_tabs;
DROP INDEX IF EXISTS owner_tabs_updated_idx;
DROP TABLE IF EXISTS owner_tabs;

COMMIT;
