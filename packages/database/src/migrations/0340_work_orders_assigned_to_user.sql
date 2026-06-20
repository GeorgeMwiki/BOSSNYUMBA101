-- =============================================================================
-- Migration 0340 — work_orders.assigned_to_user_id (canonical worker assignee).
--
-- WHY
-- ───
-- Owner→worker dispatch and worker task-read were bound to two unbridged
-- models (Mode-C R2 owner↔workforce HIGH):
--   • work_orders (maintenance.schema.ts) carried only vendor_id + assigned_by
--     (the actor who performed the assign), with NO worker assignee column. So
--     services/api-gateway/src/routes/db-mappers.ts:mapWorkOrderRow hard-coded
--     `assignedToUserId: undefined` — every manager/owner view of a work order
--     showed no assignee, and there was no canonical column to project a
--     completion back onto.
--   • The worker's /api/v1/field/staff/tasks/next read the SEPARATE `assignments`
--     table by assignee_employee_id. A work order, on its own, never surfaced
--     on a worker's task list — so even a wired dispatch was structurally dead.
--
-- CANONICAL MODEL (locked)
-- ────────────────────────
-- work_orders.assigned_to_user_id is now the ONE canonical worker-assignee
-- field on a work order (a USER fk, matching the JWT subject the worker app
-- authenticates as). The new manager dispatch route
-- (POST /api/v1/manager/work-orders/:id/assign-worker) stamps THIS column
-- (+ status='assigned', assigned_at, assigned_by) AND creates a bridge
-- `assignments` row (linked_entity_kind='work_order') so the existing
-- employee-keyed /tasks/next read continues to surface it. /tasks/next ALSO
-- now reads work_orders directly by assigned_to_user_id, so the canonical
-- column alone drives the worker queue.
--
-- TYPE
-- ────
--   assigned_to_user_id  TEXT  REFERENCES users(id) ON DELETE SET NULL.
--   ON DELETE SET NULL mirrors vendor_id / customer_id on the same table: a
--   deleted user de-assigns the work order rather than cascading the WO away.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS, so
-- re-applying over a DB that already has the column is a clean no-op (safe
-- under both `psql -f` and the run-migrations sql.begin() wrapper). RLS on
-- work_orders is unaffected — FORCE RLS + tenant_isolation already applied in
-- 0155/0156; an additive column inherits the existing posture, no policy
-- touched. Append-only / IMMUTABLE: never edit this file after merge.
-- =============================================================================

BEGIN;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS assigned_to_user_id text
    REFERENCES users(id) ON DELETE SET NULL;

-- Hot path for the worker task queue (/tasks/next) and the manager
-- "assigned to me" filters: tenant-scoped lookup of open work orders for one
-- assignee. Partial on a non-null assignee keeps the index tight.
CREATE INDEX IF NOT EXISTS work_orders_assigned_to_user_idx
  ON work_orders (tenant_id, assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

COMMENT ON COLUMN work_orders.assigned_to_user_id IS
  'Canonical worker assignee (users.id) for owner→worker dispatch. Stamped by POST /api/v1/manager/work-orders/:id/assign-worker alongside status=''assigned'' + assigned_at + assigned_by, and surfaced to the worker via /api/v1/field/staff/tasks/next. ON DELETE SET NULL de-assigns rather than cascading. Added by 0340; NULL for pre-0340 / vendor-only work orders.';

COMMIT;
