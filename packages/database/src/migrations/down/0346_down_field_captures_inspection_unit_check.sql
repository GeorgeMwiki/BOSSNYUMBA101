-- =============================================================================
-- Down-migration 0346 — narrow field_captures.capture_type back to the four.
--
-- Dev/staging only. Restores the 0326 capture_type CHECK
-- (attendance / task_ack / incident / shift_report) by dropping the widened
-- v2 CHECK and re-adding the original named equivalent. Pure constraint swap —
-- no table/row data is dropped. NO money/ledger records live here.
--
-- WILL ABORT (safe) if any field_captures row already holds capture_type
-- 'inspection' or 'unit_check': re-adding the narrower CHECK fails LOUD on a
-- populated table rather than silently truncating. Reconcile (delete or
-- re-type those rows) before running this down.
--
-- Reverses migration 0346_field_captures_inspection_unit_check.sql.
-- =============================================================================

BEGIN;

DO $do_down_field_captures_capture_type$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'field_captures'
  ) THEN
    ALTER TABLE public.field_captures
      DROP CONSTRAINT IF EXISTS field_captures_capture_type_v2_check;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'field_captures_capture_type_check'
        AND conrelid = 'public.field_captures'::regclass
    ) THEN
      ALTER TABLE public.field_captures
        ADD CONSTRAINT field_captures_capture_type_check
        CHECK (capture_type IN (
          'attendance', 'task_ack', 'incident', 'shift_report'
        ));
    END IF;
  END IF;
END
$do_down_field_captures_capture_type$;

COMMIT;
