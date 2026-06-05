-- =============================================================================
-- Migration 0306 - Agentic plan / subagent + sandbox-preview write surface.
--
-- Wave MD-AGENTIC-TOOLS. Brings Mr. Mwikila to Claude-Code-parity "plan
-- mode" + "agent teams" + a worktree-style sandbox: the brain STAGES a
-- mutation in a sandbox table, the owner reviews the payload + rationale,
-- then commits (atomic write to the real table + an append-only audit row)
-- or rejects (rejection log). NOTHING the brain stages reaches a real table
-- until the owner commits.
--
-- Backs the `plan.*` / `sandbox.*` brain tools (md-agentic-tools.ts) and
-- the `/api/v1/md-agentic/*` route surface.
--
-- Ported from LitFin's iter-32 (md_plan_proposals) + iter-36 (agent-teams
-- + sandbox-writes) tools and retargeted lending -> real estate. Split into
-- five tables so the commit log + reject log are append-only siblings of
-- the pending-writes table (BossNyumba audit-chain discipline):
--   * md_plans            - one row per proposed multi-step plan
--   * md_subagent_runs    - one row per dispatched subagent (honest-degrade:
--                            persisted with status='pending'; aggregate reads
--                            persisted results, NEVER fabricates output)
--   * md_sandbox_writes   - one row per STAGED mutation awaiting owner review
--   * md_sandbox_commits  - append-only audit row written when a sandbox
--                            write is committed to its real target table
--   * md_sandbox_rejects  - append-only rejection log
--
-- Sandbox target allowlist (mirrored as a CHECK constraint): the gap-2
-- org/team tables only -- staff_members / staff_kpis / org_tasks /
-- org_escalations (migration 0305). Every one is tenant-scoped + FORCE-RLS,
-- so a committed write lands inside the same isolation boundary.
--
-- Tenant scope (CLAUDE.md hard rule -- mirrors mig 0304 / 0305):
--   tenant_id::text = current_setting('app.current_tenant_id', true)
--   RLS is ENABLED + FORCEd on every table with a tenant-isolation policy.
--
-- Multi-currency (CLAUDE.md hard rule): NOTHING here hard-codes a
-- jurisdiction currency. A staged payload that carries money is opaque JSONB
-- validated at commit time by the route layer; no currency code lives here.
--
-- IDEMPOTENT + FORWARD-ONLY (CLAUDE.md hard rule: migrations are
-- immutable). Every object uses IF NOT EXISTS / guarded DO-blocks so a
-- fresh DB and a re-run both converge. md_subagent_runs FKs to md_plans
-- with ON DELETE SET NULL so deleting a plan never cascade-destroys the
-- forensic subagent-run history. The sandbox commit / reject logs FK to
-- md_sandbox_writes with ON DELETE CASCADE (a sandbox write and its own
-- audit rows live + die together).
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- md_plans   (Claude-Code-parity "plan mode" -- proposal only, no execution)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS md_plans (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL,
  title                text        NOT NULL,
  summary              text        NOT NULL,
  steps                jsonb       NOT NULL DEFAULT '[]'::jsonb,
  estimated_impact     text,
  status               text        NOT NULL DEFAULT 'proposed',
  proposed_by_user_id  uuid,
  origin_session_id    text,
  metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  provenance           jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_plans_status_chk'
  ) THEN
    ALTER TABLE md_plans
      ADD CONSTRAINT md_plans_status_chk
      CHECK (status IN
        ('proposed', 'approved', 'rejected', 'executing', 'completed',
         'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_plans_title_chk'
  ) THEN
    ALTER TABLE md_plans
      ADD CONSTRAINT md_plans_title_chk
      CHECK (char_length(title) BETWEEN 1 AND 200);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS md_plans_tenant_status
  ON md_plans (tenant_id, status, created_at DESC);

ALTER TABLE md_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE md_plans FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'md_plans'
       AND policyname = 'md_plans_tenant_isolation'
  ) THEN
    CREATE POLICY md_plans_tenant_isolation
      ON md_plans
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- md_subagent_runs   (Agent-Teams primitive -- honest-degraded)
--
-- One row per dispatched subagent. dispatch persists rows at status
-- 'pending'; an executor (when wired) flips them to 'completed' / 'failed'
-- and writes `result`. aggregate reads `result` -- it NEVER fabricates
-- output. With no executor wired the team stays 'pending' and aggregate
-- honestly reports 'unavailable'.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS md_subagent_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  team_run_id         uuid        NOT NULL,
  plan_id             uuid        REFERENCES md_plans(id) ON DELETE SET NULL,
  role                text        NOT NULL,
  brief               text        NOT NULL,
  allowed_tools       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  token_budget        integer     NOT NULL DEFAULT 0,
  aggregation         text        NOT NULL DEFAULT 'merge_all',
  status              text        NOT NULL DEFAULT 'pending',
  result              jsonb,
  error               text,
  spawned_by_user_id  uuid,
  origin_session_id   text,
  provenance          jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id       text,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_subagent_runs_role_chk'
  ) THEN
    ALTER TABLE md_subagent_runs
      ADD CONSTRAINT md_subagent_runs_role_chk
      CHECK (role IN
        ('explorer', 'reviewer', 'synthesizer', 'researcher', 'executor'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_subagent_runs_status_chk'
  ) THEN
    ALTER TABLE md_subagent_runs
      ADD CONSTRAINT md_subagent_runs_status_chk
      CHECK (status IN
        ('pending', 'running', 'completed', 'failed', 'cancelled',
         'budget_exceeded', 'unavailable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_subagent_runs_aggregation_chk'
  ) THEN
    ALTER TABLE md_subagent_runs
      ADD CONSTRAINT md_subagent_runs_aggregation_chk
      CHECK (aggregation IN
        ('majority_vote', 'best_of_n', 'merge_all', 'first_success'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_subagent_runs_budget_chk'
  ) THEN
    ALTER TABLE md_subagent_runs
      ADD CONSTRAINT md_subagent_runs_budget_chk
      CHECK (token_budget >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS md_subagent_runs_tenant_team
  ON md_subagent_runs (tenant_id, team_run_id, status);

CREATE INDEX IF NOT EXISTS md_subagent_runs_tenant_status
  ON md_subagent_runs (tenant_id, status, created_at DESC);

ALTER TABLE md_subagent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE md_subagent_runs FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'md_subagent_runs'
       AND policyname = 'md_subagent_runs_tenant_isolation'
  ) THEN
    CREATE POLICY md_subagent_runs_tenant_isolation
      ON md_subagent_runs
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- md_sandbox_writes   (the STAGED mutation awaiting owner review)
--
-- target_table is constrained to the gap-2 org/team tables (mig 0305).
-- proposed_payload is opaque JSONB validated at COMMIT time by the route
-- layer (zod shape + FK existence) before the atomic real-table write.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS md_sandbox_writes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  target_table        text        NOT NULL,
  operation           text        NOT NULL,
  target_row_id       uuid,
  proposed_payload    jsonb       NOT NULL,
  rationale           text,
  status              text        NOT NULL DEFAULT 'pending',
  plan_id             uuid        REFERENCES md_plans(id) ON DELETE SET NULL,
  proposed_by_user_id uuid,
  origin_session_id   text,
  provenance          jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id       text,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_sandbox_writes_target_chk'
  ) THEN
    ALTER TABLE md_sandbox_writes
      ADD CONSTRAINT md_sandbox_writes_target_chk
      CHECK (target_table IN
        ('staff_members', 'staff_kpis', 'org_tasks', 'org_escalations'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_sandbox_writes_operation_chk'
  ) THEN
    ALTER TABLE md_sandbox_writes
      ADD CONSTRAINT md_sandbox_writes_operation_chk
      CHECK (operation IN ('insert', 'update'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_sandbox_writes_status_chk'
  ) THEN
    ALTER TABLE md_sandbox_writes
      ADD CONSTRAINT md_sandbox_writes_status_chk
      CHECK (status IN ('pending', 'committed', 'rejected', 'expired'));
  END IF;

  -- An UPDATE must name the row it targets; an INSERT must not.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_sandbox_writes_update_target_chk'
  ) THEN
    ALTER TABLE md_sandbox_writes
      ADD CONSTRAINT md_sandbox_writes_update_target_chk
      CHECK (
        (operation = 'update' AND target_row_id IS NOT NULL) OR
        (operation = 'insert' AND target_row_id IS NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS md_sandbox_writes_tenant_status
  ON md_sandbox_writes (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS md_sandbox_writes_tenant_table
  ON md_sandbox_writes (tenant_id, target_table, status);

ALTER TABLE md_sandbox_writes ENABLE ROW LEVEL SECURITY;
ALTER TABLE md_sandbox_writes FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'md_sandbox_writes'
       AND policyname = 'md_sandbox_writes_tenant_isolation'
  ) THEN
    CREATE POLICY md_sandbox_writes_tenant_isolation
      ON md_sandbox_writes
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- md_sandbox_commits   (append-only audit log of committed sandbox writes)
--
-- One row per successful commit. Captures the committed target row id and
-- the pre-commit snapshot (for UPDATE -> rollback evidence). FK to the
-- sandbox write with ON DELETE CASCADE.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS md_sandbox_commits (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  sandbox_write_id    uuid        NOT NULL
                        REFERENCES md_sandbox_writes(id) ON DELETE CASCADE,
  target_table        text        NOT NULL,
  operation           text        NOT NULL,
  target_row_id       uuid,
  pre_commit_snapshot jsonb,
  committed_payload   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  committed_by_user_id uuid,
  origin_session_id   text,
  provenance          jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS md_sandbox_commits_tenant_write
  ON md_sandbox_commits (tenant_id, sandbox_write_id);

CREATE INDEX IF NOT EXISTS md_sandbox_commits_tenant_created
  ON md_sandbox_commits (tenant_id, created_at DESC);

ALTER TABLE md_sandbox_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE md_sandbox_commits FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'md_sandbox_commits'
       AND policyname = 'md_sandbox_commits_tenant_isolation'
  ) THEN
    CREATE POLICY md_sandbox_commits_tenant_isolation
      ON md_sandbox_commits
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- md_sandbox_rejects   (append-only rejection log)
--
-- One row per rejected sandbox write, carrying the owner's reason. The real
-- target table is NEVER touched. FK to the sandbox write with ON DELETE
-- CASCADE.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS md_sandbox_rejects (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  sandbox_write_id    uuid        NOT NULL
                        REFERENCES md_sandbox_writes(id) ON DELETE CASCADE,
  target_table        text        NOT NULL,
  reason              text        NOT NULL,
  rejected_by_user_id uuid,
  origin_session_id   text,
  provenance          jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'md_sandbox_rejects_reason_chk'
  ) THEN
    ALTER TABLE md_sandbox_rejects
      ADD CONSTRAINT md_sandbox_rejects_reason_chk
      CHECK (char_length(reason) BETWEEN 1 AND 4000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS md_sandbox_rejects_tenant_write
  ON md_sandbox_rejects (tenant_id, sandbox_write_id);

CREATE INDEX IF NOT EXISTS md_sandbox_rejects_tenant_created
  ON md_sandbox_rejects (tenant_id, created_at DESC);

ALTER TABLE md_sandbox_rejects ENABLE ROW LEVEL SECURITY;
ALTER TABLE md_sandbox_rejects FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'md_sandbox_rejects'
       AND policyname = 'md_sandbox_rejects_tenant_isolation'
  ) THEN
    CREATE POLICY md_sandbox_rejects_tenant_isolation
      ON md_sandbox_rejects
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
