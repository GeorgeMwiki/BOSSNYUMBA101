-- =============================================================================
-- Migration 0283 — Maintenance Crew Tasks + Pre-Shift Toolbox Talks
--
-- Ported from Borjie 0080 — domain-shifted from mining workforce to
-- property-maintenance crew.
--
-- Companion to (future):
--   - services/api-gateway/src/routes/maintenance/tasks.hono.ts
--   - services/api-gateway/src/routes/maintenance/toolbox.hono.ts
--   - packages/database/src/schemas/maintenance-tasks.schema.ts
--
-- Two tables:
--
--   maintenance_tasks         — property-manager-assigned work units for
--                               maintenance crew. Drives the workforce
--                               home screen "Task queue (3 visible)"
--                               stack and the swipe-right → complete /
--                               swipe-left → block flows. Lifecycle:
--                               pending → in_progress → done | blocked
--                               | cancelled. Bilingual (sw + en). Tasks
--                               are tenant-scoped; building_id is
--                               OPTIONAL so a manager can assign
--                               cross-building tasks.
--
--   maintenance_toolbox_talks — pre-shift safety briefings. One row per
--                               (building, day). Crew sign off via
--                               in-app acknowledgement; acknowledged_by
--                               _user_ids accumulates crew user ids.
--                               Bilingual topic + notes. Real-estate
--                               relevance: scaffolding safety, electrical
--                               isolation, asbestos awareness, working
--                               at height, COSHH chemicals, gas safety.
--
-- Both tables FORCE RLS. Canonical isolation predicate:
-- `tenant_id::text = current_setting('app.current_tenant_id', true)`.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- maintenance_tasks — property-manager-assigned work units for crew
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid        NOT NULL,
  /** Optional — cross-building tasks (e.g. parts pickup) leave this NULL. */
  building_id                 uuid,
  /** Crew member the task is delegated to. NULL = unassigned (manager queue). */
  assigned_to_user_id         uuid,
  /** Property manager who created the task. NULL only for system-generated tasks. */
  assigned_by_user_id         uuid,
  /** Bilingual title — Swahili required, English optional. */
  title_sw                    text        NOT NULL,
  title_en                    text,
  description_sw              text,
  description_en              text,
  /** low | normal | high | urgent. */
  priority                    text        NOT NULL DEFAULT 'normal',
  /** pending | in_progress | done | blocked | cancelled. */
  status                      text        NOT NULL DEFAULT 'pending',
  /**
   * Task category — drives icon, default checklist, regulator routing.
   *   plumbing | electrical | hvac | roofing | painting | landscaping |
   *   pest_control | cleaning | safety | inspection | other
   */
  category                    text        NOT NULL DEFAULT 'other',
  /** Self-FK — task chains (this task must complete before that one). */
  sequenced_after_task_id     uuid        REFERENCES maintenance_tasks(id) ON DELETE SET NULL,
  due_at                      timestamptz,
  completed_at                timestamptz,
  blocked_reason              text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  /** Pointer into ai_audit_chain for forensic replay. */
  hash_chain_id               uuid
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_tasks_priority_chk'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_priority_chk
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_tasks_status_chk'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_status_chk
      CHECK (status IN ('pending', 'in_progress', 'done', 'blocked', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_tasks_category_chk'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_category_chk
      CHECK (category IN (
        'plumbing','electrical','hvac','roofing','painting','landscaping',
        'pest_control','cleaning','safety','inspection','other'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_tasks_title_sw_nonempty_chk'
  ) THEN
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_title_sw_nonempty_chk
      CHECK (length(title_sw) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_tasks_blocked_reason_chk'
  ) THEN
    -- A blocked task MUST carry a reason; non-blocked tasks may or may not.
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_blocked_reason_chk
      CHECK (status <> 'blocked' OR length(coalesce(blocked_reason, '')) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_tasks_completed_at_chk'
  ) THEN
    -- A done task MUST have completed_at; never-done tasks MUST NOT.
    ALTER TABLE maintenance_tasks
      ADD CONSTRAINT maintenance_tasks_completed_at_chk
      CHECK (
        (status = 'done' AND completed_at IS NOT NULL)
        OR (status <> 'done' AND completed_at IS NULL)
      );
  END IF;
END $$;

-- Hot path: list a crew member's open tasks.
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_tenant_assignee_status
  ON maintenance_tasks (tenant_id, assigned_to_user_id, status);

-- Manager dashboards: rollups by building.
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_tenant_building_status
  ON maintenance_tasks (tenant_id, building_id, status);

-- Created-at ordering for "newest first" listings.
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_tenant_created
  ON maintenance_tasks (tenant_id, created_at DESC);

-- Category rollups for routing dashboards.
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_tenant_category_status
  ON maintenance_tasks (tenant_id, category, status);

ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'maintenance_tasks'
       AND policyname = 'maintenance_tasks_tenant_isolation'
  ) THEN
    CREATE POLICY maintenance_tasks_tenant_isolation
      ON maintenance_tasks
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- maintenance_toolbox_talks — pre-shift safety briefings
--                              (one per building per day)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS maintenance_toolbox_talks (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid        NOT NULL,
  building_id                   uuid        NOT NULL,
  topic_sw                      text        NOT NULL,
  topic_en                      text,
  scheduled_for                 date        NOT NULL,
  led_by_user_id                uuid,
  /** Array of crew user_ids that have signed off (acknowledged) the briefing. */
  acknowledged_by_user_ids      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  briefing_notes_sw             text,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_toolbox_talks_topic_sw_nonempty_chk'
  ) THEN
    ALTER TABLE maintenance_toolbox_talks
      ADD CONSTRAINT maintenance_toolbox_talks_topic_sw_nonempty_chk
      CHECK (length(topic_sw) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_toolbox_talks_ack_is_array_chk'
  ) THEN
    ALTER TABLE maintenance_toolbox_talks
      ADD CONSTRAINT maintenance_toolbox_talks_ack_is_array_chk
      CHECK (jsonb_typeof(acknowledged_by_user_ids) = 'array');
  END IF;
END $$;

-- Hot path: list today's talks for a building.
CREATE INDEX IF NOT EXISTS idx_maintenance_toolbox_talks_tenant_building_date
  ON maintenance_toolbox_talks (tenant_id, building_id, scheduled_for);

-- Per-tenant date ordering for the daily-briefings dashboard.
CREATE INDEX IF NOT EXISTS idx_maintenance_toolbox_talks_tenant_date
  ON maintenance_toolbox_talks (tenant_id, scheduled_for DESC);

ALTER TABLE maintenance_toolbox_talks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_toolbox_talks FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'maintenance_toolbox_talks'
       AND policyname = 'maintenance_toolbox_talks_tenant_isolation'
  ) THEN
    CREATE POLICY maintenance_toolbox_talks_tenant_isolation
      ON maintenance_toolbox_talks
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
