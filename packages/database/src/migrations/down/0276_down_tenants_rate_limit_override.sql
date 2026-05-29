-- Down migration for 0276_tenants_rate_limit_override
-- Drops the three rate-limit override columns + CHECK constraints. Idempotent.

BEGIN;

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_token_budget_positive,
  DROP CONSTRAINT IF EXISTS tenants_ai_rate_limit_positive,
  DROP CONSTRAINT IF EXISTS tenants_rate_limit_positive;

ALTER TABLE tenants
  DROP COLUMN IF EXISTS token_budget_hourly,
  DROP COLUMN IF EXISTS ai_rate_limit_max_per_min,
  DROP COLUMN IF EXISTS rate_limit_max_per_min;

COMMIT;
