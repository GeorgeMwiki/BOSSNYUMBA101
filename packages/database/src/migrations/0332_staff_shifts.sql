-- =============================================================================
-- Migration 0332 — staff_shifts: the REAL per-worker shift schedule source.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The staff-mobile worker home card polls GET /api/v1/field/shifts/today
-- (apps/staff-mobile/src/home/worker/useTodayShift.ts) to render the W-M-02
-- shift-report screen. That route did not exist on the api-gateway, so the
-- hook returned an HONEST empty state ("no shift / unavailable") rather than
-- fabricating a 06:00–18:00 day shift. This table is the durable, tenant-
-- scoped schedule the new field/shifts.hono.ts route resolves "my shift
-- today" from. The shift's TASK LIST is NOT stored here — the route resolves
-- it live from maintenance_tasks so the card never shows a stale queue.
--
-- ONE ROW = ONE SCHEDULED SHIFT
-- -----------------------------
-- (employee, calendar-day, kind). `shift_kind` is day|night; a worker may
-- have a day AND a night shift on the same date but not two of the same kind
-- (UNIQUE(tenant_id, employee_id, shift_date, shift_kind)). `site_name` is
-- denormalised from the building name at schedule time so the card renders
-- without a join; `building_id` keeps the live link. `user_id` is
-- denormalised from employees.user_id so "my shift" resolves straight from
-- the JWT subject. `next_break_at` is nullable (not every shift has a break).
-- NO money columns — a shift is an operational schedule only.
--
-- HARD RULES HONOURED (CLAUDE.md)
-- -------------------------------
--   * Tenant-scoped table -> ENABLE + FORCE ROW LEVEL SECURITY + canonical
--     tenant_isolation (select/modify) + service_role_bypass policies on
--     current_setting('app.current_tenant_id'/'app.is_service_role', true)
--     (mirrors 0326's canonical shape). REVOKE anon (guarded for vanilla PG).
--   * tenant_id is TEXT so the predicate is the bare
--     `tenant_id = current_setting(...)`.
--
-- IDEMPOTENT / FORWARD-ONLY: IF NOT EXISTS + DROP POLICY IF EXISTS before each
-- CREATE POLICY + pg_roles anon guard. Safe to re-run. Append-only per
-- CLAUDE.md "Migrations are immutable".
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- §1 — staff_shifts
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_shifts (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  employee_id    TEXT NOT NULL,
  user_id        TEXT,
  shift_date     DATE NOT NULL,
  shift_kind     TEXT NOT NULL DEFAULT 'day'
                   CHECK (shift_kind IN ('day','night')),
  building_id    TEXT,
  site_name      TEXT NOT NULL,
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  next_break_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     TEXT,
  updated_by     TEXT
);

-- Hot path: "this worker's shift for a given day".
CREATE INDEX IF NOT EXISTS staff_shifts_tenant_user_date_idx
  ON staff_shifts(tenant_id, user_id, shift_date);

CREATE INDEX IF NOT EXISTS staff_shifts_tenant_employee_date_idx
  ON staff_shifts(tenant_id, employee_id, shift_date);

-- One shift per employee per day per kind.
CREATE UNIQUE INDEX IF NOT EXISTS staff_shifts_unique_employee_day_kind_idx
  ON staff_shifts(tenant_id, employee_id, shift_date, shift_kind);

-- -----------------------------------------------------------------------------
-- §2 — FORCE RLS + canonical tenant-isolation + service-role-bypass policies.
-- Mirrors 0326. tenant_id is TEXT so the compare is bare. Idempotent.
-- -----------------------------------------------------------------------------

DO $do_staff_shifts$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff_shifts'
  ) THEN
    EXECUTE 'ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.staff_shifts FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.staff_shifts;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.staff_shifts;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.staff_shifts;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.staff_shifts
              FOR SELECT TO authenticated
              USING (tenant_id = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.staff_shifts
              FOR ALL TO authenticated
              USING (tenant_id = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.staff_shifts
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    -- anon role is a Supabase construct; guard so the migration still applies
    -- on a vanilla Postgres (CI empty-PG check / non-Supabase env).
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON public.staff_shifts FROM anon;';
    END IF;
  END IF;
END
$do_staff_shifts$;

COMMENT ON TABLE staff_shifts IS
  'Per-worker shift schedule source (day/night) backing GET /api/v1/field/'
  'shifts/today (field/shifts.hono.ts), polled by staff-mobile useTodayShift. '
  'One row per (employee, day, kind); site_name denormalised at schedule time. '
  'Shift task list resolved live from maintenance_tasks (never snapshotted). '
  'NO money columns. RLS FORCE on app.current_tenant_id. Added in 0332.';

COMMIT;
