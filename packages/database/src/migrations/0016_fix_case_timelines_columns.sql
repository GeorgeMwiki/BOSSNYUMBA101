-- =============================================================================
-- 0016: Fix case_timelines column name drift
-- =============================================================================
-- Migration 0014 created case_timelines with columns `summary` and
-- `details`, but the Drizzle schema (cases.schema.ts) defines `title`
-- and `description`. Application code reads the schema names, so every
-- query gets NULLs for those fields. This migration renames the columns
-- to match the schema without data loss.
-- =============================================================================

ALTER TABLE case_timelines RENAME COLUMN summary TO title;
ALTER TABLE case_timelines RENAME COLUMN details  TO description;

-- Also add the extra columns the schema declares but 0014 missed:
ALTER TABLE case_timelines ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE case_timelines ADD COLUMN IF NOT EXISTS is_customer_visible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE case_timelines ADD COLUMN IF NOT EXISTS previous_value JSONB;
ALTER TABLE case_timelines ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE case_timelines ADD COLUMN IF NOT EXISTS actor_name TEXT;

-- End of 0016
