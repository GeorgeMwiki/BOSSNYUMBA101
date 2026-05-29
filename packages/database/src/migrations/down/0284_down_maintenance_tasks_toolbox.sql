-- Down migration for 0284_maintenance_tasks_toolbox. Idempotent.

BEGIN;

DROP TABLE IF EXISTS maintenance_toolbox_talks CASCADE;
DROP TABLE IF EXISTS maintenance_tasks CASCADE;

COMMIT;
