-- =============================================================================
-- Migration 0342 — bid_messages: add the missing BEFORE DELETE immutability
-- trigger so the append-only / audit-grade guarantee is FULLY enforced.
--
-- WHY THIS MIGRATION EXISTS (Mode-C R2 — L10)
-- -------------------------------------------
-- 0328_bid_messages.sql documents the thread as append-only and audit-grade:
--   * 0328:19  "Messages are append-only (... UPDATE/DELETE are blocked by
--               trigger) — the thread is an audit-grade record of the
--               negotiation."
--   * 0328:88  "Append-only guard: a sent message is immutable. Reject
--               UPDATE/DELETE at the row level ..."
-- But 0328 only installed `bid_messages_no_update` (BEFORE UPDATE). There was
-- NO BEFORE DELETE trigger — so a tenant could DELETE negotiation messages
-- despite the documented immutability guarantee. The guard was HALF-enforced:
-- the audit record could be rewritten by deletion.
--
-- The sibling negotiation_turns table (0017e_negotiation.sql) is the correct
-- reference shape — it installs BOTH `negotiation_turns_no_update` AND
-- `negotiation_turns_no_delete`, each FOR EACH ROW EXECUTE FUNCTION the SAME
-- generic immutability function (which RAISEs on TG_OP). bid_messages should
-- match that both-triggers shape.
--
-- FIX
-- ---
-- Add `bid_messages_no_delete` (BEFORE DELETE ... FOR EACH ROW) reusing the
-- existing `bid_messages_immutable()` function from 0328. That function is
-- already generic — it RAISEs `'bid_messages is append-only; % blocked'`
-- with TG_OP — so it correctly reports DELETE just as it reports UPDATE; no
-- new function is needed. We CREATE OR REPLACE it here (identical body) only
-- so this migration is self-contained and idempotent even if applied against
-- a DB where 0328 somehow predates the function (it will not change behaviour).
--
-- FK CASCADE NOTE: bid_messages.bid_id is `REFERENCES bids(id) ON DELETE
-- CASCADE` (0328:67). A referential-action CASCADE delete of the child does
-- NOT fire this row-level BEFORE DELETE trigger for the FK cleanup path —
-- which is the intended behaviour (a purged/withdrawn bid takes its thread
-- with it, exactly as 0328:90-91 documents). This trigger blocks DIRECT
-- DELETEs against bid_messages, the path the audit guarantee is about.
--
-- RLS / TENANT SCOPE (CLAUDE.md hard rule): UNCHANGED. bid_messages keeps its
-- FORCE RLS + tenant_isolation_bid_messages + service-role bypass from 0328;
-- this migration adds only a row-immutability trigger and touches no policy.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): CREATE OR REPLACE
-- FUNCTION + a DROP TRIGGER IF EXISTS / CREATE TRIGGER pair, inside one
-- transaction. On a fully-migrated DB this is a pure no-op (the trigger is
-- recreated identically); on a from-0328 DB it installs the missing trigger.
--
-- Companion files:
--   * packages/database/src/migrations/0328_bid_messages.sql (table + no_update)
--   * packages/database/src/migrations/0017e_negotiation.sql (both-triggers ref)
-- =============================================================================

BEGIN;

-- Reaffirm the generic immutability function (identical body to 0328) so this
-- migration is self-contained and idempotent. It RAISEs on whatever TG_OP
-- fires it, so it serves both the UPDATE and the DELETE trigger.
CREATE OR REPLACE FUNCTION bid_messages_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bid_messages is append-only; % blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

-- The missing BEFORE DELETE guard. Mirrors negotiation_turns_no_delete
-- (0017e_negotiation.sql:150-154). DROP IF EXISTS + CREATE so re-apply is a
-- clean no-op.
DROP TRIGGER IF EXISTS bid_messages_no_delete ON bid_messages;
CREATE TRIGGER bid_messages_no_delete
  BEFORE DELETE ON bid_messages
  FOR EACH ROW EXECUTE FUNCTION bid_messages_immutable();

COMMIT;
