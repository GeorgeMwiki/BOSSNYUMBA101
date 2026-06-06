-- =============================================================================
-- Down-migration 0312 — reverse case photos column.
--
-- Dev/staging only. Dropping this column loses any photo references attached
-- to a case at intake time. Photos that were promoted into the normalized
-- `evidence_attachments` table are unaffected.
--
-- Reverses migration 0312_cases_photos.sql.
-- =============================================================================

BEGIN;

ALTER TABLE cases
  DROP COLUMN IF EXISTS photos;

COMMIT;
