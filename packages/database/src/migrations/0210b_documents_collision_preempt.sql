-- =============================================================================
-- 0210b: Pre-empt the Piece-K documents-collision migrations 0211 / 0213 /
--        0215, which fail against the LEGACY `documents` / `document_entities`
--        tables on a fresh DB.
--
-- ORDERING + TABLE-COLLISION FIX (fresh-DB blocker). Defers entirely to the
-- shipped fix-forward `0216_fix_entity_type_def_and_piecek_unify.sql`,
-- whose header (§2-4) documents exactly these three failures.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- Piece K (document analysis) was authored in an isolated worktree and
-- assumed it OWNED the `documents` and `document_entities` table names.
-- But both names were already taken by earlier waves:
--
--   * `documents`         — legacy file-attachment store from 0004
--                           (columns: name, original_name, file_path,
--                           checksum, … — NO `sha256`).
--   * `document_entities` — legacy NER raw-entity store from 0108
--                           (columns: entity_kind, entity_value, … — NO
--                           `resolved_entity_id` / `resolution_*`).
--
-- So on a fresh DB:
--
--   * 0211_documents.sql — its `CREATE TABLE IF NOT EXISTS documents`
--     no-ops (legacy table present), then
--     `CREATE UNIQUE INDEX … ON documents (tenant_id, sha256)` aborts with
--     `column "sha256" does not exist` (42703).
--
--   * 0213_document_entities.sql — its `CREATE TABLE IF NOT EXISTS
--     document_entities` no-ops (legacy present), then
--     `CREATE INDEX … ON document_entities (tenant_id, resolved_entity_id)`
--     aborts with `column "resolved_entity_id" does not exist` (42703).
--
--   * 0215_document_entities_core_entity_fk.sql — its guard checks the
--     table/constraint but NOT the column, so it enters the branch and
--     `ALTER TABLE document_entities ADD CONSTRAINT … FOREIGN KEY
--     (resolved_entity_id) …` aborts with the same 42703.
--
-- The repo SHIPS `0216_fix_entity_type_def_and_piecek_unify.sql` as the
-- forward-fix. Per its header it RESOLVES all three by:
--   §3  ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256 / filename /
--       processing_state / … and (re)creating the documents indexes; and
--   §4  introducing a NEW `document_entity_resolutions` table that
--       SUPERSEDES 0213/0215's resolution-layer design (which collided
--       with the legacy `document_entities` shape).
--
-- But 0216 sorts AFTER 0211/0213/0215, so on a fresh DB the run dies at
-- 0211 long before 0216 can heal anything.
--
-- ─────────────────────────────────────────────────────────────────────
-- Fix strategy — pure skip (0216 is the authority)
-- ─────────────────────────────────────────────────────────────────────
-- 0211's only durable contribution is INDEXES on the `documents` table —
-- and 0216 §3 re-creates exactly those after adding the columns. 0213/0215
-- are explicitly SUPERSEDED by 0216 §4's `document_entity_resolutions`.
-- The intervening migrations 0212 (document_extractions) and 0214
-- (document_routing) only FK to `documents(id)` (the PK, present in the
-- legacy table) and do NOT touch any new column, so they apply normally.
-- Nothing between 0211 and 0216, nor anything after 0216, depends on the
-- new `documents` columns or on 0213's `document_entities` shape
-- (verified).
--
-- Therefore the correct minimal fix is to mark 0211 / 0213 / 0215 as
-- already-applied so the runner skips their colliding bodies, and let 0216
-- deliver the corrected end-state. No table/column DDL is reproduced here.
--
-- On a real Supabase apply this branch runs first; 0216 still lands and
-- performs the ALTER + new table exactly as designed. Pre-skipping only
-- removes the collision failures that would otherwise abort the run.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety
-- ─────────────────────────────────────────────────────────────────────
-- Each ledger insert is NOT-EXISTS guarded → no-op on any DB where the
-- migrations were already recorded. Safe to re-run.
-- =============================================================================

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0211_documents', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '0211_documents'
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0213_document_entities', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '0213_document_entities'
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0215_document_entities_core_entity_fk', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '0215_document_entities_core_entity_fk'
);
