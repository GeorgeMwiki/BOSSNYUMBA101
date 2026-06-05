-- =============================================================================
-- Migration 0305 - Org / team-management write surface (staff lifecycle).
--
-- Wave ORG-ADMIN-TOOLS. BossNyumba's CLAUDE.md lists "portfolio managers,
-- leasing agents, housing cooperatives" operating teams of on-the-ground
-- staff (caretakers, leasing assistants, groundskeepers, accountants).
-- This migration adds the four tables backing the org-admin chat brain
-- tools (`staff.create`, `staff.assign_kpi`, `staff.schedule_task`,
-- `staff.escalate_to_human`, `staff.bulk_ingest_csv`) and the
-- `/api/v1/org-admin/*` route surface.
--
-- Ported from LitFin's iter-27..31 org-management tables
-- (employees / employee_kpis / org_tasks / org_escalations) and
-- retargeted lending → real estate:
--   * employee            → staff_member (caretaker / leasing_assistant /
--                            groundskeeper / accountant)
--   * employee_kpis       → staff_kpis (e.g. "units leased this quarter")
--   * org_tasks           → org_tasks (e.g. "move-out inspection scheduling")
--   * org_escalations     → org_escalations ("compliance breach /
--                            payment default / maintenance incident")
--
-- Tables:
--   * staff_members       - one row per staff member in the org
--   * staff_kpis          - KPI targets assigned to a staff member
--   * org_tasks           - tasks scheduled to (optionally) a staff member
--   * org_escalations     - escalations raised for a human to act on
--
-- Tenant scope (CLAUDE.md hard rule — mirrors mig 0304):
--   tenant_id::text = current_setting('app.current_tenant_id', true)
--   RLS is ENABLED + FORCEd on every table with a tenant-isolation policy.
--
-- Multi-currency (CLAUDE.md hard rule): NOTHING here hard-codes a
-- jurisdiction currency. KPI metric units are domain-neutral
-- (count / percent / days / hours / ratio / currency); when a KPI is
-- denominated in money the `metric_unit = 'currency'` row carries no
-- jurisdiction code in this layer (the surface formats with
-- formatCurrency at render time).
--
-- IDEMPOTENT + FORWARD-ONLY (CLAUDE.md hard rule: migrations are
-- immutable). Every object uses IF NOT EXISTS / guarded DO-blocks so a
-- fresh DB and a re-run both converge. The staff_kpis / org_tasks /
-- org_escalations tables FK to staff_members with ON DELETE SET NULL so
-- a removed staff member does not cascade-destroy historical KPI / task
-- / escalation rows (forensic-retention friendly).
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- staff_members
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  full_name     text        NOT NULL,
  role          text        NOT NULL,
  hire_date     timestamptz NOT NULL DEFAULT now(),
  manager_id    uuid        REFERENCES staff_members(id) ON DELETE SET NULL,
  status        text        NOT NULL DEFAULT 'active',
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  provenance    jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'staff_members_status_chk'
  ) THEN
    ALTER TABLE staff_members
      ADD CONSTRAINT staff_members_status_chk
      CHECK (status IN ('active', 'suspended', 'terminated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'staff_members_full_name_chk'
  ) THEN
    ALTER TABLE staff_members
      ADD CONSTRAINT staff_members_full_name_chk
      CHECK (char_length(full_name) BETWEEN 1 AND 200);
  END IF;
END $$;

-- Case-insensitive duplicate-name guard PER TENANT, scoped to non-
-- terminated rows so re-hiring a name after termination stays possible.
CREATE UNIQUE INDEX IF NOT EXISTS staff_members_tenant_name_active_uq
  ON staff_members (tenant_id, lower(full_name))
  WHERE status <> 'terminated';

CREATE INDEX IF NOT EXISTS staff_members_tenant_status
  ON staff_members (tenant_id, status, created_at DESC);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'staff_members'
       AND policyname = 'staff_members_tenant_isolation'
  ) THEN
    CREATE POLICY staff_members_tenant_isolation
      ON staff_members
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- staff_kpis
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_kpis (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  staff_member_id     uuid        NOT NULL
                        REFERENCES staff_members(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  description         text,
  metric_unit         text        NOT NULL DEFAULT 'count',
  target_value        numeric(18, 4) NOT NULL,
  current_value       numeric(18, 4) NOT NULL DEFAULT 0,
  period              text        NOT NULL DEFAULT 'quarter',
  period_end          timestamptz,
  status              text        NOT NULL DEFAULT 'active',
  assigned_by_user_id uuid,
  origin_session_id   text,
  provenance          jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'staff_kpis_metric_unit_chk'
  ) THEN
    ALTER TABLE staff_kpis
      ADD CONSTRAINT staff_kpis_metric_unit_chk
      CHECK (metric_unit IN
        ('count', 'currency', 'percent', 'days', 'hours', 'ratio'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'staff_kpis_period_chk'
  ) THEN
    ALTER TABLE staff_kpis
      ADD CONSTRAINT staff_kpis_period_chk
      CHECK (period IN ('week', 'month', 'quarter', 'half', 'year'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'staff_kpis_status_chk'
  ) THEN
    ALTER TABLE staff_kpis
      ADD CONSTRAINT staff_kpis_status_chk
      CHECK (status IN
        ('active', 'paused', 'achieved', 'missed', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'staff_kpis_target_chk'
  ) THEN
    ALTER TABLE staff_kpis
      ADD CONSTRAINT staff_kpis_target_chk
      CHECK (target_value > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS staff_kpis_tenant_member
  ON staff_kpis (tenant_id, staff_member_id, status);

ALTER TABLE staff_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_kpis FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'staff_kpis'
       AND policyname = 'staff_kpis_tenant_isolation'
  ) THEN
    CREATE POLICY staff_kpis_tenant_isolation
      ON staff_kpis
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- org_tasks   (e.g. "move-out inspection scheduling")
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  title               text        NOT NULL,
  description         text,
  assigned_to         uuid        REFERENCES staff_members(id) ON DELETE SET NULL,
  assigned_by_user_id uuid,
  status              text        NOT NULL DEFAULT 'open',
  priority            text        NOT NULL DEFAULT 'normal',
  due_at              timestamptz,
  completed_at        timestamptz,
  origin_session_id   text,
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  provenance          jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'org_tasks_status_chk'
  ) THEN
    ALTER TABLE org_tasks
      ADD CONSTRAINT org_tasks_status_chk
      CHECK (status IN ('open', 'in_progress', 'done', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'org_tasks_priority_chk'
  ) THEN
    ALTER TABLE org_tasks
      ADD CONSTRAINT org_tasks_priority_chk
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'org_tasks_title_chk'
  ) THEN
    ALTER TABLE org_tasks
      ADD CONSTRAINT org_tasks_title_chk
      CHECK (char_length(title) BETWEEN 1 AND 200);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS org_tasks_tenant_status
  ON org_tasks (tenant_id, status, due_at);

CREATE INDEX IF NOT EXISTS org_tasks_tenant_assigned
  ON org_tasks (tenant_id, assigned_to);

ALTER TABLE org_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_tasks FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'org_tasks'
       AND policyname = 'org_tasks_tenant_isolation'
  ) THEN
    CREATE POLICY org_tasks_tenant_isolation
      ON org_tasks
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- org_escalations  ("compliance breach / payment default / maintenance
-- incident")
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS org_escalations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL,
  title                 text        NOT NULL,
  reason                text        NOT NULL,
  category              text        NOT NULL DEFAULT 'other',
  severity              text        NOT NULL DEFAULT 'normal',
  status                text        NOT NULL DEFAULT 'open',
  escalated_to_staff_id uuid        REFERENCES staff_members(id) ON DELETE SET NULL,
  related_task_id       uuid        REFERENCES org_tasks(id) ON DELETE SET NULL,
  related_subject       text,
  raised_by_user_id     uuid,
  origin_session_id     text,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  provenance            jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'org_escalations_severity_chk'
  ) THEN
    ALTER TABLE org_escalations
      ADD CONSTRAINT org_escalations_severity_chk
      CHECK (severity IN ('low', 'normal', 'high', 'critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'org_escalations_status_chk'
  ) THEN
    ALTER TABLE org_escalations
      ADD CONSTRAINT org_escalations_status_chk
      CHECK (status IN
        ('open', 'acknowledged', 'in_progress', 'resolved', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'org_escalations_category_chk'
  ) THEN
    ALTER TABLE org_escalations
      ADD CONSTRAINT org_escalations_category_chk
      CHECK (category IN
        ('compliance_breach', 'payment_default', 'maintenance_incident',
         'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS org_escalations_tenant_status
  ON org_escalations (tenant_id, status, severity);

ALTER TABLE org_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_escalations FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'org_escalations'
       AND policyname = 'org_escalations_tenant_isolation'
  ) THEN
    CREATE POLICY org_escalations_tenant_isolation
      ON org_escalations
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
