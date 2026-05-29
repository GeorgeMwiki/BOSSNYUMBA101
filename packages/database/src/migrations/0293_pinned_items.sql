-- =============================================================================
-- Migration 0293 — Pinned Items (Wave SUPERPOWERS, ported from Borjie 0113/0133)
--
-- Companion to:
--   - packages/database/src/schemas/pinned-items.schema.ts
--   - services/api-gateway/src/routes/owner/pinned-items.hono.ts
--
-- Persona: Mr. Mwikila (founder, single source of authority).
-- Brand: BossNyumba.
--
-- One table backs the `bossnyumba.ui.bookmark` superpower so Mr. Mwikila
-- can pin a frequently-referenced entity (Westlands 3-bed lease,
-- April invoice, NCA inspection, ...) to the owner's quick-access strip
-- above the dashboard. After the third reference to the same entity in
-- chat, Mr. Mwikila proactively suggests "Should I pin this to your
-- strip?".
--
-- Surface:
--   pinned_items - one row per (owner_id, entity_type, entity_id).
--   `position` orders the strip; `pinned_at` is the recency tiebreak.
--   `folder_id` + `folder_label` group items into a collapsible section.
--
-- Tenant-scoped via the canonical `app.current_tenant_id` GUC RLS predicate.
-- Owner-id is the second isolation key so Mr. Mwikila never pins one
-- co-owner's items to another's strip even within the same tenant.
-- RLS FORCE-enabled per the BossNyumba hard rule (CLAUDE.md).
--
-- Idempotent (IF NOT EXISTS + DO blocks). Append-only. Forward-only.
-- IMMUTABLE: per CLAUDE.md "Migrations are immutable" — never edit
-- this file after merge; append a new numbered file instead.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pinned_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL,
  owner_id        text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       text        NOT NULL,
  label           text        NOT NULL,
  position        integer     NOT NULL DEFAULT 0,
  folder_id       uuid,
  folder_label    text,
  pinned_at       timestamptz NOT NULL DEFAULT now(),
  unpinned_at     timestamptz,
  provenance      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Soft-uniqueness: an owner pins each entity at most once. Re-pinning
-- after an unpin updates `unpinned_at` back to NULL and bumps position.
CREATE UNIQUE INDEX IF NOT EXISTS pinned_items_owner_entity_active_idx
  ON pinned_items (tenant_id, owner_id, entity_type, entity_id)
  WHERE unpinned_at IS NULL;

-- Hot path: rendering the strip in order.
CREATE INDEX IF NOT EXISTS pinned_items_owner_position_idx
  ON pinned_items (tenant_id, owner_id, position ASC, pinned_at DESC)
  WHERE unpinned_at IS NULL;

-- Owner-scoped folder listing index.
CREATE INDEX IF NOT EXISTS pinned_items_owner_folder_idx
  ON pinned_items (tenant_id, owner_id, folder_id, position)
  WHERE unpinned_at IS NULL;

ALTER TABLE pinned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_items FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'pinned_items'
       AND policyname = 'pinned_items_tenant_isolation'
  ) THEN
    CREATE POLICY pinned_items_tenant_isolation
      ON pinned_items
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
