-- =============================================================================
-- Down-migration 0334 — reverse owner_settings.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes every owner's saved
-- display preferences (language / currency / timezone / date-format) and the
-- notification toggles. The fail-safe consequence: GET /owner/account/settings
-- falls back to the route's defaults (en / USD / Africa/Dar_es_Salaam) and the
-- Settings page Save degrades honestly until the table is restored. NO money /
-- licence / ledger records live here — these are per-user UI preferences. The
-- canonical FX-resolution chain is unaffected because the currency choice is
-- ALSO mirrored into currency_preferences (which this down does NOT touch).
-- DATA LOSS: discards every owner's saved preferences (owners must re-pick).
--
-- Reverses migration 0334_owner_settings.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_owner_settings      ON owner_settings;
DROP POLICY IF EXISTS owner_settings_service_role_bypass   ON owner_settings;

DROP INDEX IF EXISTS idx_owner_settings_tenant_user;

DROP TABLE IF EXISTS owner_settings;

COMMIT;
