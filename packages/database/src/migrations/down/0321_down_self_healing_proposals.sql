-- =============================================================================
-- Down-migration 0321 — drop self_healing_proposals.
--
-- Dev/staging only — DATA LOSS. Drops the internal-admin self-healing console
-- queue created by 0321 (table + indexes + RLS policy fall with it). Only for
-- a clean apply→reverse test on a throwaway DB.
--
-- Reverses migration 0321_self_healing_proposals.sql.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS self_healing_proposals CASCADE;

COMMIT;
