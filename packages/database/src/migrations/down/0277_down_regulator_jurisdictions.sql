-- Down migration for 0277_regulator_jurisdictions
-- Drops the catalogue + tenant columns/constraints. Idempotent.

BEGIN;

DROP INDEX IF EXISTS tenants_country_code_idx;
DROP INDEX IF EXISTS tenants_regulator_set_idx;

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_default_language_chk,
  DROP CONSTRAINT IF EXISTS tenants_primary_currency_chk,
  DROP CONSTRAINT IF EXISTS tenants_country_code_chk,
  DROP CONSTRAINT IF EXISTS tenants_regulator_set_chk;

ALTER TABLE tenants
  DROP COLUMN IF EXISTS default_language,
  DROP COLUMN IF EXISTS primary_currency,
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS regulator_set;

DROP TABLE IF EXISTS regulator_jurisdictions CASCADE;

COMMIT;
