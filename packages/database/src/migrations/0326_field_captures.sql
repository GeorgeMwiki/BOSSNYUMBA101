-- =============================================================================
-- Migration 0326 — field_captures: the staff-mobile offline capture sink.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The staff (workforce) mobile app captures real-estate field events OFFLINE
-- (attendance check-ins, task acknowledgements, incident reports, shift
-- reports) and queues them locally. On reconnect, `apps/staff-mobile/src/sync/
-- flush.ts` POSTs each queued write to
--   POST /api/v1/manager/<attendance|task-acks|incidents|shift-reports>
-- These gateway routes did not exist, so every flush 404'd and the queue's
-- `shouldDrop()` discarded the payload as if it were a poisoned 4xx — silent,
-- permanent field-data loss behind an optimistic "synced" badge. The estate-
-- manager router now owns those four POST routes; this table is the durable,
-- tenant-scoped sink they persist into.
--
-- ONE WIDE TABLE, NOT FOUR
-- ------------------------
-- The four entity types share an identical envelope (who/where/when + a typed
-- JSONB body), differ only in `body` shape, and are always read together as
-- "this property's field log". A single `field_captures` table with a
-- `capture_type` discriminant keeps the offline-sync contract trivial (one
-- INSERT path, one idempotency arbiter) and avoids four near-identical RLS
-- blocks. The per-type body is validated by zod at the API layer BEFORE it ever
-- reaches this INSERT, so `body` is an opaque jsonb blob here. NO money columns
-- — a field capture is an operational event only; any money it implies still
-- flows through the gated verbs + LedgerService (CLAUDE.md hard rule).
--
-- IDEMPOTENCY (at-least-once offline flush)
-- -----------------------------------------
-- Offline flush is at-least-once: the same queued write can POST twice (flush
-- ran, response lost, flush re-ran). Every capture carries a CLIENT-SUPPLIED
-- `client_id` (the queue entry id). UNIQUE(tenant_id, client_id) makes the
-- INSERT idempotent via ON CONFLICT DO NOTHING — a re-POST returns the already-
-- stored row instead of duplicating it. No money double-post is possible
-- because no money is written here.
--
-- HARD RULES HONOURED
-- -------------------
--   * Tenant-scoped table -> ENABLE + FORCE ROW LEVEL SECURITY + the canonical
--     tenant_isolation (select/modify) + service_role_bypass policies on
--     current_setting('app.current_tenant_id'/'app.is_service_role', true)
--     (mirrors 0316's canonical shape). REVOKE anon (guarded for vanilla PG).
--   * tenant_id is TEXT so the predicate is the bare `tenant_id = current_setting(...)`.
--
-- IDEMPOTENT / FORWARD-ONLY: IF NOT EXISTS + DROP POLICY IF EXISTS before each
-- CREATE POLICY + pg_roles anon guard. Safe to re-run. Append-only per CLAUDE.md
-- "Migrations are immutable".
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- §1 — field_captures
--
-- `capture_type` discriminates the four real-estate field events. `body` holds
-- the type-specific JSONB (zod-validated at the API layer). `property_id` /
-- `unit_id` are nullable because not every capture is unit-scoped (e.g. a
-- shift report spans a property; an attendance check-in may carry only a
-- geo-point). `captured_at` is the device-reported event time (may pre-date
-- `created_at` by hours when offline); `created_at` is the server receipt time.
-- `client_id` is the offline-queue entry id (idempotency key).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_captures (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  capture_type  TEXT NOT NULL
                  CHECK (capture_type IN ('attendance','task_ack','incident','shift_report')),
  staff_id      TEXT NOT NULL,
  property_id   TEXT,
  unit_id       TEXT,
  body          JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Listing hot path: "this tenant's field log for a property, newest first".
CREATE INDEX IF NOT EXISTS field_captures_tenant_type_idx
  ON field_captures(tenant_id, capture_type, created_at DESC);

CREATE INDEX IF NOT EXISTS field_captures_tenant_property_idx
  ON field_captures(tenant_id, property_id);

-- Idempotency arbiter for the at-least-once offline flush. A re-POSTed queue
-- entry (same tenant + client_id) is absorbed by ON CONFLICT DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS field_captures_tenant_client_uq
  ON field_captures(tenant_id, client_id);

-- -----------------------------------------------------------------------------
-- §2 — FORCE RLS + canonical tenant-isolation + service-role-bypass policies.
-- Mirrors 0316. tenant_id is TEXT so the compare is bare. Idempotent.
-- -----------------------------------------------------------------------------

DO $do_field_captures$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'field_captures'
  ) THEN
    EXECUTE 'ALTER TABLE public.field_captures ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.field_captures FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.field_captures;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.field_captures;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.field_captures;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.field_captures
              FOR SELECT TO authenticated
              USING (tenant_id = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.field_captures
              FOR ALL TO authenticated
              USING (tenant_id = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.field_captures
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    -- anon role is a Supabase construct; guard so the migration still applies
    -- on a vanilla Postgres (CI empty-PG check / non-Supabase env).
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON public.field_captures FROM anon;';
    END IF;
  END IF;
END
$do_field_captures$;

COMMENT ON TABLE field_captures IS
  'Staff-mobile offline field-capture sink (attendance / task_ack / incident / '
  'shift_report). One row per queued capture; `body` is the zod-validated JSONB. '
  'Persisted by POST /api/v1/manager/{attendance,task-acks,incidents,shift-reports}. '
  'Idempotent on UNIQUE(tenant_id, client_id) for at-least-once flush. NO money '
  'columns — operational event only. RLS FORCE on app.current_tenant_id. Added in 0326.';

COMMIT;
