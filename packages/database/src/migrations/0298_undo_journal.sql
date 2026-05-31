-- =============================================================================
-- Migration 0298 - Undo Journal (Wave SUPERPOWERS, ported from Borjie 0112)
--
-- Companion to:
--   - services/api-gateway/src/routes/owner/undo-journal.hono.ts
--   - services/api-gateway/src/routes/owner/superpowers.hono.ts (bulk + prefill)
--   - services/api-gateway/src/composition/brain-tools/superpowers-tools.ts
--   - packages/database/src/schemas/undo-journal.schema.ts
--
-- Persona: Mr. Mwikila — BossNyumba's chat-as-OS.
-- Brand:   BossNyumba (real-estate edition of Borjie's mining brain).
--
-- Generic, transient undo ledger. Every WRITE brain tool appends one
-- row here with before_state / after_state JSON snapshots so the owner
-- gets a 5-minute "Undo (4:58)" chip on every chat-initiated write.
-- The undo handler (route POST /api/v1/owner/undo-journal/undo-last)
-- marks the row undone; replaying before_state back into the source
-- entity is dispatched per-entity-owner so each domain supplies its own
-- reverse strategy.
--
-- IMPORTANT: this is NOT a replacement for the immutable AI audit
-- chain - it's a transient operational journal. The audit chain still
-- records the WRITE; this table records enough state to reverse it.
--
-- Real-estate action verbs differ from Borjie: action_kind ∈ {
--   create, update, delete,
--   mark_rent_paid, send_renewal_notice, close_ticket, export_tax_statement,
--   snooze, archive, acknowledge, complete, withdraw,
--   pin, unpin, share, revoke_share,
--   prefill, bulk_update
-- }.
--
-- Tenant-scoped via the canonical `app.current_tenant_id` GUC RLS
-- predicate. FORCE RLS enabled per CLAUDE.md hard rule.
--
-- Idempotent (IF NOT EXISTS + DO blocks). Append-only. Forward-only.
-- IMMUTABLE: per CLAUDE.md "Migrations are immutable" - never edit
-- this file after merge; append a new numbered file instead.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS undo_journal (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL,
  actor_id        text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       text        NOT NULL,
  action_kind     text        NOT NULL,
  tool_id         text,
  before_state    jsonb,
  after_state    jsonb,
  window_seconds  integer     NOT NULL DEFAULT 300,
  performed_at    timestamptz NOT NULL DEFAULT now(),
  undone_at       timestamptz,
  undone_by_id    text,
  undo_reason     text,
  provenance      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'undo_journal_action_chk'
  ) THEN
    ALTER TABLE undo_journal
      ADD CONSTRAINT undo_journal_action_chk
      CHECK (action_kind IN (
        'create', 'update', 'delete',
        'mark_rent_paid', 'send_renewal_notice', 'close_ticket',
        'export_tax_statement',
        'snooze', 'archive', 'acknowledge', 'complete', 'withdraw',
        'pin', 'unpin', 'share', 'revoke_share',
        'prefill', 'bulk_update'
      ));
  END IF;
END $$;

-- Hot path: "what can I undo right now?" - actor + recent + un-undone.
CREATE INDEX IF NOT EXISTS undo_journal_actor_recent_idx
  ON undo_journal (tenant_id, actor_id, performed_at DESC)
  WHERE undone_at IS NULL;

-- Hot path: entity-scoped undo (e.g. "undo my last action on this lease").
CREATE INDEX IF NOT EXISTS undo_journal_entity_recent_idx
  ON undo_journal (tenant_id, entity_type, entity_id, performed_at DESC)
  WHERE undone_at IS NULL;

-- Hot path: cron sweeper drops past-window rows from the active index.
CREATE INDEX IF NOT EXISTS undo_journal_window_idx
  ON undo_journal (tenant_id, performed_at)
  WHERE undone_at IS NULL;

ALTER TABLE undo_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE undo_journal FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'undo_journal'
       AND policyname = 'undo_journal_tenant_isolation'
  ) THEN
    CREATE POLICY undo_journal_tenant_isolation
      ON undo_journal
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
