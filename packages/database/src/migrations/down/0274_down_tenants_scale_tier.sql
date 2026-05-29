-- Down migration for 0274_tenants_scale_tier
-- Drops the scale_tier columns + index. Idempotent.

BEGIN;

DROP INDEX IF EXISTS tenants_scale_tier_idx;

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_scale_tier_chk;

ALTER TABLE tenants
  DROP COLUMN IF EXISTS scale_signals,
  DROP COLUMN IF EXISTS scale_tier;

COMMIT;
