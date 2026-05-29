-- Down migration for 0279_tab_proposals_inbox. Idempotent.

BEGIN;

DROP TABLE IF EXISTS tab_proposals_inbox CASCADE;

COMMIT;
