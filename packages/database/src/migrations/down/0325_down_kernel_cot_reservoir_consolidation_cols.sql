-- ============================================================================
-- Down-migration 0325 — reverse kernel_cot_reservoir consolidation columns.
--
-- Dev/staging only. Dropping `consolidated_at` and `user_id` returns
-- kernel_cot_reservoir to its pre-0325 shape. The fail-safe consequence: the
-- consolidation-worker's fetch query (`WHERE consolidated_at IS NULL ...
-- user_id IS NOT NULL`) again references columns that do not exist, so the
-- worker can no longer consolidate CoT into semantic memory. After the
-- companion code fix it will SURFACE that as a fetch error + staff alert
-- (no longer a silent no-op), so the drift is loud, not hidden.
--
-- DATA LOSS: discards the per-row consolidation cursor — every reservoir row
-- reverts to "looks unconsolidated", so a re-applied 0325 would re-consolidate
-- already-consolidated turns. Semantic upserts are idempotent on
-- (tenant_id, user_id, key), so the only cost is redundant re-work, never
-- corruption. Also discards any user_id attribution captured since 0325.
-- No money/ledger/licence records live here. NO RLS policy is touched.
--
-- Reverses migration 0325_kernel_cot_reservoir_consolidation_cols.sql.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_kernel_cot_unconsolidated;

ALTER TABLE kernel_cot_reservoir
  DROP COLUMN IF EXISTS consolidated_at;

ALTER TABLE kernel_cot_reservoir
  DROP COLUMN IF EXISTS user_id;

COMMIT;
