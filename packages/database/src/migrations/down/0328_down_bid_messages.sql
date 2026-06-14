-- =============================================================================
-- Down-migration 0328 — reverse bid_messages.
--
-- Dev/staging only. Dropping this table removes the per-bid negotiation thread
-- store. The fail-safe consequence is benign: with no table the gateway tenders
-- router's message send/list paths surface a clean DB error mapped to a 5xx,
-- and the bid loop reverts to placement + accept/withdraw only (the bid rows
-- themselves in `bids` are untouched). NO money/ledger records live here —
-- LedgerService.post() owns the immutable double-entry ledger and never
-- depended on this table. DATA LOSS: discards every message exchanged on every
-- bid thread.
--
-- Reverses migration 0328_bid_messages.sql. Idempotent: every drop is guarded
-- with IF EXISTS so re-running on an already-reversed DB is a no-op.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_bid_messages        ON bid_messages;
DROP POLICY IF EXISTS bid_messages_service_role_bypass      ON bid_messages;

DROP TRIGGER IF EXISTS bid_messages_no_update ON bid_messages;

DROP INDEX IF EXISTS bid_messages_tenant_bid_idx;
DROP INDEX IF EXISTS bid_messages_tender_idx;

DROP TABLE IF EXISTS bid_messages;

DROP FUNCTION IF EXISTS bid_messages_immutable();

DO $$ BEGIN
  DROP TYPE IF EXISTS bid_message_sender;
EXCEPTION WHEN dependent_objects_still_exist THEN null; END $$;

COMMIT;
