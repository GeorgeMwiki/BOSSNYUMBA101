-- Down migration for 0275_marketing_pilot_applications
-- Drops the entire table + policies. Idempotent. Cascades to nothing
-- (no FKs in to this public-write surface).

BEGIN;

DROP TABLE IF EXISTS marketing_pilot_applications CASCADE;

COMMIT;
