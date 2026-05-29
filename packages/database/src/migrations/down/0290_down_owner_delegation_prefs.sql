-- Down migration for 0290_owner_delegation_prefs. Idempotent.

BEGIN;

DROP TABLE IF EXISTS owner_delegation_prefs CASCADE;

COMMIT;
