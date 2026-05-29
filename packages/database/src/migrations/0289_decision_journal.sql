-- =============================================================================
-- Migration 0289 — Decision Journal (Wave DECISION-LEGIBILITY, real-estate)
--
-- Port of Borjie 0116. Every decision — owner-made, brain-suggested-
-- and-applied, four-eye approved, or automated-policy — is captured
-- with full rationale, alternatives considered, and (later) outcome
-- graded by the retrospective worker.
--
-- Real-estate decisions tracked:
--   - rent increases
--   - evictions (initial notice / formal notice)
--   - maintenance approvals (low-value / capex)
--   - tenant selections (applicant scoring)
--   - lease renewals (terms / duration)
--   - contractor selections
--
-- Surface:
--   decisions          — one row per recorded decision.
--   decision_outcomes  — retrospective grading once horizon elapses.
--   decision_links     — graph linking supersedes / depends_on /
--                        informed_by / reversed_by relationships.
--
-- Tenant-scoped via `app.current_tenant_id` GUC. RLS FORCE-enabled.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── decisions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   text        NOT NULL,
  decided_by_kind             text        NOT NULL,
  decided_by_actor_id         text        NOT NULL,
  decision_subject            text        NOT NULL,
  decision_subject_entity_kind text,
  decision_subject_entity_id   text,
  decided_value               jsonb       NOT NULL,
  alternatives_considered     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  rationale                   text        NOT NULL,
  confidence                  numeric(4,3),
  decided_at                  timestamptz NOT NULL DEFAULT now(),
  scope_ids                   text[]      NOT NULL DEFAULT ARRAY[]::text[],
  related_prediction_id       text,
  related_action_audit_hash   text,
  status                      text        NOT NULL DEFAULT 'committed',
  provenance                  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  entry_hash                  text        NOT NULL,
  prev_hash                   text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decisions_decided_by_kind_chk'
  ) THEN
    ALTER TABLE decisions
      ADD CONSTRAINT decisions_decided_by_kind_chk
      CHECK (decided_by_kind IN (
        'owner', 'brain', 'agent_apply', 'four_eye', 'automated_policy'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decisions_status_chk'
  ) THEN
    ALTER TABLE decisions
      ADD CONSTRAINT decisions_status_chk
      CHECK (status IN ('committed', 'rolled_back', 'superseded'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decisions_confidence_chk'
  ) THEN
    ALTER TABLE decisions
      ADD CONSTRAINT decisions_confidence_chk
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS decisions_tenant_recent_idx
  ON decisions (tenant_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS decisions_tenant_kind_idx
  ON decisions (tenant_id, decided_by_kind, decided_at DESC);

CREATE INDEX IF NOT EXISTS decisions_prediction_idx
  ON decisions (tenant_id, related_prediction_id)
  WHERE related_prediction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS decisions_subject_gin_idx
  ON decisions USING gin (to_tsvector('english', decision_subject || ' ' || rationale));

CREATE INDEX IF NOT EXISTS decisions_tenant_chain_idx
  ON decisions (tenant_id, decided_at);

-- Unique index for the hash chain: at most one row per (tenant, prev_hash)
-- so two concurrent recorders cannot race-write conflicting chain links.
-- Borjie depth-fix per `decision_chain_unique` migration.
CREATE UNIQUE INDEX IF NOT EXISTS decisions_chain_unique_idx
  ON decisions (tenant_id, prev_hash)
  WHERE prev_hash IS NOT NULL;

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'decisions'
       AND policyname = 'decisions_tenant_isolation'
  ) THEN
    CREATE POLICY decisions_tenant_isolation
      ON decisions
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- ─── decision_outcomes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_outcomes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL,
  decision_id         uuid        NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  outcome_summary     text        NOT NULL,
  observed_value      numeric(18,2),
  observed_currency   text        NOT NULL DEFAULT 'TZS',
  observed_at         timestamptz NOT NULL DEFAULT now(),
  retrospective_grade text        NOT NULL,
  learnings           text,
  recorded_by         text        NOT NULL,
  entry_hash          text        NOT NULL,
  prev_hash           text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decision_outcomes_grade_chk'
  ) THEN
    ALTER TABLE decision_outcomes
      ADD CONSTRAINT decision_outcomes_grade_chk
      CHECK (retrospective_grade IN ('good', 'neutral', 'bad', 'undetermined'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decision_outcomes_recorded_by_chk'
  ) THEN
    ALTER TABLE decision_outcomes
      ADD CONSTRAINT decision_outcomes_recorded_by_chk
      CHECK (recorded_by IN ('reconciler', 'owner', 'brain'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS decision_outcomes_decision_idx
  ON decision_outcomes (tenant_id, decision_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS decision_outcomes_grade_idx
  ON decision_outcomes (tenant_id, retrospective_grade, observed_at DESC);

ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_outcomes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'decision_outcomes'
       AND policyname = 'decision_outcomes_tenant_isolation'
  ) THEN
    CREATE POLICY decision_outcomes_tenant_isolation
      ON decision_outcomes
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- ─── decision_links ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_links (
  tenant_id           text        NOT NULL,
  source_decision_id  uuid        NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  target_decision_id  uuid        NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  relationship        text        NOT NULL,
  note                text,
  entry_hash          text        NOT NULL,
  prev_hash           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_decision_id, target_decision_id, relationship)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decision_links_relationship_chk'
  ) THEN
    ALTER TABLE decision_links
      ADD CONSTRAINT decision_links_relationship_chk
      CHECK (relationship IN (
        'supersedes', 'depends_on', 'informed_by', 'reversed_by'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'decision_links_no_self_loop_chk'
  ) THEN
    ALTER TABLE decision_links
      ADD CONSTRAINT decision_links_no_self_loop_chk
      CHECK (source_decision_id <> target_decision_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS decision_links_source_idx
  ON decision_links (tenant_id, source_decision_id);

CREATE INDEX IF NOT EXISTS decision_links_target_idx
  ON decision_links (tenant_id, target_decision_id);

ALTER TABLE decision_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_links FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'decision_links'
       AND policyname = 'decision_links_tenant_isolation'
  ) THEN
    CREATE POLICY decision_links_tenant_isolation
      ON decision_links
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
