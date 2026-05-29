-- Down migration for 0291_mwikila_actions_inbox. Idempotent.

BEGIN;

DROP TABLE IF EXISTS mwikila_actions_inbox CASCADE;

COMMIT;
