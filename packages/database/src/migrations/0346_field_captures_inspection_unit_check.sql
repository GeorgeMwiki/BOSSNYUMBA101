-- =============================================================================
-- Migration 0346 — widen field_captures.capture_type for inspection + unit_check.
--
-- WHY
-- ───
-- 0326 created field_captures with an INLINE (unnamed) CHECK pinning
-- capture_type to the original four real-estate field events:
--   CHECK (capture_type IN ('attendance','task_ack','incident','shift_report'))
-- Two staff-mobile capture surfaces were left without a backing route and
-- therefore without a capture_type:
--   * W-M-07 — move-in/move-out/unit INSPECTION (offline entity 'inspection',
--     flushes to POST /api/v1/manager/inspections);
--   * W-M-06 — routine UNIT CHECK (offline entity 'unit_check', GET+POST
--     /api/v1/manager/unit-checks).
-- The estate-manager BFF now persists both into field_captures via the same
-- envelope (captureHandler('inspection') / captureHandler('unit_check')). With
-- the 0326 CHECK still in force every such INSERT would fail LOUD with 23514
-- (check_violation) — the offline queue would RETAIN+retry forever rather than
-- drop, but the capture would never land. This migration widens the CHECK so
-- the two new capture types persist.
--
-- WHAT IT DOES
-- ────────────
-- Drops the 0326 inline CHECK (its auto-generated name is
-- field_captures_capture_type_check; we additionally scan pg_constraint to drop
-- ANY remaining CHECK on the column so a non-default name from a prior env is
-- also reversed) and re-adds a NAMED CHECK covering all six capture types.
-- Pure constraint swap — no table/row data is touched. NO money columns (a
-- field capture is an operational event only; LedgerService owns the money
-- path and never depended on this table).
--
-- Append-only / forward-only / IMMUTABLE — never edit 0326; this is the
-- follow-on. Idempotent: guarded on table existence, drops the old CHECK under
-- IF EXISTS, adds the new one only when absent. Replayable.
-- =============================================================================

BEGIN;

DO $do_field_captures_capture_type$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'field_captures'
  ) THEN
    -- Drop the 0326 inline CHECK by its conventional auto-generated name.
    ALTER TABLE public.field_captures
      DROP CONSTRAINT IF EXISTS field_captures_capture_type_check;

    -- Belt-and-braces: drop ANY other CHECK constraint referencing the
    -- capture_type column (covers a constraint renamed in a prior environment),
    -- but never our own widened constraint (added just below).
    FOR r IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = 'public'
        AND cls.relname = 'field_captures'
        AND con.contype = 'c'
        AND con.conname <> 'field_captures_capture_type_v2_check'
        AND pg_get_constraintdef(con.oid) ILIKE '%capture_type%'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.field_captures DROP CONSTRAINT IF EXISTS %I',
        r.conname
      );
    END LOOP;

    -- Re-add a NAMED CHECK spanning all six real-estate capture types: the
    -- original four plus inspection (W-M-07) and unit_check (W-M-06). Guarded so
    -- a replay does not error on an already-present constraint.
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'field_captures_capture_type_v2_check'
        AND conrelid = 'public.field_captures'::regclass
    ) THEN
      ALTER TABLE public.field_captures
        ADD CONSTRAINT field_captures_capture_type_v2_check
        CHECK (capture_type IN (
          'attendance', 'task_ack', 'incident', 'shift_report',
          'inspection', 'unit_check'
        ));
    END IF;
  END IF;
END
$do_field_captures_capture_type$;

COMMENT ON TABLE field_captures IS
  'Staff-mobile offline field-capture sink (attendance / task_ack / incident / '
  'shift_report / inspection / unit_check). One row per queued capture; `body` '
  'is the zod-validated JSONB. Persisted by POST /api/v1/manager/{attendance,'
  'task-acks,incidents,shift-reports,inspections,unit-checks}. Idempotent on '
  'UNIQUE(tenant_id, client_id) for at-least-once flush. NO money columns — '
  'operational event only. RLS FORCE on app.current_tenant_id. Added in 0326; '
  'capture_type widened for inspection/unit_check in 0346.';

COMMIT;
