-- Down migration for 0278_onboarding_state. Idempotent.

BEGIN;

DROP TABLE IF EXISTS onboarding_state CASCADE;

COMMIT;
