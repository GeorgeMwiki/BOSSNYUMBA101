-- ============================================================================
-- Migration 0325 — kernel_cot_reservoir consolidation cursor columns.
--
-- WHY
-- ───
-- `services/consolidation-worker/src/index.ts` (createReservoirSource) has,
-- since it shipped, queried two columns on `kernel_cot_reservoir` that
-- migration 0114_kernel_substrate.sql never created:
--
--   • `consolidated_at` — the worker's idempotency cursor. Rows are picked
--     up only where `consolidated_at IS NULL`, and stamped with NOW() after
--     the semantic write succeeds (consolidation.ts:24-28).
--   • `user_id`        — the (tenant_id, user_id) grouping key the worker
--     buckets reservoir rows by before emitting one semantic fact per group.
--
-- Because those columns were absent, every hourly tick (live, replicas:1)
-- raised `column "consolidated_at" does not exist`, which the adapter caught
-- and returned as `[]` — so CoT→semantic-memory consolidation was a PERMANENT
-- SILENT no-op. This migration adds the columns the worker codes against so
-- the query resolves, AND companion fix services/consolidation-worker stops
-- swallowing a genuine query error as an empty queue.
--
-- TYPES
-- ─────
-- Both columns mirror what the adapter reads them as:
--   • user_id          TEXT  (index.ts asString(row.user_id) → string). No FK:
--     reservoir rows can outlive a user row and the worker treats user_id as an
--     opaque grouping key, never an access boundary (tenant_id is the RLS key).
--   • consolidated_at  TIMESTAMPTZ NULL  (NULL = not yet consolidated; the
--     worker's only cursor predicate is `IS NULL`).
--
-- IDEMPOTENT: every statement is ADD COLUMN IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS, so re-applying over a DB that already has the columns is a
-- clean no-op (safe under both `psql -f` and the run-migrations sql.begin()
-- wrapper). RLS on kernel_cot_reservoir is unaffected — no policy touched.
-- ============================================================================

ALTER TABLE kernel_cot_reservoir
  ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE kernel_cot_reservoir
  ADD COLUMN IF NOT EXISTS consolidated_at TIMESTAMPTZ;

-- Partial index serving the consolidation fetch query
-- (index.ts:86-93): WHERE consolidated_at IS NULL AND captured_at >= $since
-- AND user_id IS NOT NULL ORDER BY captured_at DESC. Indexing only the
-- unconsolidated, attributable rows keeps it tiny — consolidated rows (the
-- vast majority over time) never enter the index.
CREATE INDEX IF NOT EXISTS idx_kernel_cot_unconsolidated
  ON kernel_cot_reservoir (captured_at DESC)
  WHERE consolidated_at IS NULL AND user_id IS NOT NULL;

COMMENT ON COLUMN kernel_cot_reservoir.user_id IS
  'Opaque per-user grouping key for memory consolidation (consolidation-worker buckets reservoir rows by (tenant_id, user_id)). Not an access boundary — tenant_id is the RLS key. Added by 0325; backfilled NULL for pre-0325 rows, which the consolidation query skips via `user_id IS NOT NULL`.';

COMMENT ON COLUMN kernel_cot_reservoir.consolidated_at IS
  'Idempotency cursor for the memory-consolidation worker. NULL = not yet consolidated (eligible for pickup); stamped NOW() after the semantic-memory write for the row''s group succeeds. Added by 0325.';
