-- BOSSNYUMBA Feature Flags Migration
-- Backs the DB loader registered into @bossnyumba/config/feature-flags by the
-- API gateway, payments, and notifications services. Resolution precedence is
-- enforced in the repository layer (user > tenant > global); this table just
-- stores rows scoped at any of those three levels.
--
-- NULL columns are wildcards:
--   tenant_id IS NULL  -> applies to every tenant   (global)
--   user_id   IS NULL  -> applies to every user in tenant_id
--
-- The COALESCE-based unique index keeps a single row per (flag_key, scope) —
-- including the all-NULL "global" scope, which standard NULLs-distinct unique
-- semantics would otherwise allow to duplicate.

-- ============================================================================
-- feature_flags table
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key          TEXT NOT NULL,
  tenant_id         TEXT,                                   -- nullable: NULL = global
  user_id           TEXT,                                   -- nullable: NULL = tenant-wide
  enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent   INTEGER,                                -- nullable: 0-100
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_flags_rollout_percent_range
    CHECK (rollout_percent IS NULL OR (rollout_percent >= 0 AND rollout_percent <= 100))
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS feature_flags_flag_key_idx
  ON feature_flags(flag_key);

CREATE INDEX IF NOT EXISTS feature_flags_tenant_id_idx
  ON feature_flags(tenant_id);

CREATE INDEX IF NOT EXISTS feature_flags_user_id_idx
  ON feature_flags(user_id);

CREATE INDEX IF NOT EXISTS feature_flags_flag_tenant_user_idx
  ON feature_flags(flag_key, tenant_id, user_id);

-- Partial unique index using COALESCE so NULL-scoped rows are treated as
-- a single wildcard per (flag_key, tenant_id, user_id).
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_scope_unique_idx
  ON feature_flags(
    flag_key,
    COALESCE(tenant_id, '__GLOBAL__'),
    COALESCE(user_id,   '__ALL__')
  );

-- ============================================================================
-- Down (reference)
-- ============================================================================
-- DROP INDEX IF EXISTS feature_flags_scope_unique_idx;
-- DROP INDEX IF EXISTS feature_flags_flag_tenant_user_idx;
-- DROP INDEX IF EXISTS feature_flags_user_id_idx;
-- DROP INDEX IF EXISTS feature_flags_tenant_id_idx;
-- DROP INDEX IF EXISTS feature_flags_flag_key_idx;
-- DROP TABLE IF EXISTS feature_flags;
