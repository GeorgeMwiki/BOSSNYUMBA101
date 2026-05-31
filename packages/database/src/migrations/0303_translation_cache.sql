-- =============================================================================
-- Migration 0303 - Translation Cache (shared per-tenant key/value)
--
-- Mirrors Borjie's migration 0155. Companion to `@bossnyumba/translation`
-- facade (`packages/translation/src/drizzle-cache.ts`). Keys lookups on
-- (tenantId, sourceText, sourceLang, targetLang, register, surface);
-- materialised as a SHA-256 `content_hash`. Repeated translations
-- short-circuit at the cache before hitting Claude.
--
-- Append-only / forward-only / IMMUTABLE.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS translation_cache (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash    text        NOT NULL,
  tenant_id       text,                                       -- nullable for platform-wide entries
  source_lang     text        NOT NULL,
  target_lang     text        NOT NULL,
  register        text        NOT NULL,
  surface         text        NOT NULL,
  source_text     text        NOT NULL,
  target_text     text        NOT NULL,
  provider        text        NOT NULL,
  glossary_version text       NOT NULL DEFAULT 'v1',
  hits            integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_translation_cache_content
  ON translation_cache (content_hash);

CREATE INDEX IF NOT EXISTS idx_translation_cache_last_used
  ON translation_cache (last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_translation_cache_lang_pair
  ON translation_cache (source_lang, target_lang);

ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_cache FORCE ROW LEVEL SECURITY;

CREATE POLICY translation_cache_read_all
  ON translation_cache
  FOR SELECT
  USING (true);

CREATE POLICY translation_cache_insert
  ON translation_cache
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY translation_cache_update
  ON translation_cache
  FOR UPDATE
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

COMMIT;
