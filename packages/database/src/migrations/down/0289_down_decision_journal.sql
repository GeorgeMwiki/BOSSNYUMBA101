-- Down migration for 0289_decision_journal. Idempotent.

BEGIN;

DROP TABLE IF EXISTS decision_links CASCADE;
DROP TABLE IF EXISTS decision_outcomes CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;

COMMIT;
