-- Down migration for 0287_outcome_telemetry. Idempotent.

BEGIN;

DROP TABLE IF EXISTS outcome_reconciliations CASCADE;
DROP TABLE IF EXISTS outcome_observations CASCADE;
DROP TABLE IF EXISTS outcome_predictions CASCADE;

COMMIT;
