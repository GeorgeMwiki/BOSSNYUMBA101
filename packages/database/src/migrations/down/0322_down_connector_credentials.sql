-- =============================================================================
-- Down-migration 0322 — reverse connector_credentials.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes the shared
-- per-tenant connector credential store. The fail-safe consequence: the
-- connector fabric's status reads fault and degrade honestly (storeAvailable
-- false), and OAuth connects can no longer persist credentials until the table
-- is restored. NO money/licence/ledger records live here; the token columns are
-- AES-GCM ciphertext (no plaintext ever stored). DATA LOSS: discards every
-- tenant's connector OAuth state (all connectors must be reconnected).
--
-- Reverses migration 0322_connector_credentials.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_connector_credentials    ON connector_credentials;
DROP POLICY IF EXISTS connector_credentials_service_role_bypass ON connector_credentials;

DROP INDEX IF EXISTS idx_connector_creds_expiry;
DROP INDEX IF EXISTS idx_connector_creds_tenant_kind;

DROP TABLE IF EXISTS connector_credentials;

COMMIT;
