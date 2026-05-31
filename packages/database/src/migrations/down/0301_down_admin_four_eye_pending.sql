-- =============================================================================
-- Down-migration 0301 - reverse admin_superpower_pending_approvals.
--
-- Dev/staging only. Pending approvals are short-lived (24h TTL) so the
-- blast radius of a drop is bounded; any operator with a half-approved
-- HIGH verb in flight will simply have to re-propose.
--
-- Production rollback must be coordinated with the platform-admin
-- council — losing in-flight approvals can interrupt a regulator pack
-- export or a tenant suspension chain.
--
-- Reverses migration 0301_admin_four_eye_pending.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS admin_four_eye_admin_scope
  ON admin_superpower_pending_approvals;
DROP INDEX IF EXISTS admin_four_eye_expires_idx;
DROP INDEX IF EXISTS admin_four_eye_journal_idx;
DROP INDEX IF EXISTS admin_four_eye_status_created_idx;
DROP TABLE IF EXISTS admin_superpower_pending_approvals;

COMMIT;
