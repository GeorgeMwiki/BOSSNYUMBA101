-- =============================================================================
-- Down-migration for 0295_discovered_jurisdictions.sql.
--
-- Reverses the discovered-jurisdictions cache table + RLS policy.
--
-- DESTRUCTIVE: drops all cached discovery profiles. The curated seed
--    (jurisdiction-resolver SNAPSHOTS map + `regulator_jurisdictions`)
--    is untouched. Dev/staging ONLY — no business-critical data lives
--    in the cache (each row is recomputable via the discovery pipeline).
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS discovered_jurisdictions CASCADE;

COMMIT;
