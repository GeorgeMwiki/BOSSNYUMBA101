-- Down migration for 0288_entity_index. Idempotent.

BEGIN;

DROP TABLE IF EXISTS entity_cross_references CASCADE;
DROP TABLE IF EXISTS entity_index CASCADE;
DROP TYPE IF EXISTS entity_cross_ref_relationship;
DROP TYPE IF EXISTS entity_lifecycle_stage;

COMMIT;
