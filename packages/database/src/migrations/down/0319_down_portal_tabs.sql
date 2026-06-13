-- =============================================================================
-- Down-migration 0319 — reverse portal_tabs.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes the MD-authored
-- dynamic-tabs store. The fail-safe consequence is benign: with no table the
-- portal-genui tab repo's upsert/list/get paths surface a clean DB error the
-- router maps to a 5xx, and dynamic tabs stop persisting. NO money/licence/
-- ledger records live here — a tab is a UI/forms document only; LedgerService
-- owns the money path and never depended on this table. DATA LOSS: discards
-- every MD-authored PortalTab document.
--
-- Reverses migration 0319_portal_tabs.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS portal_tabs_tenant_isolation ON portal_tabs;

DROP INDEX IF EXISTS portal_tabs_tenant_tab_key_uq;
DROP INDEX IF EXISTS portal_tabs_parent_idx;
DROP INDEX IF EXISTS portal_tabs_tenant_user_idx;

DROP TABLE IF EXISTS portal_tabs;

COMMIT;
