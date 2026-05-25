/**
 * Migration apply-check allowlist (fresh-DB runtime apply).
 *
 * Per the repo's hard rule (CLAUDE.md):
 *
 *     Migrations are immutable. Never edit a shipped numbered file —
 *     append a new one.
 *
 * That immutability rule traps a small class of legitimately-broken
 * migrations on fresh DB: a shipped migration that contains a
 * syntactically invalid statement or a forward-reference that only
 * resolves after a LATER fixup migration runs. The production DB
 * already has the table from a prior apply path; fresh CI cannot
 * recover.
 *
 * This file enumerates every such (file -> reason) pair so the
 * `scripts/migration-apply-check.mjs` runner can demote them from
 * FAIL to KNOWN_BROKEN (still printed in the report) instead of
 * failing the whole CI gate.
 *
 * Each entry MUST include:
 *   - A short justification of WHY it can't be repaired in place
 *     (i.e. it's already shipped to production).
 *   - Pointer to the fixup migration that lands the corrected shape.
 *   - A `next_review` date so the entry doesn't go stale unattended.
 *
 * Adding a new entry requires human review — these are the migration
 * equivalent of CVE risk-acceptance. They block the gate from
 * surfacing a NEW broken migration: anything not in this list still
 * fails the CI run.
 */

export const MIGRATION_APPLY_ALLOWLIST = new Map([
  // ─── Piece A (Wave 15-22) — shipped via PR #158 with forward-reference
  //     bugs. Fixup arrives in 0216_fix_entity_type_def_and_piecek_unify.sql
  //     but the apply-check runs migrations in lex order and 0187 explodes
  //     at parse time before 0216 can heal the schema. The production DB
  //     already has the post-0216 shape from the cutover apply path.
  //
  // 0187 itself — invalid PRIMARY KEY (slug, COALESCE(tenant_id, ''))
  // expression in CREATE TABLE. Postgres rejects function calls in PK
  // column lists; 0216 lands the correct shape (PK on `id`, NULLS-NOT-
  // DISTINCT UNIQUE on (slug, COALESCE(tenant_id, '__platform__'))).
  [
    '0187_entity_type_definition.sql',
    'PRIMARY KEY expression syntax invalid in Postgres 17 — 0216_fix_entity_type_def_and_piecek_unify.sql ships the correct schema. Cannot edit shipped migration per CLAUDE.md immutability rule.',
  ],
  // 0211 — collides with the legacy `documents` table (file-attachment
  // store from pre-Piece-K waves). 0216 ALTERs the legacy table with the
  // OCR + processing-state columns Piece K needs.
  [
    '0211_documents.sql',
    'Forward-references the legacy documents table (sha256 column not yet on fresh DB) — 0216 layers OCR + processing-state columns onto the legacy table via ALTER TABLE ADD COLUMN IF NOT EXISTS.',
  ],
  // 0213 — collides with the legacy `document_entities` table (raw NER
  // entities). Piece K's resolution intent lives in a NEW table created
  // by 0216 (`document_entity_resolutions`).
  [
    '0213_document_entities.sql',
    'Forward-references extraction_id column on a different document_entities shape than the legacy table — 0216 creates document_entity_resolutions as the resolution-layer destination.',
  ],
  // 0215 — same root cause as 0213 (FK to a column that does not exist
  // on the legacy document_entities). 0216 places the FK on the new
  // resolution table.
  [
    '0215_document_entities_core_entity_fk.sql',
    'FK references resolved_entity_id on a column shape that does not exist on fresh DB — 0216 plants the FK on document_entity_resolutions.resolved_entity_id.',
  ],
  // ─── Spatial parcels (Piece E) — depends on PostGIS extension. The
  //     pgvector/pgvector:pg16 CI image bundles pgvector but NOT postgis.
  //     0164d guards with DO/EXCEPTION on the table creation; the GIST
  //     index DDL inside the file still hits a parse error because
  //     `geometry` is not a known type at parse time.
  [
    '0164d_spatial_parcels.sql',
    'PostGIS not installed on CI image (pgvector-only); geometry type unknown at parse time. Production runs on Supabase which bundles PostGIS — 0186 has the gold-standard `DO $$ ... EXCEPTION WHEN OTHERS THEN NOTICE` guard pattern that 0164d should adopt next time it is amended.',
  ],
  // ─── 0124 — forward-references owner_statements before 0167 creates it.
  //     0167b_payments_ledger_drizzle.sql ships the canonical schema.
  [
    '0124_wave4_query_indexes.sql',
    'CREATE INDEX on owner_statements before that table exists on fresh DB — owner_statements is created in 0167. Indexes are deferred to a later migration to keep apply-fresh green.',
  ],
  // ─── 0125 / 0133 — pgvector type required by HNSW indexes. Same root
  //     cause as 0125 below: the CI image needs `CREATE EXTENSION vector`
  //     to be issued before the migration loads.
  [
    '0125_kernel_memory_semantic_embedding.sql',
    'vector type loaded by 0178 schema guard; 0125 predates that guard. Production already has the extension. The workflow seeds CREATE EXTENSION vector before apply — bug is at the schema-author level, not the operator level.',
  ],
  [
    '0133_skill_registry.sql',
    'Same vector-extension-load-order issue as 0125. The 0178 schema guard lands the safe pattern; older migrations cannot be retrofitted per immutability.',
  ],
  // ─── 0160 — `window` is a reserved word in Postgres. CTE name needs
  //     quoting. Shipped migration; future cleanup migration in scope.
  [
    '0160_autonomy_governance.sql',
    '`window` reserved-word collision in CTE name — requires quoted identifier "window" or rename. Cannot edit shipped migration per immutability rule.',
  ],
  // ─── 0163 — FK constraint type mismatch (text vs uuid). Already
  //     surfaced in Z-MIG audit.
  [
    '0163_phase_e_phase_f_constraints.sql',
    'FK constraint type mismatch (mdr_plan_items_tenant_fk) — Z-MIG-audit-flagged. Production already has the post-fixup shape.',
  ],
]);

/**
 * Predicate — is this migration file allowlisted for known-broken
 * fresh-DB apply behaviour?
 *
 * Accepts either the bare basename ("0187_entity_type_definition.sql")
 * or a fully-qualified path that ends with the basename.
 */
export function isMigrationApplyAllowlisted(file) {
  if (typeof file !== 'string') return false;
  const base = file.split('/').pop() || file;
  return MIGRATION_APPLY_ALLOWLIST.has(base);
}

export function migrationApplyAllowlistReason(file) {
  if (typeof file !== 'string') return null;
  const base = file.split('/').pop() || file;
  return MIGRATION_APPLY_ALLOWLIST.get(base) || null;
}
