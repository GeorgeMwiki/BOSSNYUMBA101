-- BOSSNYUMBA Users Region + Language Migration
-- Adds region and language columns to users so we can route users to the
-- right JurisdictionConfig and render the UI in their preferred language
-- without relying solely on the tenant-level default.
--
-- region:   ISO-3166 alpha-2 country code (nullable — falls back to tenant).
-- language: ISO-639-1 language code (nullable — falls back to locale/tenant default).

-- ============================================================================
-- users: add region
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS region TEXT;

-- ============================================================================
-- users: add language
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS language TEXT;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS users_region_idx   ON users(region);
CREATE INDEX IF NOT EXISTS users_language_idx ON users(language);

-- ============================================================================
-- Down (reference)
-- ============================================================================
-- DROP INDEX IF EXISTS users_language_idx;
-- DROP INDEX IF EXISTS users_region_idx;
-- ALTER TABLE users DROP COLUMN IF EXISTS language;
-- ALTER TABLE users DROP COLUMN IF EXISTS region;
