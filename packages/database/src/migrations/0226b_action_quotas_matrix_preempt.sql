-- =============================================================================
-- 0226b: Pre-empt `0227_action_quotas.sql` and
--        `0228_approval_matrix_dsl_compiled.sql`, both UNPARSEABLE.
--
-- ORDERING + UNPARSEABLE-FILE FIX (fresh-DB blocker). Defers entirely to
-- the shipped fix-forward `0240_fix_piecee_action_quotas_and_matrix.sql`.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- Both files repeat the illegal expression-in-key idiom that broke 0187:
--
--   0227: PRIMARY KEY (tenant_id, COALESCE(persona_id, ''), period_date)
--   0228: PRIMARY KEY (..., COALESCE(tenant_id, ''), ...)
--
-- PostgreSQL forbids function calls in a PRIMARY KEY / UNIQUE column list
-- (legal only inside a UNIQUE INDEX expression), so each statement fails
-- to PARSE with `syntax error at or near "("` (SQLSTATE 42601). As a
-- parse-time error inside immutable files, neither can be sidestepped by
-- pre-creating the table.
--
-- The repo SHIPS `0240_fix_piecee_action_quotas_and_matrix.sql` as the
-- forward-fix. Unlike 0216, 0240 does NOT use `CREATE TABLE IF NOT
-- EXISTS` — it explicitly:
--
--     DROP TABLE IF EXISTS action_quotas CASCADE;
--     DROP TABLE IF EXISTS approval_matrix_dsl_compiled CASCADE;
--     CREATE TABLE action_quotas (... id text PRIMARY KEY ...);
--     CREATE TABLE approval_matrix_dsl_compiled (... id text PRIMARY KEY ...);
--
-- and the recreated tables have a DIFFERENT, corrected column shape than
-- the broken 0227/0228 definitions. 0240 is therefore the sole authority
-- for these two tables and depends on NOTHING from 0227/0228 having run.
--
-- ─────────────────────────────────────────────────────────────────────
-- Fix strategy — pure skip
-- ─────────────────────────────────────────────────────────────────────
-- Because 0240 drops-and-recreates both tables from scratch, and NOTHING
-- between 0227/0228 and 0240 references either table (verified), the
-- correct minimal fix is simply to mark 0227 and 0228 as already-applied
-- so the runner skips their unparseable bodies. 0240 then builds both
-- tables correctly later. No table DDL is reproduced here — doing so would
-- be pointless since 0240 `DROP ... CASCADE`s it immediately.
--
-- On a real Supabase apply this branch runs first and 0240 still lands
-- afterwards exactly as designed; pre-skipping the two broken files only
-- removes parse failures that would otherwise abort the run.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety
-- ─────────────────────────────────────────────────────────────────────
-- Each ledger insert is NOT-EXISTS guarded, so this is a no-op on any DB
-- where the two migrations were already recorded. Safe to re-run.
-- =============================================================================

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0227_action_quotas', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = '0227_action_quotas'
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0228_approval_matrix_dsl_compiled', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = '0228_approval_matrix_dsl_compiled'
);
