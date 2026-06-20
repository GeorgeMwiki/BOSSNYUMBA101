-- =============================================================================
-- Migration 0333 — service_status_components: maintained PLATFORM status board.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The marketing /status page (apps/marketing/src/components/StatusBoard.tsx)
-- polls GET /api/v1/public/status every 30s to render the live system-status
-- grid. That route did not exist; the board was honest-degraded. This table
-- is the maintained source the new PUBLIC public-status.hono.ts route reads:
-- one row per platform component (api-gateway / database / auth / storage /
-- workers / realtime) with current health, last-changed timestamp, a rolling
-- {date,status} history strip, and a maintained uptime percentage.
--
-- NOT TENANT-SCOPED — PUBLIC-READ, SERVICE-WRITE
-- ----------------------------------------------
-- System status is platform-wide and READ BY UNAUTHENTICATED VISITORS (the
-- marketing status page). There is NO tenant_id, NO money, NO PII, NO tenant
-- data here — only coarse green/amber/red component health. RLS is still
-- ENABLE+FORCE'd, but the policy shape DIFFERS from the canonical tenant-
-- isolation block on purpose:
--   * SELECT  -> TO PUBLIC, USING (true)            (anyone may read health)
--   * writes  -> service_role_bypass ONLY           (operators/automation set
--                                                     health out-of-band; the
--                                                     anon web visitor cannot
--                                                     mutate the board)
-- The public route reads with the non-bypass connection; the PUBLIC SELECT
-- policy is what lets that read succeed under FORCE RLS. Absent component rows
-- are reported as `unknown` (honest-degrade) so the board is never fabricated.
--
-- SEED — the six known components are seeded at `unknown` so the board renders
-- a complete grid on day one (honest "unknown" until health is first reported)
-- rather than an empty list. ON CONFLICT DO NOTHING keeps re-runs idempotent.
--
-- IDEMPOTENT / FORWARD-ONLY: IF NOT EXISTS + DROP POLICY IF EXISTS before each
-- CREATE POLICY + pg_roles anon guard. Safe to re-run. Append-only per
-- CLAUDE.md "Migrations are immutable".
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- §1 — service_status_components. `component` IS the natural key.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_status_components (
  component        TEXT PRIMARY KEY
                     CHECK (component IN
                       ('api-gateway','database','auth','storage','workers','realtime')),
  current_status   TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (current_status IN ('ok','degraded','outage','unknown')),
  last_changed_at  TIMESTAMPTZ,
  history          JSONB NOT NULL DEFAULT '[]'::jsonb,
  uptime_pct       NUMERIC(6,3) NOT NULL DEFAULT 100,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_status_components_status_idx
  ON service_status_components(current_status);

-- -----------------------------------------------------------------------------
-- §2 — FORCE RLS. PUBLIC-READ select policy (system status is public);
-- writes restricted to the service role. NO tenant_isolation here on purpose
-- (the table has no tenant_id). Idempotent.
-- -----------------------------------------------------------------------------

DO $do_service_status$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_status_components'
  ) THEN
    EXECUTE 'ALTER TABLE public.service_status_components ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.service_status_components FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS public_read ON public.service_status_components;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_write ON public.service_status_components;';

    -- Anyone (authenticated or anon) may read coarse component health.
    EXECUTE 'CREATE POLICY public_read ON public.service_status_components
              FOR SELECT
              USING (true);';

    -- Only the service role may insert/update/delete health.
    EXECUTE 'CREATE POLICY service_role_write ON public.service_status_components
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    -- Grant SELECT to the Supabase anon role so the public status page can
    -- read without a JWT (guarded for vanilla PG / CI empty-PG).
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'GRANT SELECT ON public.service_status_components TO anon;';
    END IF;
  END IF;
END
$do_service_status$;

-- -----------------------------------------------------------------------------
-- §3 — Seed the six known components at `unknown` (complete grid, honest).
-- -----------------------------------------------------------------------------

INSERT INTO service_status_components (component, current_status, history, uptime_pct)
VALUES
  ('api-gateway', 'unknown', '[]'::jsonb, 100),
  ('database',    'unknown', '[]'::jsonb, 100),
  ('auth',        'unknown', '[]'::jsonb, 100),
  ('storage',     'unknown', '[]'::jsonb, 100),
  ('workers',     'unknown', '[]'::jsonb, 100),
  ('realtime',    'unknown', '[]'::jsonb, 100)
ON CONFLICT (component) DO NOTHING;

COMMENT ON TABLE service_status_components IS
  'Maintained PLATFORM status board (api-gateway/database/auth/storage/workers/'
  'realtime) backing the PUBLIC GET /api/v1/public/status (public-status.hono.ts) '
  'polled by the marketing /status page. NOT tenant-scoped: public-read RLS, '
  'service-role writes. No money/PII. Added in 0333.';

COMMIT;
