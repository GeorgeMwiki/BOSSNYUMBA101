-- =============================================================================
-- Migration 0285 - intelligence_corpus_chunks (pgvector-backed brain memory).
--
-- Ported from Borjie 0003_mining_domain (intelligence corpus section).
--
-- Companion to:
--   - packages/database/src/schemas/intelligence-corpus.schema.ts
--   - services/api-gateway/src/services/brain-ingestion/persistence.ts
--   - services/api-gateway/src/services/knowledge-graph/grower.ts
--
-- Wave: COMPANY-BRAIN (C-1).
--
-- Holds chunked + embedded text of every primary-source document
-- BossNyumba ships: TZ rental code, tenancy regulations, real-estate
-- reference material, plus tenant-uploaded documents.
--
--   tenant_id IS NULL ⇒ global BossNyumba corpus (RLS allows SELECT
--                       for every tenant).
--   tenant_id IS NOT NULL ⇒ that tenant's private chunks.
--
-- MEMORY DURABILITY: no DELETE policy. supersededById points to the
-- newer chunk that replaced this one so the brain can time-travel.
--
-- Tenant scope: tenant_id = current_setting('app.current_tenant_id', true)
--               OR tenant_id IS NULL
-- RLS: FORCE-enabled.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '0285: pgvector unavailable: %', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS intelligence_corpus_chunks (
  id                text          PRIMARY KEY,
  tenant_id         text,
  source_file       text          NOT NULL,
  section           text,
  page              integer,
  text              text          NOT NULL,
  embedding         vector(1024),
  url               text,
  language          text          NOT NULL DEFAULT 'en',
  metadata          jsonb         NOT NULL DEFAULT '{}'::jsonb,
  ingested_at       timestamptz   NOT NULL DEFAULT now(),
  superseded_by_id  text
);

CREATE INDEX IF NOT EXISTS intelligence_corpus_chunks_tenant_idx
  ON intelligence_corpus_chunks(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS intelligence_corpus_chunks_source_section_uniq
  ON intelligence_corpus_chunks(source_file, section);

CREATE INDEX IF NOT EXISTS intelligence_corpus_chunks_lang_idx
  ON intelligence_corpus_chunks(language);

CREATE INDEX IF NOT EXISTS intelligence_corpus_chunks_superseded_idx
  ON intelligence_corpus_chunks(superseded_by_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS intelligence_corpus_chunks_embedding_ivfflat
             ON intelligence_corpus_chunks
             USING ivfflat (embedding vector_cosine_ops)
             WITH (lists = 100)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '0285: ivfflat index build deferred: %', SQLERRM;
END $$;

ALTER TABLE intelligence_corpus_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_corpus_chunks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'intelligence_corpus_chunks'
       AND policyname = 'intelligence_corpus_chunks_tenant_iso'
  ) THEN
    CREATE POLICY intelligence_corpus_chunks_tenant_iso ON intelligence_corpus_chunks
      USING (
        tenant_id IS NULL
        OR tenant_id = current_setting('app.current_tenant_id', true)
      )
      WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)
      );
  END IF;
END $$;

COMMIT;
