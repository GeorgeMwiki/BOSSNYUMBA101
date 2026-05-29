-- Down migration for 0280_corpus_doc_uploads. Idempotent.

BEGIN;

DROP TABLE IF EXISTS corpus_doc_summaries CASCADE;
DROP TABLE IF EXISTS corpus_doc_uploads CASCADE;

COMMIT;
