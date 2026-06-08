-- =============================================================================
-- Migration 0315 — Durable scheduled wakes + armed monitors.
--
-- WHY
-- ───
-- The orchestrator's `schedule_wake` / `monitor` Decisions are armed by the
-- in-process wake supervisor (packages/central-intelligence/src/durable/
-- in-process-wake-scheduler.ts) on a process-local setInterval tick. That
-- EXECUTES, but an arm made before a process restart is LOST — the "wake me
-- when X happens" superpower did not survive a redeploy (BN-EXE-08 BLOCKER).
--
-- WHAT IT DOES
-- ────────────
-- Creates the two durable backing tables the supervisor now persists to BEFORE
-- returning a handle, deletes from on fire/expiry, and rehydrates on boot:
--   - durable_scheduled_wakes : one row per armed schedule_wake (keyed by
--       resume_token; UPSERT on re-arm, DELETE on fire).
--   - durable_armed_monitors  : one row per armed monitor (keyed by watch_id;
--       UPSERT on re-arm, DELETE on trip/expiry).
-- With these bound the supervisor reports the crash-resilient handle modes
-- ('durable' / 'registered') and durable scheduling becomes the DEFAULT; the
-- storeless in-memory supervisor is then the explicit fallback only.
--
-- ACCESS PATH
-- ───────────
-- The supervisor is a system job that spans tenants on boot, so it reads/writes
-- under withServiceRoleContext (RLS service_role_bypass policy). tenant_id is
-- the scope the resumed turn re-enters under and is NULL for platform-scoped
-- wakes. tenant-isolation policies are added for defence in depth and honour
-- NULL-tenant rows when no tenant context is set (same idiom as 0299
-- idempotency_keys). Reads the same GUCs (app.current_tenant_id /
-- app.is_service_role) bound by the api-gateway middleware +
-- packages/database/src/rls/with-tenant-context.ts.
--
-- Companion to:
--   - packages/database/src/schemas/durable-scheduled-wakes.schema.ts
--   - services/api-gateway/src/composition/durable-wake-store.ts
--   - packages/central-intelligence/src/durable/in-process-wake-scheduler.ts
--
-- RLS is FORCE-enabled per CLAUDE.md hard rule. Append-only / IMMUTABLE: never
-- edit this file after merge — field/index additions land in a new numbered
-- migration. Replayable: IF NOT EXISTS guards + DROP POLICY IF EXISTS.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- durable_scheduled_wakes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS durable_scheduled_wakes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_token  text        NOT NULL,                 -- correlates the resumed turn
  thread_id     text        NOT NULL,                 -- thread to revive
  wake_at       timestamptz NOT NULL,                 -- when to re-invoke
  reason        text        NOT NULL,                 -- carried into the resumed turn
  tenant_id     text,                                 -- NULL for platform-scoped wakes
  scope         jsonb       NOT NULL,                 -- full ScopeContext for re-entry
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Hard uniqueness: re-arming the SAME resume_token UPSERTs (never duplicates).
CREATE UNIQUE INDEX IF NOT EXISTS durable_scheduled_wakes_resume_token_uq
  ON durable_scheduled_wakes (resume_token);

CREATE INDEX IF NOT EXISTS durable_scheduled_wakes_wake_at_idx
  ON durable_scheduled_wakes (wake_at);

CREATE INDEX IF NOT EXISTS durable_scheduled_wakes_tenant_idx
  ON durable_scheduled_wakes (tenant_id);

ALTER TABLE durable_scheduled_wakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE durable_scheduled_wakes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'durable_scheduled_wakes'
       AND policyname = 'durable_scheduled_wakes_tenant_isolation'
  ) THEN
    -- Tenant-scoped rows visible to the matching tenant; platform-scoped
    -- (NULL tenant_id) rows visible only when no tenant context is set.
    CREATE POLICY durable_scheduled_wakes_tenant_isolation
      ON durable_scheduled_wakes
      FOR ALL
      USING (
        (tenant_id IS NOT NULL
          AND tenant_id = current_setting('app.current_tenant_id', true))
        OR
        (tenant_id IS NULL
          AND coalesce(current_setting('app.current_tenant_id', true), '') = '')
      )
      WITH CHECK (
        (tenant_id IS NOT NULL
          AND tenant_id = current_setting('app.current_tenant_id', true))
        OR
        (tenant_id IS NULL
          AND coalesce(current_setting('app.current_tenant_id', true), '') = '')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'durable_scheduled_wakes'
       AND policyname = 'durable_scheduled_wakes_service_role_bypass'
  ) THEN
    -- The supervisor poller spans tenants on boot (rehydrate) → service-role.
    CREATE POLICY durable_scheduled_wakes_service_role_bypass
      ON durable_scheduled_wakes
      FOR ALL
      USING (current_setting('app.is_service_role', true) = 'true')
      WITH CHECK (current_setting('app.is_service_role', true) = 'true');
  END IF;
END $$;

REVOKE ALL ON durable_scheduled_wakes FROM anon;

-- ---------------------------------------------------------------------------
-- durable_armed_monitors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS durable_armed_monitors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id    text        NOT NULL,                   -- correlates the yielding turn
  thread_id   text        NOT NULL,                   -- thread to revive
  predicate   text        NOT NULL,                   -- condition description
  expires_at  timestamptz NOT NULL,                   -- self-expiry time
  tenant_id   text,                                   -- NULL for platform-scoped
  scope       jsonb       NOT NULL,                   -- full ScopeContext for re-entry
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS durable_armed_monitors_watch_id_uq
  ON durable_armed_monitors (watch_id);

CREATE INDEX IF NOT EXISTS durable_armed_monitors_expires_at_idx
  ON durable_armed_monitors (expires_at);

CREATE INDEX IF NOT EXISTS durable_armed_monitors_tenant_idx
  ON durable_armed_monitors (tenant_id);

ALTER TABLE durable_armed_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE durable_armed_monitors FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'durable_armed_monitors'
       AND policyname = 'durable_armed_monitors_tenant_isolation'
  ) THEN
    CREATE POLICY durable_armed_monitors_tenant_isolation
      ON durable_armed_monitors
      FOR ALL
      USING (
        (tenant_id IS NOT NULL
          AND tenant_id = current_setting('app.current_tenant_id', true))
        OR
        (tenant_id IS NULL
          AND coalesce(current_setting('app.current_tenant_id', true), '') = '')
      )
      WITH CHECK (
        (tenant_id IS NOT NULL
          AND tenant_id = current_setting('app.current_tenant_id', true))
        OR
        (tenant_id IS NULL
          AND coalesce(current_setting('app.current_tenant_id', true), '') = '')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'durable_armed_monitors'
       AND policyname = 'durable_armed_monitors_service_role_bypass'
  ) THEN
    CREATE POLICY durable_armed_monitors_service_role_bypass
      ON durable_armed_monitors
      FOR ALL
      USING (current_setting('app.is_service_role', true) = 'true')
      WITH CHECK (current_setting('app.is_service_role', true) = 'true');
  END IF;
END $$;

REVOKE ALL ON durable_armed_monitors FROM anon;

COMMIT;
