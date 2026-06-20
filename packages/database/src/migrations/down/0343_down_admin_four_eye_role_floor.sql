-- =============================================================================
-- DOWN 0343 — restore the 0301 admin_four_eye_role_chk (re-admits SUPPORT).
--
-- Reverses 0343_admin_four_eye_role_floor.sql. DEV/STAGING ONLY — restoring
-- the looser CHECK re-opens the four-eye role gap (#23): SUPPORT could again
-- be persisted as proposed_by_role, and approved_by_role loses its
-- SUPER_ADMIN/ADMIN floor. The route-layer requireRole/isAdminFloor guards in
-- superpowers.hono.ts still hold, so this down only removes the DB backstop.
-- dataLoss: false (no rows touched; constraint swap only). MUST NOT run in
-- production.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_superpower_pending_approvals'
  ) THEN
    ALTER TABLE admin_superpower_pending_approvals
      DROP CONSTRAINT IF EXISTS admin_four_eye_role_chk;

    -- Re-create the original 0301 constraint shape.
    ALTER TABLE admin_superpower_pending_approvals
      ADD CONSTRAINT admin_four_eye_role_chk
      CHECK (proposed_by_role IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT'));
  END IF;
END $$;

COMMIT;
