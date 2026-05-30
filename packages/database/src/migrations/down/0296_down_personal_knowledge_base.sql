-- =============================================================================
-- DOWN 0296 — Drop federated Personal Knowledge Base tables.
--
-- DATA-LOSS reversal. Dev/staging only. Per CLAUDE.md "Migrations are
-- immutable", production never runs --down on tables with persisted
-- personal data; instead a separate redaction migration would scrub
-- rows row-by-row through the GDPR right-to-be-forgotten pipeline.
--
-- Drop order is reverse of create order. CASCADE on `persons` cleans
-- both child tables in one statement, but we drop explicitly first so
-- the operator sees three lines in `\dt-` output instead of one.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS personal_memory_cells;
DROP TABLE IF EXISTS person_links;
DROP TABLE IF EXISTS persons;

COMMIT;
