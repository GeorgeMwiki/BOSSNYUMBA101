-- =============================================================================
-- Migration 0287 — Outcome Telemetry (Wave CLOSED-LOOP, real-estate)
--
-- Port of Borjie 0114. Three tables back the closed-loop telemetry
-- contract: every action proposed by the brain (or taken by the
-- owner / an agent / an external system) declares a predicted outcome,
-- is reconciled against the observed outcome after N days, and feeds a
-- learning_signal back so future predictions calibrate.
--
--   1. outcome_predictions     — "WHAT I expect to change, by WHEN, with
--                                CONFIDENCE C". One row per WRITE action.
--   2. outcome_observations    — observed reality after horizon elapses.
--   3. outcome_reconciliations — gap-analysis row joining the two.
--
-- Real-estate prediction shapes the brain emits:
--   - {"rent_paid_on_time": true} — for invoice issuance actions
--   - {"lease_renewed": true}     — for lease renewal-reminder actions
--   - {"sla_met": true}           — for maintenance dispatch actions
--   - {"applicant_signed": true}  — for tenant onboarding actions
--   - {"listing_filled_days": 14} — for marketplace-listing actions
--
-- Tenant-scoped via the canonical `app.current_tenant_id` GUC. RLS
-- FORCE-enabled per CLAUDE.md.
--
-- Idempotent. Forward-only. IMMUTABLE.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) outcome_predictions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outcome_predictions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   text        NOT NULL,
  actor_kind                  text        NOT NULL,
  actor_id                    text        NOT NULL,
  action_kind                 text        NOT NULL,
  action_target_entity_type   text        NOT NULL,
  action_target_entity_id     text        NOT NULL,
  predicted_outcome           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  prediction_confidence       numeric(4,3) NOT NULL DEFAULT 0.000,
  prediction_horizon_days     integer     NOT NULL DEFAULT 30,
  predicted_value             numeric(20,2),
  predicted_value_currency    text        NOT NULL DEFAULT 'TZS',
  rationale                   text        NOT NULL DEFAULT '',
  audit_hash_id               text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'outcome_predictions_actor_kind_chk'
  ) THEN
    ALTER TABLE outcome_predictions
      ADD CONSTRAINT outcome_predictions_actor_kind_chk
      CHECK (actor_kind IN ('brain', 'owner', 'agent', 'external'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'outcome_predictions_confidence_chk'
  ) THEN
    ALTER TABLE outcome_predictions
      ADD CONSTRAINT outcome_predictions_confidence_chk
      CHECK (prediction_confidence >= 0 AND prediction_confidence <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'outcome_predictions_horizon_chk'
  ) THEN
    ALTER TABLE outcome_predictions
      ADD CONSTRAINT outcome_predictions_horizon_chk
      CHECK (prediction_horizon_days >= 0 AND prediction_horizon_days <= 365);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'outcome_predictions_currency_chk'
  ) THEN
    ALTER TABLE outcome_predictions
      ADD CONSTRAINT outcome_predictions_currency_chk
      CHECK (predicted_value_currency ~ '^[A-Z]{3}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS outcome_predictions_tenant_due_idx
  ON outcome_predictions (tenant_id, created_at, prediction_horizon_days);

CREATE INDEX IF NOT EXISTS outcome_predictions_actor_kind_idx
  ON outcome_predictions (tenant_id, actor_kind, action_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS outcome_predictions_entity_idx
  ON outcome_predictions (
    tenant_id,
    action_target_entity_type,
    action_target_entity_id,
    created_at DESC
  );

ALTER TABLE outcome_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_predictions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'outcome_predictions'
       AND policyname = 'outcome_predictions_tenant_isolation'
  ) THEN
    CREATE POLICY outcome_predictions_tenant_isolation
      ON outcome_predictions
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) outcome_observations
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outcome_observations (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              text        NOT NULL,
  prediction_id          uuid        NOT NULL
    REFERENCES outcome_predictions(id) ON DELETE CASCADE,
  observed_outcome       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  observed_value         numeric(20,2),
  observed_value_currency text       NOT NULL DEFAULT 'TZS',
  observed_at            timestamptz NOT NULL DEFAULT now(),
  gap_pct                numeric(6,4),
  calibrated             boolean     NOT NULL DEFAULT false,
  narrative              text        NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS outcome_observations_one_per_prediction_idx
  ON outcome_observations (tenant_id, prediction_id);

CREATE INDEX IF NOT EXISTS outcome_observations_calibrated_idx
  ON outcome_observations (tenant_id, calibrated, observed_at DESC)
  WHERE calibrated = false;

ALTER TABLE outcome_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_observations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'outcome_observations'
       AND policyname = 'outcome_observations_tenant_isolation'
  ) THEN
    CREATE POLICY outcome_observations_tenant_isolation
      ON outcome_observations
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) outcome_reconciliations
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outcome_reconciliations (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              text        NOT NULL,
  prediction_id          uuid        NOT NULL
    REFERENCES outcome_predictions(id) ON DELETE CASCADE,
  observation_id         uuid
    REFERENCES outcome_observations(id) ON DELETE SET NULL,
  status                 text        NOT NULL,
  drift_score            numeric(6,4) NOT NULL DEFAULT 0.0,
  learning_signal        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  audit_hash_id          text,
  reconciled_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'outcome_reconciliations_status_chk'
  ) THEN
    ALTER TABLE outcome_reconciliations
      ADD CONSTRAINT outcome_reconciliations_status_chk
      CHECK (status IN ('matched', 'divergent', 'expired', 'undetermined'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'outcome_reconciliations_drift_chk'
  ) THEN
    ALTER TABLE outcome_reconciliations
      ADD CONSTRAINT outcome_reconciliations_drift_chk
      CHECK (drift_score >= 0 AND drift_score <= 1);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS outcome_reconciliations_one_per_prediction_idx
  ON outcome_reconciliations (tenant_id, prediction_id);

CREATE INDEX IF NOT EXISTS outcome_reconciliations_status_idx
  ON outcome_reconciliations (tenant_id, status, reconciled_at DESC);

ALTER TABLE outcome_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_reconciliations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'outcome_reconciliations'
       AND policyname = 'outcome_reconciliations_tenant_isolation'
  ) THEN
    CREATE POLICY outcome_reconciliations_tenant_isolation
      ON outcome_reconciliations
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
