-- =============================================================================
-- Migration 0324 — stripe_payment_intent_unique: DB backstop against a
-- double-credited rent payment on at-least-once webhook redelivery.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The rent-payment booking (services/payments-ledger
-- payment-orchestration.service.ts `bookPaymentToLedger`) posts a balanced
-- journal tagged with the originating `payment_intent_id`. The application
-- guards against double-credit two ways:
--   1. webhook idempotency claim (Redis/PG) keyed by tenant+provider+event,
--   2. an application-level `findEntriesByPaymentIntent` check-then-act, and
--      a per-payment `idempotencyKey: payment:<intent>` on the post.
-- But (2) is a NON-ATOMIC check-then-act, and `ledger_entries_payment_intent_idx`
-- (migration 0001c) is a NON-unique index. Two concurrent Stripe
-- `payment_intent.succeeded` redeliveries (distinct replicas, claim store
-- briefly unavailable, or a key released for retry mid-race) can both pass the
-- check and post a SECOND rent-payment journal for the same intent —
-- double-crediting holding.
--
-- This migration adds the DB-level last line of defence: a PARTIAL UNIQUE index
-- on the rent-payment cash leg `(tenant_id, payment_intent_id)`. The second
-- concurrent post fails the unique constraint and the transaction rolls back, so
-- a redelivery can NEVER book a second rent-payment cash receipt for one intent,
-- regardless of what the application-level guard does.
--
-- WHY PARTIAL + WHY THE RENT_PAYMENT/DEBIT LEG ONLY
-- -------------------------------------------------
--   * `payment_intent_id` is NULL for non-payment journals (rent charges,
--     disbursements, adjustments) — the `WHERE payment_intent_id IS NOT NULL`
--     predicate excludes those so the index only governs payment receipts.
--   * A single rent-payment journal contains MULTIPLE legs that share the same
--     `payment_intent_id` (DEBIT holding + CREDIT customer-liability, and, with
--     the fee split, the two PLATFORM_FEE legs). A unique index on
--     (tenant_id, payment_intent_id) over ALL of them would reject the 2nd leg of
--     the FIRST (legitimate) journal. We therefore scope the uniqueness to the
--     ONE canonical leg every rent-payment journal posts exactly once: the
--     RENT_PAYMENT / DEBIT cash-into-holding leg. That leg is 1-per-intent, so it
--     is the correct grain for "this intent has already been booked".
--
-- HARD RULES HONOURED
-- -------------------
--   * Money invariant: this is a uniqueness CONSTRAINT only — it adds no money
--     columns and rewrites no balances. It strengthens the immutable
--     double-entry ledger against duplicate receipts.
--   * IDEMPOTENT / FORWARD-ONLY: CREATE UNIQUE INDEX IF NOT EXISTS. Safe to
--     re-run. Append-only per CLAUDE.md "Migrations are immutable".
--   * NOT CONCURRENTLY: this runs inside the migration's transaction (the runner
--     wraps each file). On a populated table with pre-existing duplicates the
--     build would fail LOUD — which is the desired signal (a pre-existing
--     double-credit must be reconciled before the guard can be installed),
--     rather than silently skipping rows.
-- =============================================================================

BEGIN;

-- Partial unique index: at most ONE RENT_PAYMENT/DEBIT (cash-into-holding) leg
-- per (tenant, payment_intent). A concurrent webhook redelivery that tries to
-- post a second rent-payment journal for the same intent violates this and the
-- post transaction rolls back — the DB backstop behind the app-level idempotency
-- claim + per-payment journal idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_intent_rent_debit_uniq
  ON ledger_entries (tenant_id, payment_intent_id)
  WHERE payment_intent_id IS NOT NULL
    AND type = 'RENT_PAYMENT'
    AND direction = 'DEBIT';

COMMENT ON INDEX ledger_entries_payment_intent_rent_debit_uniq IS
  'DB backstop (migration 0324) against double-credited rent payments on '
  'at-least-once webhook redelivery: at most one RENT_PAYMENT/DEBIT '
  'cash-into-holding leg per (tenant_id, payment_intent_id). Partial '
  '(payment_intent_id IS NOT NULL) so only payment receipts are governed; '
  'scoped to the single 1-per-intent leg so it never rejects the other legs of '
  'the same legitimate journal.';

COMMIT;
