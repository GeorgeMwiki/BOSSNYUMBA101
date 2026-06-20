-- =============================================================================
-- DOWN 0340 — drop work_orders.assigned_to_user_id.
--
-- Reverses 0340_work_orders_assigned_to_user.sql. DEV/STAGING ONLY — dropping
-- the column discards every recorded worker assignee on work orders, so
-- owner→worker dispatch regresses to vendor-only and the worker /tasks/next
-- read loses the canonical work-order projection (it falls back to the bridge
-- `assignments` rows only). dataLoss: true.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS work_orders_assigned_to_user_idx;

ALTER TABLE work_orders
  DROP COLUMN IF EXISTS assigned_to_user_id;

COMMIT;
