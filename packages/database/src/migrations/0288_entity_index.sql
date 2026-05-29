-- =============================================================================
-- Migration 0288 — Entity Index + Cross References (Wave ENTITY-LEGIBILITY)
--
-- Port of Borjie 0115 — real-estate retailored.
--
-- Two tables back the "entire org fully legible to AI" contract: every
-- entity in the system (properties, units, leases, tenants, applicants,
-- maintenance tickets, contractors, rent invoices, statements,
-- reminders, documents, ...) is indexed with a semantic embedding plus
-- a tag set, and every pair of related entities is captured as a typed
-- cross-reference so the brain can traverse the graph in one hop.
--
--   1. entity_index            — one row per (tenant_id, entity_kind,
--                                entity_id) carrying display_name,
--                                embedding (pgvector), tags, summary,
--                                lifecycle_stage, refreshed_at.
--   2. entity_cross_references — typed (source -> target) edges with a
--                                relationship enum + confidence + the
--                                derivation_source so the discoverer can
--                                rebuild the edge from joins.
--
-- Tenant-scoped via the canonical `app.current_tenant_id` GUC RLS
-- predicate. RLS FORCE-enabled per CLAUDE.md hard rule.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '0288: pgvector unavailable: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'entity_lifecycle_stage'
  ) THEN
    CREATE TYPE entity_lifecycle_stage AS ENUM (
      'draft', 'active', 'dormant', 'archived', 'deleted'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'entity_cross_ref_relationship'
  ) THEN
    CREATE TYPE entity_cross_ref_relationship AS ENUM (
      'parent', 'child', 'related', 'duplicate', 'depends_on', 'supersedes'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) entity_index
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_index (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL,
  entity_kind     text        NOT NULL,
  entity_id       text        NOT NULL,
  display_name    text        NOT NULL,
  embedding       vector(1536),
  tags            text[]      NOT NULL DEFAULT ARRAY[]::text[],
  summary         text        NOT NULL DEFAULT '',
  lifecycle_stage entity_lifecycle_stage NOT NULL DEFAULT 'active',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  refreshed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_index_natural_key_idx
  ON entity_index (tenant_id, entity_kind, entity_id);

CREATE INDEX IF NOT EXISTS entity_index_recent_idx
  ON entity_index (tenant_id, entity_kind, refreshed_at DESC);

CREATE INDEX IF NOT EXISTS entity_index_tags_gin_idx
  ON entity_index USING gin (tags);

CREATE INDEX IF NOT EXISTS entity_index_lifecycle_idx
  ON entity_index (tenant_id, lifecycle_stage)
  WHERE lifecycle_stage = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = current_schema()
       AND tablename = 'entity_index'
       AND indexname = 'entity_index_embedding_hnsw_idx'
  ) THEN
    EXECUTE 'CREATE INDEX entity_index_embedding_hnsw_idx
             ON entity_index
             USING hnsw (embedding vector_cosine_ops)
             WITH (m = 16, ef_construction = 64)
             WHERE embedding IS NOT NULL';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '0288: HNSW index build deferred (pgvector version may lack hnsw): %', SQLERRM;
END $$;

ALTER TABLE entity_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_index FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'entity_index'
       AND policyname = 'entity_index_tenant_isolation'
  ) THEN
    CREATE POLICY entity_index_tenant_isolation
      ON entity_index
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) entity_cross_references
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entity_cross_references (
  tenant_id           text        NOT NULL,
  source_kind         text        NOT NULL,
  source_id           text        NOT NULL,
  target_kind         text        NOT NULL,
  target_id           text        NOT NULL,
  relationship        entity_cross_ref_relationship NOT NULL,
  confidence          numeric(4,3) NOT NULL DEFAULT 1.000,
  derived_at          timestamptz NOT NULL DEFAULT now(),
  derivation_source   text        NOT NULL DEFAULT '',
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tenant_id, source_kind, source_id, target_kind, target_id, relationship)
);

CREATE INDEX IF NOT EXISTS entity_cross_references_forward_idx
  ON entity_cross_references (tenant_id, source_kind, source_id);

CREATE INDEX IF NOT EXISTS entity_cross_references_reverse_idx
  ON entity_cross_references (tenant_id, target_kind, target_id);

CREATE INDEX IF NOT EXISTS entity_cross_references_relationship_idx
  ON entity_cross_references (tenant_id, relationship, source_kind);

ALTER TABLE entity_cross_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_cross_references FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'entity_cross_references'
       AND policyname = 'entity_cross_references_tenant_isolation'
  ) THEN
    CREATE POLICY entity_cross_references_tenant_isolation
      ON entity_cross_references
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
