-- =============================================================================
-- Migration 0328 — bid_messages: the per-bid negotiation thread the tenant
-- bid loop (#8) reads/writes through the gateway tenders router.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The marketplace bid table (0018d_marketplace.sql) records the bid itself and
-- a render-only `negotiation_turns` JSONB blob, but there was NO append-only,
-- queryable, tenant-isolated message store an APPLICANT and the OWNER could
-- exchange free-text on a specific bid. The tenant-mobile client
-- (apps/tenant-mobile/src/api/marketplace.ts) calls
-- POST /api/v1/tenders/:id/bids/:bidId/messages + GET .../messages — those
-- handlers had no backing table, so every send/list 404'd or no-op'd.
--
-- This table is that store: one row per message on a bid thread, tenant-scoped,
-- keyed by `bid_id` (+ denormalised `tender_id` for the hot list path). The
-- author side is `sender` ('applicant' | 'owner') so the client can render the
-- left/right bubble without a join back to identity. Messages are append-only
-- (a sent message is immutable; UPDATE/DELETE are blocked by trigger) — the
-- thread is an audit-grade record of the negotiation.
--
-- ONE TABLE
--   * bid_messages — one row per message. FK to bids(id) ON DELETE CASCADE so a
--     withdrawn/purged bid takes its thread with it. NO money path here:
--     LedgerService.post() owns the immutable double-entry ledger; a bid message
--     is application chatter, never an accounting entry.
--
-- TENANT SCOPE (CLAUDE.md hard rule): tenant-scoped (`tenant_id` TEXT, FK to
-- tenants). FORCE-enables RLS with a `tenant_isolation_bid_messages` policy on
-- the canonical `app.current_tenant_id` GUC (bare compare, no cast; NEVER the
-- legacy `app.tenant_id`) plus a `bid_messages_service_role_bypass` policy,
-- mirroring 0316/0317/0320 exactly. A TENANT can NEVER read ANOTHER tenant's
-- bid thread; the gateway additionally enforces APPLICANT-scoping (uniform-404
-- anti-IDOR) so one applicant cannot read another applicant's thread within the
-- same tenant.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
-- CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
-- anon REVOKE. On a fully-migrated DB this is a pure no-op. Every NOT NULL sits
-- in the CREATE TABLE (or has a DEFAULT) so there is no backfill hazard and the
-- NOT-NULL safety validator passes.
--
-- Companion files:
--   * services/api-gateway/src/routes/tenders.hono.ts (messages handlers)
--   * packages/database/src/migrations/down/0328_down_bid_messages.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- bid_message_sender — who authored a message on a bid thread. 'applicant' is
-- the bidder (resolved from the JWT → bids.vendor_id); 'owner' is the tender
-- owner side.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE bid_message_sender AS ENUM ('applicant', 'owner');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- -----------------------------------------------------------------------------
-- bid_messages — append-only per-bid negotiation thread.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bid_messages (
  id                 uuid               NOT NULL DEFAULT gen_random_uuid(),
  -- RLS isolation key (the owning tenant).
  tenant_id          text               NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- The bid this message belongs to. CASCADE: the thread dies with the bid.
  bid_id             text               NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  -- Denormalised parent tender (hot filter without a join to bids).
  tender_id          text               NOT NULL,
  -- Author side, so the client renders the bubble without an identity join.
  sender             bid_message_sender NOT NULL,
  -- The authenticated user who authored the message (audit / actor).
  sender_user_id     text               NOT NULL,
  -- Free-text body. Length is also bounded by the gateway zod validator.
  body               text               NOT NULL,
  created_at         timestamptz        NOT NULL DEFAULT now(),
  CONSTRAINT bid_messages_pkey PRIMARY KEY (id)
);

-- Hot read path: list a bid's thread within a tenant, oldest-first.
CREATE INDEX IF NOT EXISTS bid_messages_tenant_bid_idx
  ON bid_messages (tenant_id, bid_id, created_at);
-- Secondary: messages across a tender (owner-side overview).
CREATE INDEX IF NOT EXISTS bid_messages_tender_idx
  ON bid_messages (tenant_id, tender_id);

-- -----------------------------------------------------------------------------
-- Append-only guard: a sent message is immutable. Reject UPDATE/DELETE at the
-- row level (CASCADE deletes from a parent bid drop happen via FK, not this
-- trigger path — FK CASCADE bypasses row triggers on the child only for the
-- referential action, which is intended for cleanup).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bid_messages_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bid_messages is append-only; % blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER bid_messages_no_update
    BEFORE UPDATE ON bid_messages
    FOR EACH ROW EXECUTE FUNCTION bid_messages_immutable();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- -----------------------------------------------------------------------------
-- RLS — tenant isolation on the canonical GUC + service-role bypass + guarded
-- anon REVOKE. Mirrors the 0316/0317/0320 shape so the audit-rls-coverage
-- scanner counts this table as covered (policy name `tenant_isolation_<table>`
-- and the `tenant_tables` loop variable are the scanner's recognised shapes).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'bid_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = tbl
         AND policyname = 'tenant_isolation_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL '
        || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)) '
        || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true));',
        'tenant_isolation_' || tbl, tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = tbl
         AND policyname = tbl || '_service_role_bypass'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL '
        || 'USING (current_setting(''app.is_service_role'', true) = ''true'') '
        || 'WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');',
        tbl || '_service_role_bypass', tbl
      );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END $$;

COMMIT;
