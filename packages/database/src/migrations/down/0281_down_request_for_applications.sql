-- Down migration for 0281_request_for_applications. Idempotent.

BEGIN;

DROP TABLE IF EXISTS request_for_application_responses CASCADE;
DROP TABLE IF EXISTS request_for_applications CASCADE;

COMMIT;
