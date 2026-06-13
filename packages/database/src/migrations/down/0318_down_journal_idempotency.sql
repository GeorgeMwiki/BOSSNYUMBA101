-- =============================================================================
-- Down-migration 0318 — reverse journal_idempotency (post-once ledger dedupe).
--
-- Dev/staging only. DROPPING journal_idempotency DESTROYS the per-journal
-- (tenant_id, idempotency_key) -> journal_id dedupe rows, so a subsequent
-- retried post under a previously-seen key would DOUBLE-POST money. dataLoss is
-- TRUE — this down must NEVER run in production; it is purely a dev/staging
-- reset hook.
--
-- The policy + RLS posture drop is implied by the table drop (CASCADE removes
-- the dependent policy), but we drop the policy explicitly first so a partial
-- failure leaves no orphaned policy.
--
-- Reverses migration 0318_journal_idempotency.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS journal_idempotency_tenant_isolation ON public.journal_idempotency;

DROP INDEX IF EXISTS journal_idempotency_journal_idx;

DROP TABLE IF EXISTS public.journal_idempotency;

COMMIT;
