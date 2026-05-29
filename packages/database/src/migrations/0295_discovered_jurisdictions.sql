-- =============================================================================
-- Migration 0295 — Discovered-jurisdiction cache (JC-3, real-estate edition).
--
-- Companion to:
--   - services/api-gateway/src/services/jurisdiction-discovery/
--   - services/api-gateway/src/composition/brain-tools/jurisdiction-discovery-tools.ts
--   - services/api-gateway/src/routes/internal/jurisdiction-discovery.hono.ts
--
-- Mr. Mwikila NEVER says "I don't know" about a country. When a
-- tenant or user asks about a jurisdiction not in our curated seed
-- (KE/TZ/UG/NG/ZA/AU/UK/US — the BossNyumba `jurisdiction-resolver`
-- SNAPSHOTS map), the discovery pipeline runs (web search + corpus
-- search + synthesis) and writes the resulting `JurisdictionProfile`
-- into this table so subsequent turns in the same conversation reuse
-- the same view without burning quota.
--
-- This is a GLOBAL CACHE — no tenant_id. The curated seed is the
-- code-level snapshot; this cache is its runtime counterpart.
-- Promotion from cache → curated seed is a separate four-eye admin
-- action (JC-7); the `promoted_to_seed_at` columns capture that
-- lifecycle.
--
-- RLS: every row is admin-only. The api-gateway sets
-- `app.is_bossnyumba_internal_admin = 'true'` when the discovery
-- worker writes during normal chat turns, so the cache fills
-- transparently. Public tenants never read directly — they go
-- through the brain tool which fronts the cached value.
--
-- Idempotent (IF NOT EXISTS + DO blocks). Forward-only. Append-only.
-- IMMUTABLE: per CLAUDE.md "Migrations are immutable" — never edit
-- this file after merge; append a new numbered file instead.
--
-- Ported from Borjie migration 0148 — only retailoring is the admin
-- GUC name (`is_borjie_internal_admin` → `is_bossnyumba_internal_admin`)
-- and the documentation comments. Schema is byte-equivalent.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS discovered_jurisdictions (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ISO-3166-1 alpha-2 country code. UPPERCASE.
  country_code             text          NOT NULL,
  -- English country name as returned by the normalizer.
  country_name             text          NOT NULL,
  -- Structured profile (regulators, currency, languages, legal framework, validity_score).
  profile                  jsonb         NOT NULL,
  -- Validity score in [0, 1].
  confidence_score         numeric(3, 2) NOT NULL,
  -- Citation sources (web hits + corpus hits + fallback markers).
  sources                  jsonb         NOT NULL DEFAULT '[]'::jsonb,
  discovered_at            timestamptz   NOT NULL DEFAULT now(),
  -- Short TTL — 24h. Beyond that the discovery pipeline runs again.
  cached_until             timestamptz   NOT NULL DEFAULT now() + INTERVAL '24 hours',
  -- Set when an internal admin promotes the row into the curated seed.
  promoted_to_seed_at      timestamptz,
  -- Promoter (Supabase user id). Foreign-key to `users` for audit.
  promoted_by_admin_id     text REFERENCES users(id),
  CONSTRAINT discovered_jurisdictions_confidence_chk
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT discovered_jurisdictions_country_code_chk
    CHECK (length(country_code) BETWEEN 2 AND 3)
);

-- Unique per country — discovery results are upserted on conflict.
CREATE UNIQUE INDEX IF NOT EXISTS discovered_jurisdictions_country_uniq
  ON discovered_jurisdictions (country_code);

-- Hot-path lookup index — un-promoted cache rows we still treat as
-- "fresh enough" (cached_until check happens in the application layer,
-- this index simply narrows the scan).
CREATE INDEX IF NOT EXISTS discovered_jurisdictions_unpromoted_idx
  ON discovered_jurisdictions (country_code)
  WHERE promoted_to_seed_at IS NULL;

-- Internal-admin RLS: only BossNyumba internal admins read/write.
-- Discovery worker is invoked under that GUC. Cache reads from chat
-- tools route through an admin-elevated loopback hop.
ALTER TABLE discovered_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_jurisdictions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'discovered_jurisdictions'
       AND policyname = 'dj_admin_only'
  ) THEN
    CREATE POLICY dj_admin_only
      ON discovered_jurisdictions
      FOR ALL
      USING (current_setting('app.is_bossnyumba_internal_admin', true) = 'true')
      WITH CHECK (current_setting('app.is_bossnyumba_internal_admin', true) = 'true');
  END IF;
END
$$;

COMMIT;
