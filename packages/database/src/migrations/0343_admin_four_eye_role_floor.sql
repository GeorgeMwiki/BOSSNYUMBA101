-- =============================================================================
-- Migration 0343 — Admin four-eye ROLE FLOOR for HIGH-risk verbs (#23).
--
-- WHY
-- ───
-- The four-eye gate on admin_superpower_pending_approvals (0301) only ever
-- enforced DISTINCT ACTOR IDS (admin_four_eye_distinct_actors_chk), never a
-- ROLE floor. SUPPORT is a read-mostly platform role, yet two SUPPORT
-- operators could collude to PROPOSE and APPROVE a HIGH-risk destructive
-- cross-tenant verb (suspend_tenant_org, force_password_reset,
-- force_lease_termination, export_regulator_pack) — the distinct-actor
-- CHECK passed because their IDs differ. The route layer now gates
-- POST /bulk-action + /approve + /reject with requireRole(SUPER_ADMIN,
-- ADMIN) and an in-handler isAdminFloor() backstop
-- (services/api-gateway/src/routes/admin/superpowers.hono.ts). THIS migration
-- is the DB-level backstop: even a leaked/misconfigured route could never
-- persist a SUPPORT proposer/approver on a four-eye row.
--
-- WHAT IT DOES
-- ────────────
-- Tightens admin_four_eye_role_chk so that:
--   * proposed_by_role  ∈ {SUPER_ADMIN, ADMIN}   (was {…, SUPPORT})
--   * approved_by_role  ∈ {SUPER_ADMIN, ADMIN}    when set (NULL until
--     approval), so SUPPORT can never be recorded as the approving eye.
-- The 0301 constraint admitted SUPPORT for proposed_by_role and said nothing
-- about approved_by_role; this replaces it with the stricter pair. SUPPORT
-- keeps read-only access to the /pending queue (governed by the
-- admin_four_eye_admin_scope RLS policy, unchanged here).
--
-- Roles match services/api-gateway/src/types/user-role.ts. The MEDIUM verbs
-- do not use this table, so the floor only governs the four-eye HIGH path.
--
-- Append-only / forward-only / IMMUTABLE — never edit 0301; this is the
-- follow-on. Idempotent: drops and re-adds the role CHECK under guards.
-- Replayable.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'admin_superpower_pending_approvals'
  ) THEN
    -- Replace the 0301 role CHECK (which admitted SUPPORT as proposer and
    -- ignored approved_by_role) with the stricter SUPER_ADMIN/ADMIN floor.
    ALTER TABLE admin_superpower_pending_approvals
      DROP CONSTRAINT IF EXISTS admin_four_eye_role_chk;

    ALTER TABLE admin_superpower_pending_approvals
      ADD CONSTRAINT admin_four_eye_role_chk
      CHECK (
        proposed_by_role IN ('SUPER_ADMIN', 'ADMIN')
        AND (
          approved_by_role IS NULL
          OR approved_by_role IN ('SUPER_ADMIN', 'ADMIN')
        )
      );
  END IF;
END $$;

COMMIT;
