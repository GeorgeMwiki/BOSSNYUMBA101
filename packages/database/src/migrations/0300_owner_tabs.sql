-- =============================================================================
-- Migration 0300 - Owner Tabs (server-side tab persistence)
--
-- Closes the deliberate localStorage-only deferral acknowledged in
-- commit a935776e: "Server-side tab persistence deliberately NOT ported
-- - DB-side owner_tabs jsonb table doesn't exist in BN yet."
--
-- The BN owner-portal `useOwnerTabs` hook persisted state to
-- localStorage only. That blocked the universal-bar promise
-- ("no hardcoded fallbacks, no mock data, real superpowers") because
-- a landlord switching between their phone and laptop would lose every
-- spawned tab (lease drawer, maintenance case panel, tenant ledger,
-- rent forecast, etc.).
--
-- This table is the canonical per-(tenant, user) tab strip ledger. The
-- FE still hits localStorage first for instant hydration on cold load,
-- but the server is now the source of truth and every mutation
-- (spawn / augment / focus / close) is mirrored through the
-- /api/v1/owner/tabs route. Cross-device sync is achieved by replaying
-- the latest server snapshot on focus / app foreground.
--
-- Real-estate domain note: the jsonb `state` document holds tab
-- entries whose `context` scopes them to BN entity types
--   - lease           (lease drawer / ledger)
--   - unit            (unit operations panel)
--   - maintenance_case (case timeline + actions)
--   - tenant          (tenant 360 + activity)
--   - property        (portfolio-level view)
-- ... which are entirely distinct from Borjie's mining domain
-- (pml / ore-parcel / shift).
--
-- Companion files:
--   - packages/database/src/schemas/owner-tabs.schema.ts
--   - services/api-gateway/src/routes/owner/tabs.hono.ts
--   - apps/owner-portal/src/state/useOwnerTabs.ts (FE wiring)
--
-- Tenant scope via the canonical `app.current_tenant_id` GUC RLS
-- predicate. FORCE RLS per CLAUDE.md hard rule. Append-only / forward-
-- only / IMMUTABLE — never edit this file after merge.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS owner_tabs (
  tenant_id   text        NOT NULL,
  -- Supabase user id of the owner whose tab strip this row holds.
  user_id     text        NOT NULL,
  -- Free-form jsonb. The FE owns the shape; the server treats it as
  -- an opaque document so the FE can iterate without DDL changes.
  -- Default = empty strip; the FE seeds the default Chat tab.
  state       jsonb       NOT NULL DEFAULT '{"tabs":[],"activeTabId":null}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

-- Cross-device sync poll path: latest state per user, newest first.
CREATE INDEX IF NOT EXISTS owner_tabs_updated_idx
  ON owner_tabs (tenant_id, user_id, updated_at DESC);

ALTER TABLE owner_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_tabs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'owner_tabs'
       AND policyname = 'owner_tabs_tenant_isolation'
  ) THEN
    CREATE POLICY owner_tabs_tenant_isolation
      ON owner_tabs
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
