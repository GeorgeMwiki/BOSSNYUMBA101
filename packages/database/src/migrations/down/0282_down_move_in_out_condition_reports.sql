-- Down migration for 0282_move_in_out_condition_reports. Idempotent.

BEGIN;

DROP TABLE IF EXISTS move_in_out_condition_reports CASCADE;

COMMIT;
