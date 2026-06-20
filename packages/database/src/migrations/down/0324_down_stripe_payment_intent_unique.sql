-- =============================================================================
-- Down-migration 0324 — reverse stripe_payment_intent_unique.
--
-- Dev/staging only. Dropping this index removes the DB-level last line of
-- defence against a double-credited rent payment on at-least-once webhook
-- redelivery. The fail-safe consequence: the application still guards via the
-- webhook idempotency claim and the per-payment journal idempotency key
-- (`payment:<intent>`), but a concurrent-redelivery race that defeats BOTH
-- application guards would no longer be caught by the database — re-opening the
-- double-credit window. NO data is lost (an index drop discards no rows). Restore
-- by re-applying 0324. Dev/staging rollback only.
--
-- Reverses migration 0324_stripe_payment_intent_unique.sql.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS ledger_entries_payment_intent_rent_debit_uniq;

COMMIT;
