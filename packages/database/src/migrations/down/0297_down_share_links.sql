-- Down migration for 0297 — Share Links.
-- Reverse-only fixture for the rollback harness. NEVER run in production.

BEGIN;

DROP TABLE IF EXISTS share_links CASCADE;

COMMIT;
