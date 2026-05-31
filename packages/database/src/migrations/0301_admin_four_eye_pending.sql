-- =============================================================================
-- Migration 0301 - Admin Superpowers Four-Eye Pending Approvals
--
-- Wave OWNER-OS / admin-platform-portal parity. Closes the second gap
-- in the BN-only port: admin-platform-portal had no chat-callable
-- superpowers surface and no four-eye approval flow for HIGH-risk
-- cross-tenant verbs.
--
-- This table holds the pending half of the two-phase admin superpower
-- ledger:
--
--   Phase 1 (POST /api/v1/admin/superpowers/bulk-action with HIGH verb):
--     Insert one row PER (target tenant_org, target entity_id) with
--     status='pending_approval'. The proposing admin's actor_id is
--     pinned. No side effects fire yet.
--
--   Phase 2 (POST /api/v1/admin/superpowers/approve/:journalId):
--     A SECOND distinct admin actor approves. The row transitions to
--     status='applied', the approving actor_id is pinned, and the
--     entity-side mutation fires. Approval is REJECTED if the approver
--     is the same actor as the proposer (FOUR_EYE_SAME_ACTOR error).
--
-- HIGH-risk admin verbs (require four-eye):
--   - suspend_tenant_org           — soft-suspend a tenant org
--   - reactivate_tenant_org        — reverse a prior suspension
--   - export_regulator_pack        — full regulator dump for a tenant
--   - force_lease_termination      — admin-side override of a lease
--   - force_password_reset         — operator-initiated reset
--   - bulk_archive_maintenance_cases (>50 rows) — mass archive
--
-- MEDIUM-risk admin verbs (audit-logged, single actor sufficient):
--   - bulk_send_announcement       — broadcast to operators
--   - bulk_archive_old_invoices    — housekeeping
--   - bulk_re_tag_units            — taxonomy reorg
--
-- The MEDIUM verbs DO NOT use this table; they append directly to
-- `undo_journal` with provenance.status='applied'.
--
-- Audit chain integration: every HIGH row's `provenance.audit_chain_id`
-- references the canonical hash-chained audit-events row created by
-- the route handler (services/api-gateway/src/routes/admin/
-- superpowers.hono.ts). The chain is SHARED with owner-side audit —
-- no parallel admin chain per the CLAUDE.md hard rule.
--
-- TTL: pending rows expire 24h after creation (operator must re-propose
-- if not approved in time). A nightly sweeper marks them
-- status='expired' so the FE chip can show the operator a clear "this
-- proposal lapsed" state instead of silently disappearing.
--
-- RLS: admin-scope policy (NOT tenant-scoped). The proposing/approving
-- admin's tenant context does not gate visibility — admins see every
-- pending row across every tenant they have admin role on. The
-- `admin_scope_only` policy below enforces this via a guard the
-- middleware sets (`app.admin_scope=true`).
--
-- Companion files:
--   - services/api-gateway/src/routes/admin/superpowers.hono.ts
--   - services/api-gateway/src/composition/brain-tools/
--     admin-superpowers-tools.ts
--
-- Append-only / forward-only / IMMUTABLE — never edit this file after
-- merge.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_superpower_pending_approvals (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Journal id this pending row is gated against. Updated to
  -- 'applied'/'rejected' on approval/rejection. The corresponding
  -- undo_journal row carries the immutable record.
  journal_id        uuid        NOT NULL,
  -- Target tenant for the proposed action (the tenant being suspended,
  -- exported, reset, etc.). NULL for cross-tenant actions like
  -- bulk_send_announcement to all operators.
  target_tenant_id  text,
  -- Free-form descriptor of the target entity. e.g.
  -- 'tenant_org:tenant-acme' or 'lease:lease-7' or 'user:user-42'.
  target_entity_ref text        NOT NULL,
  -- The verb (suspend_tenant_org, force_lease_termination, ...).
  action            text        NOT NULL,
  -- Free-form payload for the verb (e.g. effective_date for
  -- force_lease_termination, reason for force_password_reset, etc.).
  payload           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Mandatory reason; surfaced in the approver's notification.
  reason            text        NOT NULL,
  -- Lifecycle: pending → applied | rejected | expired.
  status            text        NOT NULL DEFAULT 'pending',
  proposed_by_actor_id text     NOT NULL,
  proposed_by_role     text     NOT NULL,
  approved_by_actor_id text,
  approved_by_role     text,
  approver_note        text,
  rejected_by_actor_id text,
  rejected_by_role     text,
  rejection_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  approved_at       timestamptz,
  rejected_at       timestamptz,
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  -- Audit chain id (references audit_events) — pinned at creation,
  -- updated again on approval/rejection.
  audit_chain_ids   jsonb       NOT NULL DEFAULT '[]'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_four_eye_status_chk'
  ) THEN
    ALTER TABLE admin_superpower_pending_approvals
      ADD CONSTRAINT admin_four_eye_status_chk
      CHECK (status IN ('pending', 'applied', 'rejected', 'expired'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_four_eye_role_chk'
  ) THEN
    -- BN admin roles (matches services/api-gateway/src/types/user-role.ts).
    ALTER TABLE admin_superpower_pending_approvals
      ADD CONSTRAINT admin_four_eye_role_chk
      CHECK (proposed_by_role IN ('SUPER_ADMIN', 'ADMIN', 'SUPPORT'));
  END IF;

  -- Approver must differ from proposer (the FOUR-EYE invariant).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_four_eye_distinct_actors_chk'
  ) THEN
    ALTER TABLE admin_superpower_pending_approvals
      ADD CONSTRAINT admin_four_eye_distinct_actors_chk
      CHECK (
        approved_by_actor_id IS NULL
        OR approved_by_actor_id <> proposed_by_actor_id
      );
  END IF;
END $$;

-- Pending-queue path: operators load all pending across tenants newest
-- first.
CREATE INDEX IF NOT EXISTS admin_four_eye_status_created_idx
  ON admin_superpower_pending_approvals (status, created_at DESC);

-- Journal-id lookup path (single-row fetch by approver).
CREATE INDEX IF NOT EXISTS admin_four_eye_journal_idx
  ON admin_superpower_pending_approvals (journal_id);

-- Expiry sweeper path.
CREATE INDEX IF NOT EXISTS admin_four_eye_expires_idx
  ON admin_superpower_pending_approvals (expires_at)
  WHERE status = 'pending';

ALTER TABLE admin_superpower_pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_superpower_pending_approvals FORCE ROW LEVEL SECURITY;

-- Admin-scope policy. The tenant GUC is NOT a gate — admins legitimately
-- act across tenants. Visibility is gated by the `app.admin_scope`
-- session GUC, which is bound by `requireRole(SUPER_ADMIN|ADMIN|SUPPORT)`
-- in the route handler. Defense in depth: the route's own
-- `requireRole` middleware refuses non-admins BEFORE this policy is
-- evaluated, so a leaked GUC by itself is not enough.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'admin_superpower_pending_approvals'
       AND policyname = 'admin_four_eye_admin_scope'
  ) THEN
    CREATE POLICY admin_four_eye_admin_scope
      ON admin_superpower_pending_approvals
      FOR ALL
      USING (
        coalesce(current_setting('app.admin_scope', true), 'false') = 'true'
      )
      WITH CHECK (
        coalesce(current_setting('app.admin_scope', true), 'false') = 'true'
      );
  END IF;
END $$;

COMMIT;
