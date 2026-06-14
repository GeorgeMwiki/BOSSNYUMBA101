-- =============================================================================
-- Down-migration 0332 — reverse staff_shifts.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes every scheduled
-- worker shift. The fail-safe consequence is operational, not financial: with
-- no table the GET /api/v1/field/shifts/today route surfaces a clean DB error
-- the router maps to a 5xx, and the staff-mobile useTodayShift hook already
-- treats an unreachable endpoint as an HONEST "no shift" empty state rather
-- than fabricating one. NO money/ledger records live here — a shift is an
-- operational schedule only; LedgerService owns the money path and never
-- depended on this table.
--
-- Reverses migration 0332_staff_shifts.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS service_role_bypass ON staff_shifts;
DROP POLICY IF EXISTS tenant_isolation_modify ON staff_shifts;
DROP POLICY IF EXISTS tenant_isolation_select ON staff_shifts;

DROP INDEX IF EXISTS staff_shifts_unique_employee_day_kind_idx;
DROP INDEX IF EXISTS staff_shifts_tenant_employee_date_idx;
DROP INDEX IF EXISTS staff_shifts_tenant_user_date_idx;

DROP TABLE IF EXISTS staff_shifts;

COMMIT;
