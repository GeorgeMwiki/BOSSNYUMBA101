BEGIN;
DROP INDEX IF EXISTS intelligence_corpus_chunks_embedding_ivfflat;
DROP INDEX IF EXISTS intelligence_corpus_chunks_superseded_idx;
DROP INDEX IF EXISTS intelligence_corpus_chunks_lang_idx;
DROP INDEX IF EXISTS intelligence_corpus_chunks_source_section_uniq;
DROP INDEX IF EXISTS intelligence_corpus_chunks_tenant_idx;
DROP TABLE IF EXISTS intelligence_corpus_chunks;
COMMIT;
