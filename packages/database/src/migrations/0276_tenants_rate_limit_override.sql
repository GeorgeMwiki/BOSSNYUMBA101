-- =============================================================================
-- Migration 0276 — tenants.rate_limit_max_per_min + ai_rate_limit_max_per_min
-- + token_budget_hourly.
--
-- Ported from Borjie 0147. Per-tenant rate-limit + token-budget override
-- columns. Lets ops promote a strategic tenant to a higher cap without a
-- process restart. Defaults are NULL; the middleware falls back to the
-- env-driven cluster defaults when the column is NULL.
--
-- Reading order in `rate-limit-redis.middleware.ts`:
--   1. tenant.rate_limit_max_per_min (if NOT NULL)
--   2. process.env.RATE_LIMIT_MAX_REQUESTS (default 100)
--
--   1. tenant.ai_rate_limit_max_per_min (if NOT NULL)
--   2. process.env.RATE_LIMIT_AI_MAX (default 30)
--
--   1. tenant.token_budget_hourly (advisory — surfaced on telemetry only)
-- =============================================================================

BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS rate_limit_max_per_min INTEGER,
  ADD COLUMN IF NOT EXISTS ai_rate_limit_max_per_min INTEGER,
  ADD COLUMN IF NOT EXISTS token_budget_hourly INTEGER;

-- Guard against silly values. Caps must be > 0 when set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_rate_limit_positive'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_rate_limit_positive
        CHECK (rate_limit_max_per_min IS NULL OR rate_limit_max_per_min > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_ai_rate_limit_positive'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_ai_rate_limit_positive
        CHECK (
          ai_rate_limit_max_per_min IS NULL OR ai_rate_limit_max_per_min > 0
        );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_token_budget_positive'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_token_budget_positive
        CHECK (token_budget_hourly IS NULL OR token_budget_hourly > 0);
  END IF;
END
$$;

COMMIT;
