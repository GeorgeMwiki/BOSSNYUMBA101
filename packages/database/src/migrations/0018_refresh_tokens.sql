-- BOSSNYUMBA Refresh Tokens Migration
-- Backs the real refresh-token rotation flow in the API gateway. Tokens are
-- opaque random 256-bit strings (NOT JWTs); we persist only the SHA-256 hash
-- so a database leak cannot be replayed. On rotation we link the consumed
-- row to its successor via `replaced_by_token_hash` so that re-use of an
-- already-rotated token can be detected and the entire chain revoked.

-- ============================================================================
-- refresh_tokens table
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL,
  tenant_id                TEXT NOT NULL,
  device_id                TEXT,                                   -- nullable: from X-Device-Id header
  token_hash               TEXT NOT NULL,                          -- SHA-256(refresh_token)
  issued_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at               TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  revoked_at               TIMESTAMPTZ,                            -- nullable: NULL means active
  replaced_by_token_hash   TEXT,                                   -- nullable: rotation chain link
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at             TIMESTAMPTZ
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx
  ON refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_tenant_id_idx
  ON refresh_tokens(tenant_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_device_id_idx
  ON refresh_tokens(device_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
  ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_device_idx
  ON refresh_tokens(user_id, device_id);

-- ============================================================================
-- Down (reference)
-- ============================================================================
-- DROP INDEX IF EXISTS refresh_tokens_user_device_idx;
-- DROP INDEX IF EXISTS refresh_tokens_expires_at_idx;
-- DROP INDEX IF EXISTS refresh_tokens_device_id_idx;
-- DROP INDEX IF EXISTS refresh_tokens_tenant_id_idx;
-- DROP INDEX IF EXISTS refresh_tokens_user_id_idx;
-- DROP INDEX IF EXISTS refresh_tokens_token_hash_idx;
-- DROP TABLE IF EXISTS refresh_tokens;
