-- =============================================================================
-- Down-migration 0330 — reverse device_tokens.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes the canonical
-- push-receiver registration store backing /api/v1/me/device-tokens. The
-- fail-safe consequence: device registration can no longer persist and the
-- /me router's reads fault until restored; every device must re-register on
-- next sign-in. NO money/ledger records live here; tokens are opaque receiver
-- handles. DATA LOSS: discards every tenant's device-token registrations.
--
-- Reverses migration 0330_device_tokens.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_device_tokens     ON device_tokens;
DROP POLICY IF EXISTS device_tokens_service_role_bypass  ON device_tokens;

DROP INDEX IF EXISTS idx_device_tokens_tenant_token;
DROP INDEX IF EXISTS idx_device_tokens_tenant_user_active;

DROP TABLE IF EXISTS device_tokens;

COMMIT;
