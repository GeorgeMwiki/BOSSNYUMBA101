-- =============================================================================
-- Migration 0337 — Tenant deletion schedules (right-to-erasure durability).
--
-- WHY
-- ───
-- DELETE /api/v1/tenants/:id (services/api-gateway/src/routes/
-- tenants-admin.hono.ts) is the GDPR Art.17 / KE-PDPA Art.26(2) / TZ-PDPA
-- s.17 tenant-wide right-to-erasure surface. It was a SILENT NO-OP: the
-- route resolved an optional `tenantDeletion` service that is never wired,
-- so it emitted an audit event and returned 202 WITHOUT persisting the
-- erasure request anywhere. A tenant owner who asked to be forgotten was
-- told "scheduled" while nothing was scheduled — a launch blocker and a
-- regulatory exposure.
--
-- WHAT IT DOES
-- ────────────
-- Creates the durable backing table the route now writes BEFORE returning
-- success, and that the platform tenant-purge worker consumes at expiry:
--   - tenant_deletion_schedules : one row per scheduled tenant-wide erasure.
--       status lifecycle scheduled → purging → purged | cancelled. A unique
--       partial index guarantees AT MOST ONE active (scheduled/purging) row
--       per tenant so a double-DELETE upserts the existing schedule instead
--       of stacking duplicates. scheduled_purge_at is the grace-window
--       expiry (≥30 days) the purge worker walks; requested_by pins the
--       tenant admin who asked.
--
-- ACCESS PATH
-- ───────────
-- The DELETE route binds the actor's tenant via databaseMiddleware
-- (app.current_tenant_id GUC), and platform admins (SUPER_ADMIN/ADMIN) may
-- target ANY tenant — so writes happen under the admin's own tenant GUC,
-- NOT the target tenant's. We therefore key RLS visibility on
-- app.is_service_role for the cross-tenant purge worker (same idiom as 0315
-- durable_scheduled_wakes / 0336) AND add a tenant-isolation policy so a
-- tenant admin can read back their OWN tenant's schedule. The route inserts
-- under service-role context (withServiceRoleContext) so a platform admin
-- targeting tenant B is not blocked by the admin's own tenant GUC.
--
-- Companion to:
--   - packages/database/src/schemas/tenant-deletion-schedules.schema.ts
--   - services/api-gateway/src/routes/tenants-admin.hono.ts
--
-- RLS is FORCE-enabled per CLAUDE.md hard rule. Append-only / IMMUTABLE:
-- never edit this file after merge — field/index additions land in a new
-- numbered migration. Replayable: IF NOT EXISTS guards + DROP POLICY IF
-- EXISTS-free idempotent policy creation.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_deletion_schedules (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Target tenant whose data is to be erased. References tenants(id); the
  -- row is deliberately NOT ON DELETE CASCADE-removed by the tenant purge —
  -- the purge worker flips status to 'purged' and keeps the audit trail.
  tenant_id          text        NOT NULL,
  -- Lifecycle: scheduled → purging → purged | cancelled.
  status             text        NOT NULL DEFAULT 'scheduled',
  -- Grace-window expiry. The purge worker only acts on rows whose
  -- scheduled_purge_at has elapsed AND status = 'scheduled'.
  scheduled_purge_at timestamptz NOT NULL,
  grace_days         integer     NOT NULL DEFAULT 30,
  -- The tenant admin (or platform admin) who requested the erasure.
  requested_by       text        NOT NULL,
  requested_by_role  text,
  reason             text,
  -- Number of users known affected at scheduling time (best-effort count).
  affected_users     integer     NOT NULL DEFAULT 0,
  -- Set when the purge worker starts / finishes / the request is cancelled.
  purge_started_at   timestamptz,
  purged_at          timestamptz,
  cancelled_at       timestamptz,
  cancelled_by       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenant_deletion_schedules_status_chk'
  ) THEN
    ALTER TABLE tenant_deletion_schedules
      ADD CONSTRAINT tenant_deletion_schedules_status_chk
      CHECK (status IN ('scheduled', 'purging', 'purged', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenant_deletion_schedules_grace_chk'
  ) THEN
    -- KE PDPA Art.26(2) / TZ PDPA s.17 mandate a 30-day minimum grace.
    ALTER TABLE tenant_deletion_schedules
      ADD CONSTRAINT tenant_deletion_schedules_grace_chk
      CHECK (grace_days >= 30);
  END IF;
END $$;

-- At most ONE active (scheduled/purging) schedule per tenant. A repeated
-- DELETE upserts the existing active row instead of stacking duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_deletion_schedules_active_tenant_uq
  ON tenant_deletion_schedules (tenant_id)
  WHERE status IN ('scheduled', 'purging');

-- Purge-worker hot path: walk due schedules oldest-first.
CREATE INDEX IF NOT EXISTS tenant_deletion_schedules_due_idx
  ON tenant_deletion_schedules (scheduled_purge_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS tenant_deletion_schedules_tenant_idx
  ON tenant_deletion_schedules (tenant_id);

ALTER TABLE tenant_deletion_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_deletion_schedules FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'tenant_deletion_schedules'
       AND policyname = 'tenant_deletion_schedules_tenant_isolation'
  ) THEN
    -- A tenant admin reads back their OWN tenant's schedule.
    CREATE POLICY tenant_deletion_schedules_tenant_isolation
      ON tenant_deletion_schedules
      FOR ALL
      USING (
        tenant_id = current_setting('app.current_tenant_id', true)
      )
      WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'tenant_deletion_schedules'
       AND policyname = 'tenant_deletion_schedules_service_role_bypass'
  ) THEN
    -- The DELETE route (cross-tenant platform-admin target) and the purge
    -- worker (spans tenants) write/read under service-role context.
    CREATE POLICY tenant_deletion_schedules_service_role_bypass
      ON tenant_deletion_schedules
      FOR ALL
      USING (current_setting('app.is_service_role', true) = 'true')
      WITH CHECK (current_setting('app.is_service_role', true) = 'true');
  END IF;
END $$;

REVOKE ALL ON tenant_deletion_schedules FROM anon;

COMMIT;
